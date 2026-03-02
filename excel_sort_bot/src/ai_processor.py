"""
Módulo de Procesamiento de IA usando OpenAI
Interpreta comandos en lenguaje natural para manipular el Excel
Usa Structured Outputs con JSON Schema estricto
VERSION 2.0 - Con soporte de recinto y separación cultivo/municipio
"""
import os
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pathlib import Path
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
from openai import OpenAI

# Cargar variables de entorno
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# Cliente OpenAI
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key else None

# Timezone para resolver fechas
MADRID_TZ = ZoneInfo("Europe/Madrid")

# ========================================
# JSON Schema Maestro - TreatmentIntent v2
# CON SOPORTE DE RECINTO
# ========================================
TREATMENT_INTENT_SCHEMA = {
    "name": "treatment_intent_v2",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["action", "filters", "data"],
        "properties": {
            "action": {
                "type": "string",
                "enum": ["ADD_TREATMENT"]
            },
            "filters": {
                "type": "object",
                "additionalProperties": False,
                "required": ["logic", "targets"],
                "properties": {
                    "logic": {
                        "type": "string",
                        "enum": ["AND", "OR"]
                    },
                    "targets": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": [
                            "scope", "crop", "municipio", "polygon", "parcel", "recinto",
                            "exclude_polygon", "exclude_parcel", "exclude_recinto", "custom_query"
                        ],
                        "properties": {
                            "scope": {
                                "type": "string",
                                "description": "Alcance de selección de parcelas",
                                "enum": ["ALL", "BY_CROP", "BY_MUNICIPIO", "BY_IDS", "BY_POLYGON", "BY_POLYGON_AND_PARCEL", "CUSTOM_QUERY"]
                            },
                            "crop": {
                                "type": ["string", "null"],
                                "description": "Cultivo objetivo (CEBADA, TRIGO, GIRASOL, VID/VIÑEDO, OLIVO, etc). Null si no aplica."
                            },
                            "municipio": {
                                "type": ["string", "null"],
                                "description": "Municipio objetivo (ej: '175-MACOTERA'). Null si no aplica. NO confundir con cultivo."
                            },
                            "polygon": {
                                "type": ["array", "null"],
                                "items": {"type": "integer", "minimum": 0},
                                "description": "Lista de polígonos. Null si no se especifica."
                            },
                            "parcel": {
                                "type": ["array", "null"],
                                "items": {"type": "integer", "minimum": 0},
                                "description": "Lista de parcelas. Null si no se especifica."
                            },
                            "recinto": {
                                "type": ["array", "null"],
                                "items": {"type": "integer", "minimum": 0},
                                "description": "Lista de recintos específicos. Null para aplicar a todos los recintos."
                            },
                            "exclude_polygon": {
                                "type": ["array", "null"],
                                "items": {"type": "integer", "minimum": 0},
                                "description": "Polígonos a excluir. Null si no aplica."
                            },
                            "exclude_parcel": {
                                "type": ["array", "null"],
                                "items": {"type": "integer", "minimum": 0},
                                "description": "Parcelas a excluir. Null si no aplica."
                            },
                            "exclude_recinto": {
                                "type": ["array", "null"],
                                "items": {"type": "integer", "minimum": 0},
                                "description": "Recintos a excluir. Null si no aplica."
                            },
                            "custom_query": {
                                "type": ["string", "null"],
                                "description": "Consulta humana no estructurada. Null si no aplica."
                            }
                        }
                    }
                }
            },
            "data": {
                "type": "object",
                "additionalProperties": False,
                "required": ["product", "registry_number", "dose", "date", "pest", "notes"],
                "properties": {
                    "product": {
                        "type": "string",
                        "minLength": 1,
                        "description": "Nombre del producto o materia activa."
                    },
                    "registry_number": {
                        "type": ["string", "null"],
                        "description": "Nº registro si el usuario lo proporciona. Null si no se menciona."
                    },
                    "dose": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["value", "unit"],
                        "properties": {
                            "value": {"type": "number", "minimum": 0},
                            "unit": {
                                "type": "string",
                                "enum": ["l/ha", "ml/ha", "kg/ha", "g/ha", "%", "l/hl", "kg/hl", "g/l", "ml/l"]
                            }
                        }
                    },
                    "date": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["kind", "value", "n_days"],
                        "properties": {
                            "kind": {
                                "type": "string",
                                "enum": ["ABSOLUTE", "RELATIVE"]
                            },
                            "value": {
                                "type": "string",
                                "description": "Si ABSOLUTE -> 'DD/MM/YYYY'. Si RELATIVE -> 'today'|'yesterday'|'tomorrow'|'in_N_days'|'N_days_ago'."
                            },
                            "n_days": {
                                "type": ["integer", "null"],
                                "description": "Solo si value es in_N_days o N_days_ago. Null en otros casos."
                            }
                        }
                    },
                    "pest": {
                        "type": ["string", "null"],
                        "description": "Plaga/Enfermedad objetivo. Null si no se menciona."
                    },
                    "notes": {
                        "type": ["string", "null"],
                        "description": "Observaciones adicionales. Null si no hay."
                    }
                }
            }
        }
    }
}


class AIProcessor:
    """
    Procesador de IA con Structured Outputs v2
    Soporta: cultivo, municipio, recinto, exclusiones
    """
    
    def __init__(self):
        if not client:
            print("⚠️ ADVERTENCIA: No se encontró OPENAI_API_KEY en .env")
    
    def interpret_command(self, message: str, context: Dict[str, List[str]]) -> Dict[str, Any]:
        """
        Interpreta un comando de usuario usando Structured Outputs.
        
        Args:
            message: El texto del usuario
            context: {"crops": [...], "municipios": [...]} - datos disponibles
            
        Returns:
            Dict con el TreatmentIntent estructurado o {"error": ...}
        """
        if not client:
            return {"error": "API Key de OpenAI no configurada"}
        
        crops = context.get("crops", [])
        municipios = context.get("municipios", [])
        
        today = datetime.now(MADRID_TZ).strftime("%d/%m/%Y")
        
        system_prompt = f"""Eres un asistente experto en agronomía para un Cuaderno de Campo Agrícola español.
Tu trabajo es interpretar órdenes de texto para registrar tratamientos fitosanitarios.

IMPORTANTE - DISTINGUIR CULTIVO DE MUNICIPIO:
- CULTIVOS (plantas): {', '.join(crops) if crops else 'CEBADA, TRIGO, GIRASOL, VID, OLIVO, ALMENDRO, BARBECHO, MAIZ'}
- MUNICIPIOS (ubicaciones): {', '.join(municipios) if municipios else 'No especificados'}

REGLAS DE SCOPE (MUY IMPORTANTES):
1. Si menciona un CULTIVO (cebada, trigo, viñedo, olivos, etc):
   → scope="BY_CROP", crop="<CULTIVO>"
   
2. Si menciona POLÍGONO Y PARCELA juntos:
   → scope="BY_POLYGON_AND_PARCEL", polygon=[X], parcel=[Y]
   
3. Si SOLO menciona polígono (sin parcela):
   → scope="BY_POLYGON", polygon=[X]
   
4. Si menciona un MUNICIPIO (Macotera, Coca de Alba, etc):
   → scope="BY_MUNICIPIO", municipio="<MUNICIPIO>"
   
5. Si dice "todas las parcelas" sin especificar filtro:
   → scope="ALL"

EJEMPLOS CRÍTICOS (aprende de estos):
- "en todas las cebadas" → scope=BY_CROP, crop="CEBADA"
- "en los viñedos" → scope=BY_CROP, crop="VID" o "VIÑEDO"
- "en polígono 502 parcela 5334" → scope=BY_POLYGON_AND_PARCEL, polygon=[502], parcel=[5334]
- "en polígono 501" (sin parcela) → scope=BY_POLYGON, polygon=[501]
- "en MACOTERA" → scope=BY_MUNICIPIO, municipio="175-MACOTERA"
- "en todas las parcelas de MACOTERA" → scope=BY_MUNICIPIO, municipio="175-MACOTERA"
- "parcelas de Coca de Alba" → scope=BY_MUNICIPIO, municipio="108-COCA DE ALBA"
- "todo el trigo de MACOTERA" → scope=BY_CROP, crop="TRIGO", municipio="175-MACOTERA" (usar logic=AND)

OTRAS REGLAS:
- Fecha actual (Europe/Madrid): {today}
- "hoy" → kind="RELATIVE", value="today"
- "ayer" → kind="RELATIVE", value="yesterday"
- "hace 3 días" → kind="RELATIVE", value="N_days_ago", n_days=3
- Si no menciona plaga, infiere: Glifosato→"Malas hierbas", Cobre→"Hongos", Azufre→"Oídio/Hongos"
- Si dice "recinto X" → recinto=[X]
- Si dice "excepto recinto X" → exclude_recinto=[X]
- NUNCA confundas municipio con cultivo."""

        user_content = f"Comando del agricultor: \"{message}\""

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                response_format={
                    "type": "json_schema",
                    "json_schema": TREATMENT_INTENT_SCHEMA
                },
                temperature=0.1
            )
            
            content = response.choices[0].message.content
            return json.loads(content)
            
        except Exception as e:
            return {"error": f"Error al procesar con IA: {str(e)}"}


def resolve_date(date_obj: Dict[str, Any]) -> str:
    """
    Resuelve una fecha relativa o absoluta a formato DD/MM/YYYY
    """
    now = datetime.now(MADRID_TZ)
    
    if date_obj.get("kind") == "ABSOLUTE":
        try:
            datetime.strptime(date_obj["value"], "%d/%m/%Y")
            return date_obj["value"]
        except ValueError:
            for fmt in ["%Y-%m-%d", "%d-%m-%Y"]:
                try:
                    dt = datetime.strptime(date_obj["value"], fmt)
                    return dt.strftime("%d/%m/%Y")
                except ValueError:
                    continue
            return now.strftime("%d/%m/%Y")
    
    # RELATIVE
    value = (date_obj.get("value") or "today").lower()
    n_days = date_obj.get("n_days") or 0
    
    if value == "today":
        target = now
    elif value == "yesterday":
        target = now - timedelta(days=1)
    elif value == "tomorrow":
        target = now + timedelta(days=1)
    elif value == "n_days_ago" and n_days:
        target = now - timedelta(days=n_days)
    elif value == "in_n_days" and n_days:
        target = now + timedelta(days=n_days)
    else:
        target = now
    
    return target.strftime("%d/%m/%Y")


# Instancia global
ai_processor = AIProcessor()
