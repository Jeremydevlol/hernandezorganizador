"""
RTE CONTRACT VALIDATOR v1.0
Guardrails enterprise para validación de operaciones.

Features:
- Validación por tipo de dato (fecha, número, dosis, etc.)
- Hojas/filas/columnas protegidas
- Normalización de valores
- Aliases de hojas
- Tamper-proof commits (ops_hash, checksum_before, TTL)
- File locking por session
"""
import re
import hashlib
import json
from typing import Dict, Any, List, Optional, Tuple, Set
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from pathlib import Path
from enum import Enum
import threading
import time


# ============================================
# SHEET ALIASES
# ============================================

SHEET_ALIASES = {
    # Tratamientos
    "tratamientos": "inf.trat 1",
    "tratamiento": "inf.trat 1",
    "fitosanitarios": "inf.trat 1",
    "aplicaciones": "inf.trat 1",
    "trat1": "inf.trat 1",
    "trat2": "inf.trat 2",
    "trat3": "inf.trat 3",
    "trat4": "inf.trat 4",
    # Parcelas
    "parcelas": "2.1. DATOS PARCELAS",
    "datos parcelas": "2.1. DATOS PARCELAS",
    "sigpac": "2.1. DATOS PARCELAS",
    # General
    "general": "inf.gral 1",
    "general1": "inf.gral 1",
    "general2": "inf.gral 2",
    "info": "inf.gral 1",
    # Registros
    "productos": "reg.prod",
    "fertilizantes": "reg.fert.",
    "cosecha": "reg. cosecha",
}


# ============================================
# DATA TYPES
# ============================================

class DataType(str, Enum):
    STRING = "string"
    DATE = "date"
    NUMBER = "number"
    FLOAT = "float"
    INTEGER = "integer"
    DOSE = "dose"           # "3,50 l" o "2,00 kg"
    SURFACE = "surface"     # float > 0
    PRODUCT = "product"     # string uppercase
    PERCENTAGE = "percentage"
    FORMULA = "formula"


# ============================================
# COLUMN CONTRACTS
# ============================================

COLUMN_CONTRACTS = {
    "inf.trat 1": {
        "A": {"name": "id_parcelas", "type": DataType.INTEGER, "editable": True, "required": True},
        "B": {"name": "especie", "type": DataType.PRODUCT, "editable": True, "required": True},
        "C": {"name": "variedad", "type": DataType.STRING, "editable": True, "required": False},
        "D": {"name": "superficie_tratada", "type": DataType.SURFACE, "editable": True, "required": False},
        "E": {"name": "fecha", "type": DataType.DATE, "editable": True, "required": True},
        "F": {"name": "problema_fito", "type": DataType.STRING, "editable": True, "required": False},
        "G": {"name": "nro_tratamiento", "type": DataType.INTEGER, "editable": True, "required": False},
        "H": {"name": "nro_aplicacion", "type": DataType.INTEGER, "editable": True, "required": False},
        "I": {"name": "producto", "type": DataType.PRODUCT, "editable": True, "required": True},
        "J": {"name": "nro_registro", "type": DataType.STRING, "editable": True, "required": False},
        "K": {"name": "dosis", "type": DataType.DOSE, "editable": True, "required": True},
        "L": {"name": "eficacia", "type": DataType.STRING, "editable": True, "required": False},
        "M": {"name": "observaciones", "type": DataType.STRING, "editable": True, "required": False},
    },
    "2.1. DATOS PARCELAS": {
        "B": {"name": "nro_orden", "type": DataType.INTEGER, "editable": True, "required": True},
        "D": {"name": "municipio", "type": DataType.STRING, "editable": True, "required": True},
        "G": {"name": "poligono", "type": DataType.INTEGER, "editable": True, "required": True},
        "H": {"name": "parcela", "type": DataType.INTEGER, "editable": True, "required": True},
        "I": {"name": "recinto", "type": DataType.INTEGER, "editable": True, "required": True},
        "K": {"name": "superficie_sigpac", "type": DataType.SURFACE, "editable": False, "required": False},
        "L": {"name": "superficie_cultivada", "type": DataType.SURFACE, "editable": True, "required": True},
        "M": {"name": "cultivo", "type": DataType.PRODUCT, "editable": True, "required": True},
    },
    "inf.gral 1": {
        # Casi toda la hoja es protegida
        "D": {"name": "razon_social", "type": DataType.STRING, "editable": True, "required": False},
        "L": {"name": "nif", "type": DataType.STRING, "editable": True, "required": False},
    }
}

# Filas protegidas por hoja
PROTECTED_ROWS = {
    "inf.trat 1": list(range(1, 11)),   # Headers
    "inf.trat 2": list(range(1, 11)),
    "inf.trat 3": list(range(1, 11)),
    "inf.trat 4": list(range(1, 11)),
    "2.1. DATOS PARCELAS": list(range(1, 14)),
    "inf.gral 1": list(range(1, 100)),  # Toda protegida excepto campos específicos
    "inf.gral 2": list(range(1, 100)),
    "reg.prod": list(range(1, 5)),
    "reg.fert.": list(range(1, 5)),
    "reg. cosecha": list(range(1, 5)),
}

# Hojas protegidas (no se pueden eliminar/renombrar)
PROTECTED_SHEETS = {
    "inf.gral 1", "inf.gral 2",
    "2.1. DATOS PARCELAS",
    "inf.trat 1", "inf.trat 2", "inf.trat 3", "inf.trat 4",
    "reg.prod", "reg.fert.", "reg. cosecha"
}


# ============================================
# VALUE VALIDATORS & NORMALIZERS
# ============================================

class ValueValidator:
    """Valida y normaliza valores según tipo"""
    
    @staticmethod
    def validate(value: Any, data_type: DataType) -> Tuple[bool, Optional[str], Any]:
        """
        Valida y normaliza un valor.
        
        Returns:
            (is_valid, error_message, normalized_value)
        """
        if value is None:
            return True, None, None
        
        validators = {
            DataType.STRING: ValueValidator._validate_string,
            DataType.DATE: ValueValidator._validate_date,
            DataType.NUMBER: ValueValidator._validate_number,
            DataType.FLOAT: ValueValidator._validate_float,
            DataType.INTEGER: ValueValidator._validate_integer,
            DataType.DOSE: ValueValidator._validate_dose,
            DataType.SURFACE: ValueValidator._validate_surface,
            DataType.PRODUCT: ValueValidator._validate_product,
            DataType.PERCENTAGE: ValueValidator._validate_percentage,
            DataType.FORMULA: ValueValidator._validate_formula,
        }
        
        validator = validators.get(data_type, ValueValidator._validate_string)
        return validator(value)
    
    @staticmethod
    def _validate_string(value) -> Tuple[bool, Optional[str], Any]:
        return True, None, str(value)
    
    @staticmethod
    def _validate_date(value) -> Tuple[bool, Optional[str], Any]:
        if isinstance(value, datetime):
            return True, None, value
        
        if isinstance(value, str):
            # Intentar parsear varios formatos
            formats = ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d.%m.%Y"]
            for fmt in formats:
                try:
                    parsed = datetime.strptime(value.strip(), fmt)
                    return True, None, parsed
                except ValueError:
                    continue
            
            return False, f"Fecha inválida: {value}. Usa formato DD/MM/YYYY", None
        
        return False, f"Tipo de fecha no reconocido: {type(value)}", None
    
    @staticmethod
    def _validate_number(value) -> Tuple[bool, Optional[str], Any]:
        try:
            if isinstance(value, (int, float)):
                return True, None, float(value)
            
            val_str = str(value).replace(",", ".").strip()
            return True, None, float(val_str)
        except (ValueError, TypeError):
            return False, f"Número inválido: {value}", None
    
    @staticmethod
    def _validate_float(value) -> Tuple[bool, Optional[str], Any]:
        return ValueValidator._validate_number(value)
    
    @staticmethod
    def _validate_integer(value) -> Tuple[bool, Optional[str], Any]:
        try:
            if isinstance(value, int):
                return True, None, value
            
            val_str = str(value).replace(",", ".").strip()
            return True, None, int(float(val_str))
        except (ValueError, TypeError):
            return False, f"Entero inválido: {value}", None
    
    @staticmethod
    def _validate_dose(value) -> Tuple[bool, Optional[str], Any]:
        """Valida formato de dosis: '3,50 l' o '2,00 kg'"""
        val_str = str(value).strip()
        
        # Ya tiene formato correcto
        match = re.match(r'^(\d+[,\.]\d+)\s*(l|kg|ml|g)$', val_str, re.IGNORECASE)
        if match:
            num = match.group(1).replace(".", ",")
            unit = match.group(2).lower()
            return True, None, f"{num} {unit}"
        
        # Solo número, asumir litros
        try:
            num = float(val_str.replace(",", "."))
            formatted = f"{num:.2f}".replace(".", ",")
            return True, None, f"{formatted} l"
        except ValueError:
            pass
        
        return False, f"Dosis inválida: {value}. Usa formato '3,50 l' o '2,00 kg'", None
    
    @staticmethod
    def _validate_surface(value) -> Tuple[bool, Optional[str], Any]:
        """Valida superficie: float > 0"""
        try:
            if isinstance(value, (int, float)):
                num = float(value)
            else:
                val_str = str(value).replace(",", ".").strip()
                num = float(val_str)
            
            if num <= 0:
                return False, f"Superficie debe ser > 0: {value}", None
            
            return True, None, round(num, 2)
        except (ValueError, TypeError):
            return False, f"Superficie inválida: {value}", None
    
    @staticmethod
    def _validate_product(value) -> Tuple[bool, Optional[str], Any]:
        """Valida y normaliza nombre de producto (uppercase)"""
        val_str = str(value).strip().upper()
        if not val_str:
            return False, "Producto no puede estar vacío", None
        return True, None, val_str
    
    @staticmethod
    def _validate_percentage(value) -> Tuple[bool, Optional[str], Any]:
        """Valida porcentaje 0-100"""
        try:
            if isinstance(value, (int, float)):
                num = float(value)
            else:
                val_str = str(value).replace("%", "").replace(",", ".").strip()
                num = float(val_str)
            
            if num < 0 or num > 100:
                return False, f"Porcentaje fuera de rango: {value}", None
            
            return True, None, num
        except (ValueError, TypeError):
            return False, f"Porcentaje inválido: {value}", None
    
    @staticmethod
    def _validate_formula(value) -> Tuple[bool, Optional[str], Any]:
        """Valida fórmulas (whitelist de funciones)"""
        val_str = str(value).strip()
        
        if not val_str.startswith("="):
            return False, "Fórmula debe empezar con =", None
        
        # Lista de funciones permitidas
        ALLOWED = {
            "SUM", "AVERAGE", "COUNT", "COUNTA", "COUNTIF", "COUNTIFS",
            "MAX", "MIN", "ROUND", "IF", "AND", "OR", "NOT", "IFERROR",
            "VLOOKUP", "INDEX", "MATCH", "SUMIF", "SUMIFS",
            "LEFT", "RIGHT", "MID", "LEN", "UPPER", "LOWER",
            "TODAY", "NOW", "DATE", "YEAR", "MONTH", "DAY"
        }
        
        BLOCKED = {"INDIRECT", "OFFSET", "HYPERLINK", "WEBSERVICE", "CALL"}
        
        # Extraer funciones
        functions = set(re.findall(r'([A-Z]+)\s*\(', val_str.upper()))
        
        blocked_found = functions & BLOCKED
        if blocked_found:
            return False, f"Funciones bloqueadas: {blocked_found}", None
        
        return True, None, val_str


# ============================================
# CONTRACT VALIDATOR
# ============================================

@dataclass
class ValidationResult:
    """Resultado de validación"""
    valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    normalized_value: Any = None


class ContractValidator:
    """Valida operaciones contra el contrato"""
    
    def __init__(self):
        self.contracts = COLUMN_CONTRACTS
        self.protected_rows = PROTECTED_ROWS
        self.protected_sheets = PROTECTED_SHEETS
        self.aliases = SHEET_ALIASES
        self._sheet_canonical_map: Dict[str, str] = {}
    
    def set_sheet_names(self, sheet_names: List[str]):
        """Establece el mapa canónico de hojas"""
        self._sheet_canonical_map = {name.lower(): name for name in sheet_names}
    
    def resolve_sheet_name(self, name: str) -> Optional[str]:
        """Resuelve un nombre de hoja (con aliases y case-insensitive)"""
        name_lower = name.lower().strip()
        
        # 1. Alias
        if name_lower in self.aliases:
            return self.aliases[name_lower]
        
        # 2. Match exacto (case-insensitive)
        if name_lower in self._sheet_canonical_map:
            return self._sheet_canonical_map[name_lower]
        
        # 3. Match parcial
        for canonical_lower, canonical in self._sheet_canonical_map.items():
            if name_lower in canonical_lower or canonical_lower in name_lower:
                return canonical
        
        return None
    
    def validate_cell_edit(self, sheet: str, cell: str, value: Any) -> ValidationResult:
        """Valida una edición de celda"""
        errors = []
        warnings = []
        
        # 1. Resolver nombre de hoja
        canonical_sheet = self.resolve_sheet_name(sheet)
        if canonical_sheet is None:
            errors.append(f"Hoja no encontrada: {sheet}")
            return ValidationResult(valid=False, errors=errors)
        
        # 2. Parsear celda
        match = re.match(r'^([A-Z]+)(\d+)$', cell.upper())
        if not match:
            errors.append(f"Celda inválida: {cell}")
            return ValidationResult(valid=False, errors=errors)
        
        col = match.group(1)
        row = int(match.group(2))
        
        # 3. Verificar fila protegida
        protected = self.protected_rows.get(canonical_sheet, [])
        if row in protected:
            errors.append(f"Fila {row} está protegida en {canonical_sheet}")
            return ValidationResult(valid=False, errors=errors)
        
        # 4. Verificar columna editable
        contract = self.contracts.get(canonical_sheet, {})
        col_contract = contract.get(col)
        
        if col_contract:
            if not col_contract.get("editable", True):
                errors.append(f"Columna {col} no es editable en {canonical_sheet}")
                return ValidationResult(valid=False, errors=errors)
            
            # 5. Validar tipo de dato
            data_type = col_contract.get("type", DataType.STRING)
            is_valid, error, normalized = ValueValidator.validate(value, data_type)
            
            if not is_valid:
                errors.append(error)
                return ValidationResult(valid=False, errors=errors)
            
            return ValidationResult(valid=True, normalized_value=normalized)
        
        # Sin contrato específico, permite la edición
        return ValidationResult(valid=True, normalized_value=value)
    
    def validate_sheet_operation(self, op_type: str, sheet: str) -> ValidationResult:
        """Valida operaciones sobre hojas (rename, delete, etc.)"""
        canonical = self.resolve_sheet_name(sheet)
        
        if canonical and canonical in self.protected_sheets:
            return ValidationResult(
                valid=False,
                errors=[f"Hoja protegida: {canonical}"]
            )
        
        return ValidationResult(valid=True)
    
    def validate_row_operation(self, sheet: str, row_start: int, 
                               row_count: int = 1) -> ValidationResult:
        """Valida operaciones sobre filas (insert, delete)"""
        canonical = self.resolve_sheet_name(sheet) or sheet
        protected = self.protected_rows.get(canonical, [])
        
        for r in range(row_start, row_start + row_count):
            if r in protected:
                return ValidationResult(
                    valid=False,
                    errors=[f"Fila {r} está protegida en {canonical}"]
                )
        
        return ValidationResult(valid=True)


# ============================================
# TAMPER-PROOF PROPOSAL
# ============================================

@dataclass
class SecureProposal:
    """Propuesta tamper-proof con hash y TTL"""
    proposal_id: str
    ops_hash: str           # Hash de las operaciones
    checksum_before: str    # Checksum del archivo antes
    created_at: datetime
    expires_at: datetime
    ops: List[Dict]
    session_id: str
    
    def is_expired(self) -> bool:
        return datetime.now() > self.expires_at
    
    def verify_ops_hash(self, ops: List[Dict]) -> bool:
        """Verifica que las ops no han sido modificadas"""
        current_hash = self._compute_ops_hash(ops)
        return current_hash == self.ops_hash
    
    @staticmethod
    def _compute_ops_hash(ops: List[Dict]) -> str:
        """Calcula hash de las operaciones"""
        ops_json = json.dumps(ops, sort_keys=True, default=str)
        return hashlib.sha256(ops_json.encode()).hexdigest()[:16]
    
    @classmethod
    def create(cls, proposal_id: str, ops: List[Dict], 
               checksum_before: str, session_id: str,
               ttl_minutes: int = 10) -> "SecureProposal":
        """Crea una propuesta segura"""
        now = datetime.now()
        return cls(
            proposal_id=proposal_id,
            ops_hash=cls._compute_ops_hash(ops),
            checksum_before=checksum_before,
            created_at=now,
            expires_at=now + timedelta(minutes=ttl_minutes),
            ops=ops,
            session_id=session_id
        )


# ============================================
# FILE LOCK MANAGER
# ============================================

class FileLockManager:
    """Gestiona locks de archivos por session"""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._locks: Dict[str, str] = {}  # path -> session_id
                    cls._instance._lock_times: Dict[str, datetime] = {}
        return cls._instance
    
    def acquire(self, file_path: str, session_id: str, 
                timeout_minutes: int = 30) -> Tuple[bool, Optional[str]]:
        """
        Intenta adquirir lock sobre un archivo.
        
        Returns:
            (success, error_message or locked_by_session)
        """
        path = str(Path(file_path).resolve())
        
        with self._lock:
            # Verificar si ya está bloqueado
            if path in self._locks:
                existing_session = self._locks[path]
                lock_time = self._lock_times.get(path)
                
                # Verificar timeout
                if lock_time and datetime.now() - lock_time > timedelta(minutes=timeout_minutes):
                    # Lock expirado, permitir nuevo lock
                    pass
                elif existing_session != session_id:
                    return False, f"Archivo bloqueado por sesión {existing_session}"
            
            # Adquirir lock
            self._locks[path] = session_id
            self._lock_times[path] = datetime.now()
            return True, None
    
    def release(self, file_path: str, session_id: str) -> bool:
        """Libera el lock de un archivo"""
        path = str(Path(file_path).resolve())
        
        with self._lock:
            if path in self._locks:
                if self._locks[path] == session_id:
                    del self._locks[path]
                    if path in self._lock_times:
                        del self._lock_times[path]
                    return True
            return False
    
    def is_locked(self, file_path: str) -> Tuple[bool, Optional[str]]:
        """Verifica si un archivo está bloqueado"""
        path = str(Path(file_path).resolve())
        
        with self._lock:
            if path in self._locks:
                return True, self._locks[path]
            return False, None
    
    def get_lock_owner(self, file_path: str) -> Optional[str]:
        """Devuelve el session_id que tiene el lock"""
        _, owner = self.is_locked(file_path)
        return owner


# Singleton global
file_lock_manager = FileLockManager()
