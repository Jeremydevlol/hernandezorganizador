"""
Tipos y estructuras de datos para el Hernandez Bueno Sort Bot
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Any
from datetime import datetime


class SourceType(Enum):
    """Tipo de estrategia de extracción"""
    LABEL = "label"
    PATTERN = "pattern"
    LABEL_OR_PATTERN = "label_or_pattern"
    TABLE = "table"
    COPY_FROM = "copy_from"  # Copiar de otro campo ya extraído


class TakeDirection(Enum):
    """Dirección para tomar el valor después de encontrar una etiqueta"""
    RIGHT = "right"
    DOWN = "down"
    LEFT = "left"
    UP = "up"


class LogStatus(Enum):
    """Estado del log de extracción"""
    OK = "OK"
    WARN = "WARN"
    ERROR = "ERROR"


class PatternType(Enum):
    """Tipos de patrones soportados"""
    NIF_NIE = "nif_nie"
    MONEY = "money"
    DATE = "date"
    EMAIL = "email"
    PHONE = "phone"
    POSTAL_CODE = "postal_code"


@dataclass
class SourceConfig:
    """Configuración de cómo encontrar un campo en el Excel base"""
    type: SourceType
    labels: list[str] = field(default_factory=list)
    take: TakeDirection = TakeDirection.RIGHT
    max_distance: int = 2
    patterns: list[str] = field(default_factory=list)
    sheet_hint: Optional[str] = None  # Nombre de hoja donde buscar preferentemente
    copy_field: Optional[str] = None  # Campo del que copiar (para COPY_FROM)


@dataclass
class TargetConfig:
    """Configuración de dónde escribir en la plantilla"""
    sheet: str
    cell: str


@dataclass
class FieldConfig:
    """Configuración completa de un campo"""
    key: str
    required: bool
    source: SourceConfig
    target: TargetConfig
    transforms: list[str] = field(default_factory=list)
    description: str = ""


@dataclass
class MappingMeta:
    """Metadatos del mapping"""
    template_default_sheet: str = "Resumen"
    log_sheet_name: str = "LOG"
    version: str = "1.0"


@dataclass
class MappingConfig:
    """Configuración completa del mapping"""
    meta: MappingMeta
    fields: list[FieldConfig]


@dataclass
class ExtractedValue:
    """Valor extraído del Excel base"""
    key: str
    raw_value: Any
    transformed_value: Any
    source_sheet: str
    source_cell: str
    extraction_method: str  # "label", "pattern", "table", etc.
    confidence: float = 1.0  # 0-1, confianza en la extracción


@dataclass
class LogEntry:
    """Entrada de log para un campo"""
    timestamp: datetime
    field_key: str
    status: LogStatus
    extraction_method: str
    raw_value: Any
    transformed_value: Any
    source_sheet: Optional[str] = None
    source_cell: Optional[str] = None
    target_sheet: Optional[str] = None
    target_cell: Optional[str] = None
    message: str = ""


@dataclass
class ValidationError:
    """Error de validación"""
    field_key: str
    error_type: str
    message: str
    source_sheet: Optional[str] = None
    source_cell: Optional[str] = None
    raw_value: Any = None


@dataclass
class ProcessingResult:
    """Resultado del procesamiento de un archivo"""
    input_file: str
    output_file: str
    success: bool
    extracted_values: list[ExtractedValue]
    log_entries: list[LogEntry]
    errors: list[ValidationError]
    warnings: list[str] = field(default_factory=list)
