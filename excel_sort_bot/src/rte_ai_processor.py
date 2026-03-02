"""
RTE AI PROCESSOR v2.0 — Generador de Ops desde lenguaje natural
Traduce instrucciones a operaciones determinísticas.

v2.0 Features:
- INSERT_ROWS / DELETE_ROWS
- RENAME_SHEET / ADD_SHEET / DELETE_SHEET
- SET_FORMULA
- Soporte OpenAI con .env

La IA NO toca Excel. Solo propone ops.
"""
import json
import re
import os
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

from dotenv import load_dotenv

# Cargar .env
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

from openai import OpenAI

from src.workbook_rte import Op, OpType, ValueType


# ============================================
# SYSTEM PROMPT v2.0
# ============================================

SYSTEM_PROMPT = """Eres un operador experto de cuadernos de campo agrícolas (España/SIGPAC).
Tu trabajo es traducir instrucciones de edición a operaciones JSON estructuradas.

REGLAS CRÍTICAS:
1. SOLO devuelves JSON, nunca texto adicional
2. Usas el workbook_dictionary para mapear campos→columnas
3. Si no estás seguro de algo, devuelves requires_confirmation: true
4. NUNCA inventas hojas o columnas que no existan

SCHEMA DE RESPUESTA:
{
  "requires_confirmation": false,
  "ops": [...],
  "warnings": [],
  "questions": []
}

OPERACIONES DISPONIBLES (v2.0):

1. SET_CELL - Cambiar valor de una celda
   {"op": "SET_CELL", "sheet": "hoja", "cell": "A1", "value": "valor", "value_type": "string|number|date"}

2. SET_RANGE - Cambiar múltiples celdas
   {"op": "SET_RANGE", "sheet": "hoja", "range": "A1:C3", "value": [[...],[...]]}

3. CLEAR_RANGE - Limpiar un rango
   {"op": "CLEAR_RANGE", "sheet": "hoja", "range": "A1:M20"}

4. FIND_REPLACE - Buscar y reemplazar texto
   {"op": "FIND_REPLACE", "sheet": "hoja", "find": "texto", "replace": "nuevo"}

5. INSERT_ROWS - Insertar filas
   {"op": "INSERT_ROWS", "sheet": "hoja", "row_start": 15, "row_count": 5}

6. DELETE_ROWS - Eliminar filas
   {"op": "DELETE_ROWS", "sheet": "hoja", "row_start": 20, "row_count": 3}

7. RENAME_SHEET - Renombrar hoja
   {"op": "RENAME_SHEET", "sheet": "nombre_actual", "new_name": "nuevo_nombre"}

8. ADD_SHEET - Añadir nueva hoja
   {"op": "ADD_SHEET", "new_name": "nueva_hoja"}

9. DELETE_SHEET - Eliminar hoja
   {"op": "DELETE_SHEET", "sheet": "hoja_a_eliminar"}

10. COPY_SHEET - Copiar hoja
    {"op": "COPY_SHEET", "sheet": "origen", "new_name": "copia"}

11. SET_FORMULA - Poner fórmula en celda
    {"op": "SET_FORMULA", "sheet": "hoja", "cell": "A1", "formula": "=SUM(B1:B10)"}

MAPEO DE COLUMNAS EN inf.trat 1:
- A: Id. Parcelas (nro_orden)
- B: Especie/Cultivo
- C: Variedad
- D: Superficie tratada (ha)
- E: Fecha del tratamiento (fecha)
- F: Plaga/enfermedad
- G: Nº orden tratamiento
- H: Nº aplicación
- I: Nombre comercial producto
- J: Nº registro
- K: Dosis (formato: "X,XX l" o "X,XX kg")
- L: Eficacia
- M: Observaciones

HOJAS PROTEGIDAS (no se pueden eliminar/renombrar):
- inf.gral 1, inf.gral 2
- 2.1. DATOS PARCELAS
- inf.trat 1, inf.trat 2, inf.trat 3, inf.trat 4
- reg.prod, reg.fert., reg. cosecha

EJEMPLOS:

Instrucción: "Inserta 5 filas después de la 15 en inf.trat 1"
Respuesta:
{"requires_confirmation": false, "ops": [{"op": "INSERT_ROWS", "sheet": "inf.trat 1", "row_start": 16, "row_count": 5}], "warnings": [], "questions": []}

Instrucción: "Elimina las filas 50 a 55 de inf.trat 1"
Respuesta:
{"requires_confirmation": false, "ops": [{"op": "DELETE_ROWS", "sheet": "inf.trat 1", "row_start": 50, "row_count": 6}], "warnings": [], "questions": []}

Instrucción: "Renombra la hoja 'Hoja1' a 'Notas'"
Respuesta:
{"requires_confirmation": false, "ops": [{"op": "RENAME_SHEET", "sheet": "Hoja1", "new_name": "Notas"}], "warnings": [], "questions": []}

Instrucción: "Pon la fórmula =SUM(D11:D100) en la celda D101 de inf.trat 1"
Respuesta:
{"requires_confirmation": false, "ops": [{"op": "SET_FORMULA", "sheet": "inf.trat 1", "cell": "D101", "formula": "=SUM(D11:D100)"}], "warnings": [], "questions": []}

Instrucción: "Crea una hoja nueva llamada 'Resumen'"
Respuesta:
{"requires_confirmation": false, "ops": [{"op": "ADD_SHEET", "new_name": "Resumen"}], "warnings": [], "questions": []}

Instrucción: "Cambia la fecha de la fila 120 a 15/03/2026"
Respuesta:
{"requires_confirmation": false, "ops": [{"op": "SET_CELL", "sheet": "inf.trat 1", "cell": "E120", "value": "15/03/2026", "value_type": "date"}], "warnings": [], "questions": []}

Instrucción: "Elimina la hoja inf.trat 1"
Respuesta:
{"requires_confirmation": true, "ops": [], "warnings": ["La hoja inf.trat 1 está protegida y no se puede eliminar"], "questions": []}
"""


# ============================================
# RTE AI PROCESSOR v2.0
# ============================================

class RTEAIProcessor:
    """Procesa instrucciones y genera Ops"""
    
    VERSION = "2.0"
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if self.api_key:
            self.client = OpenAI(api_key=self.api_key)
        else:
            self.client = None
        
        self.workbook_context = {}
    
    def set_workbook_context(self, context: Dict[str, Any]):
        """Establece contexto del workbook actual"""
        self.workbook_context = context
    
    def generate_ops(self, 
                     instruction: str,
                     selection: Dict = None,
                     use_ai: bool = True) -> Dict[str, Any]:
        """
        Genera operaciones desde instrucción.
        
        Args:
            instruction: Instrucción en lenguaje natural
            selection: Contexto de selección {sheet, cell, range}
            use_ai: Si False, usa parsing local sin IA
        
        Returns:
            {requires_confirmation, ops, warnings, questions}
        """
        if use_ai and self.client:
            return self._generate_with_ai(instruction, selection)
        else:
            return self._generate_local(instruction, selection)
    
    def _generate_with_ai(self, instruction: str, selection: Dict = None) -> Dict:
        """Usa OpenAI para generar ops"""
        user_prompt = f"Instrucción: {instruction}"
        
        if selection:
            user_prompt += f"\nContexto: Hoja actual: {selection.get('sheet')}"
            if selection.get('cell'):
                user_prompt += f", Celda seleccionada: {selection.get('cell')}"
            if selection.get('range'):
                user_prompt += f", Rango seleccionado: {selection.get('range')}"
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            
            # Convertir a objetos Op
            ops = []
            for op_dict in result.get("ops", []):
                try:
                    op = Op(
                        op=OpType(op_dict["op"]),
                        sheet=op_dict.get("sheet", "inf.trat 1"),
                        cell=op_dict.get("cell"),
                        range=op_dict.get("range"),
                        value=op_dict.get("value"),
                        value_type=ValueType(op_dict.get("value_type", "string")),
                        find=op_dict.get("find"),
                        replace=op_dict.get("replace"),
                        row_start=op_dict.get("row_start"),
                        row_count=op_dict.get("row_count"),
                        col_start=op_dict.get("col_start"),
                        col_count=op_dict.get("col_count"),
                        new_name=op_dict.get("new_name"),
                        source_sheet=op_dict.get("source_sheet"),
                        formula=op_dict.get("formula")
                    )
                    ops.append(op)
                except Exception as e:
                    result.setdefault("warnings", []).append(f"Error parseando op: {e}")
            
            return {
                "requires_confirmation": result.get("requires_confirmation", False),
                "ops": ops,
                "warnings": result.get("warnings", []),
                "questions": result.get("questions", [])
            }
            
        except Exception as e:
            return {
                "requires_confirmation": True,
                "ops": [],
                "warnings": [f"Error de IA: {str(e)}"],
                "questions": []
            }
    
    def _generate_local(self, instruction: str, selection: Dict = None) -> Dict:
        """Parsing local sin IA (para casos simples)"""
        ops = []
        warnings = []
        questions = []
        requires_confirmation = False
        
        instruction_lower = instruction.lower()
        default_sheet = selection.get("sheet", "inf.trat 1") if selection else "inf.trat 1"
        
        # === SET_CELL patterns ===
        
        # "Cambia la fecha de la fila X a Y"
        match = re.search(r'fecha.*fila\s+(\d+).*a\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', instruction_lower)
        if match:
            row = match.group(1)
            date = match.group(2).replace("-", "/")
            ops.append(Op(
                op=OpType.SET_CELL,
                sheet=default_sheet,
                cell=f"E{row}",
                value=date,
                value_type=ValueType.DATE
            ))
            return {"requires_confirmation": False, "ops": ops, "warnings": [], "questions": []}
        
        # "Cambia dosis de fila X a Y"
        match = re.search(r'dosis.*fila\s+(\d+).*a\s+([\d,\.]+)\s*(l|kg|litros|kilos)?', instruction_lower)
        if match:
            row = match.group(1)
            dose_val = match.group(2)
            unit = match.group(3) or "l"
            if unit in ["litros", "l"]:
                unit = "l"
            elif unit in ["kilos", "kg"]:
                unit = "kg"
            ops.append(Op(
                op=OpType.SET_CELL,
                sheet=default_sheet,
                cell=f"K{row}",
                value=f"{dose_val} {unit}",
                value_type=ValueType.STRING
            ))
            return {"requires_confirmation": False, "ops": ops, "warnings": [], "questions": []}
        
        # === FIND_REPLACE ===
        match = re.search(r'reemplaza\s+["\']?([^"\']+)["\']?\s+por\s+["\']?([^"\']+)["\']?', instruction_lower)
        if match:
            find = match.group(1).strip()
            replace = match.group(2).strip()
            ops.append(Op(
                op=OpType.FIND_REPLACE,
                sheet=default_sheet,
                find=find,
                replace=replace
            ))
            return {"requires_confirmation": False, "ops": ops, "warnings": [], "questions": []}
        
        # === INSERT_ROWS ===
        match = re.search(r'insert[ae]?\s+(\d+)\s*filas?\s+(?:en|después de|after)?\s*(?:la\s+)?(?:fila\s+)?(\d+)?', instruction_lower)
        if match:
            count = int(match.group(1))
            row_start = int(match.group(2)) + 1 if match.group(2) else 11
            ops.append(Op(
                op=OpType.INSERT_ROWS,
                sheet=default_sheet,
                row_start=row_start,
                row_count=count
            ))
            return {"requires_confirmation": False, "ops": ops, "warnings": [], "questions": []}
        
        # === DELETE_ROWS ===
        match = re.search(r'(?:elimina|borra|delete)\s+(?:las\s+)?filas?\s+(\d+)\s*(?:a|hasta|-)\s*(\d+)?', instruction_lower)
        if match:
            row_start = int(match.group(1))
            row_end = int(match.group(2)) if match.group(2) else row_start
            count = row_end - row_start + 1
            ops.append(Op(
                op=OpType.DELETE_ROWS,
                sheet=default_sheet,
                row_start=row_start,
                row_count=count
            ))
            return {"requires_confirmation": False, "ops": ops, "warnings": [], "questions": []}
        
        # === RENAME_SHEET ===
        match = re.search(r'renombra\s+(?:la\s+)?hoja\s+["\']?([^"\']+)["\']?\s+(?:a|como)\s+["\']?([^"\']+)["\']?', instruction, re.IGNORECASE)
        if match:
            old_name = match.group(1).strip()
            new_name = match.group(2).strip()
            ops.append(Op(
                op=OpType.RENAME_SHEET,
                sheet=old_name,
                new_name=new_name
            ))
            return {"requires_confirmation": False, "ops": ops, "warnings": [], "questions": []}
        
        # === ADD_SHEET ===
        match = re.search(r'(?:crea|añade|nueva)\s+(?:una\s+)?hoja\s+(?:llamada\s+)?["\']?([^"\']+)["\']?', instruction, re.IGNORECASE)
        if match:
            new_name = match.group(1).strip()
            ops.append(Op(
                op=OpType.ADD_SHEET,
                sheet=new_name,
                new_name=new_name
            ))
            return {"requires_confirmation": False, "ops": ops, "warnings": [], "questions": []}
        
        # === DELETE_SHEET ===
        match = re.search(r'(?:elimina|borra|delete)\s+(?:la\s+)?hoja\s+["\']?([^"\']+)["\']?', instruction, re.IGNORECASE)
        if match:
            sheet_name = match.group(1).strip()
            # Verificar si está protegida
            protected = {"inf.gral 1", "inf.gral 2", "2.1. datos parcelas", 
                        "inf.trat 1", "inf.trat 2", "inf.trat 3", "inf.trat 4",
                        "reg.prod", "reg.fert.", "reg. cosecha"}
            if sheet_name.lower() in protected:
                return {
                    "requires_confirmation": True,
                    "ops": [],
                    "warnings": [f"La hoja '{sheet_name}' está protegida"],
                    "questions": []
                }
            ops.append(Op(
                op=OpType.DELETE_SHEET,
                sheet=sheet_name
            ))
            return {"requires_confirmation": False, "ops": ops, "warnings": [], "questions": []}
        
        # === SET_FORMULA ===
        match = re.search(r'(?:pon|poner|agrega)\s+(?:la\s+)?f[oó]rmula\s+(=[^\s]+)\s+en\s+(?:la\s+)?(?:celda\s+)?([A-Z]+\d+)', instruction, re.IGNORECASE)
        if match:
            formula = match.group(1)
            cell = match.group(2).upper()
            ops.append(Op(
                op=OpType.SET_FORMULA,
                sheet=default_sheet,
                cell=cell,
                formula=formula
            ))
            return {"requires_confirmation": False, "ops": ops, "warnings": [], "questions": []}
        
        # Si no se reconoce el patrón
        if not ops:
            requires_confirmation = True
            questions.append("No entendí la instrucción. ¿Puedes ser más específico?")
            questions.append("Ejemplos: 'Cambia la fecha de la fila 120 a 15/03/2026', 'Inserta 5 filas después de la 15', 'Renombra la hoja Hoja1 a Notas'")
        
        return {
            "requires_confirmation": requires_confirmation,
            "ops": ops,
            "warnings": warnings,
            "questions": questions
        }


# ============================================
# FUNCIÓN DE CONVENIENCIA
# ============================================

def process_instruction(instruction: str, 
                        selection: Dict = None,
                        use_ai: bool = True) -> Dict[str, Any]:
    """
    Procesa una instrucción y devuelve ops.
    
    Ejemplo:
        result = process_instruction("Inserta 5 filas después de la 15")
        # result["ops"] = [Op(INSERT_ROWS, "inf.trat 1", row_start=16, row_count=5)]
    """
    processor = RTEAIProcessor()
    return processor.generate_ops(instruction, selection, use_ai)
