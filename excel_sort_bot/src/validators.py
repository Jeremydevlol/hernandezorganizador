"""
Validadores para verificar la correctitud de los datos extraídos
"""
import re
from typing import Any, Optional
from datetime import date

from .types import ValidationError, FieldConfig


# ============================================================
# VALIDADORES INDIVIDUALES
# ============================================================

def validate_required(value: Any, field: FieldConfig) -> Optional[ValidationError]:
    """Valida que un campo requerido tenga valor"""
    if not field.required:
        return None
    
    if value is None or (isinstance(value, str) and not value.strip()):
        return ValidationError(
            field_key=field.key,
            error_type="required_missing",
            message=f"Campo obligatorio '{field.key}' no encontrado o vacío",
            raw_value=value
        )
    
    return None


def validate_nif_nie_format(value: Any) -> Optional[str]:
    """
    Valida el formato de un NIF/NIE español
    
    Returns:
        None si es válido, mensaje de error si no lo es
    """
    if value is None:
        return None
    
    text = str(value).strip().upper()
    text = re.sub(r'[^A-Z0-9]', '', text)
    
    if len(text) < 8 or len(text) > 9:
        return f"Longitud inválida: {len(text)} caracteres"
    
    nif_letters = "TRWAGMYFPDXBNJZSQVHLCKE"
    
    # Determinar tipo y extraer partes
    if text[0] in 'XYZ':
        # NIE
        nie_map = {'X': '0', 'Y': '1', 'Z': '2'}
        number_part = nie_map[text[0]] + text[1:-1]
        check_letter = text[-1]
    elif text[0].isdigit():
        # NIF
        number_part = text[:-1]
        check_letter = text[-1]
    elif text[0] in 'ABCDEFGHJKLMNPQRSUVW':
        # CIF de sociedad - validación diferente
        return None  # Por ahora aceptar
    else:
        return f"Primer carácter inválido: {text[0]}"
    
    try:
        number = int(number_part)
        expected_letter = nif_letters[number % 23]
        
        if check_letter != expected_letter:
            return f"Letra de control incorrecta: esperada {expected_letter}, encontrada {check_letter}"
        
        return None  # Válido
    except ValueError:
        return f"Parte numérica inválida: {number_part}"


def validate_is_numeric(value: Any) -> Optional[str]:
    """Valida que un valor sea numérico"""
    if value is None:
        return None
    
    if isinstance(value, (int, float)):
        return None
    
    try:
        float(value)
        return None
    except (ValueError, TypeError):
        return f"Valor no numérico: {value}"


def validate_is_date(value: Any) -> Optional[str]:
    """Valida que un valor sea una fecha"""
    if value is None:
        return None
    
    if isinstance(value, date):
        return None
    
    return f"Valor no es una fecha válida: {value}"


def validate_range(value: Any, min_val: Optional[float] = None, 
                   max_val: Optional[float] = None) -> Optional[str]:
    """Valida que un valor numérico esté en un rango"""
    if value is None:
        return None
    
    try:
        num = float(value)
        if min_val is not None and num < min_val:
            return f"Valor {num} menor que mínimo {min_val}"
        if max_val is not None and num > max_val:
            return f"Valor {num} mayor que máximo {max_val}"
        return None
    except (ValueError, TypeError):
        return f"No se puede validar rango de: {value}"


def validate_tolerance(actual: float, expected: float, 
                       tolerance: float = 0.02) -> Optional[str]:
    """Valida que dos valores estén dentro de una tolerancia"""
    diff = abs(actual - expected)
    if diff > tolerance:
        return f"Diferencia {diff:.4f} excede tolerancia {tolerance}"
    return None


# ============================================================
# VALIDADOR PRINCIPAL
# ============================================================

class Validator:
    """Validador de campos extraídos"""
    
    def __init__(self, strict: bool = False):
        """
        Args:
            strict: Si True, cualquier error detiene el proceso
        """
        self.strict = strict
        self.errors: list[ValidationError] = []
        self.warnings: list[str] = []
    
    def validate_field(self, value: Any, field: FieldConfig, 
                       source_sheet: Optional[str] = None,
                       source_cell: Optional[str] = None) -> bool:
        """
        Valida un campo y registra errores
        
        Returns:
            True si pasa todas las validaciones
        """
        is_valid = True
        
        # 1. Validar campo requerido
        error = validate_required(value, field)
        if error:
            error.source_sheet = source_sheet
            error.source_cell = source_cell
            self.errors.append(error)
            is_valid = False
            if self.strict:
                return False
        
        # 2. Validaciones específicas por transformaciones
        if value is not None and "validate_nif_nie" in field.transforms:
            nif_error = validate_nif_nie_format(value)
            if nif_error:
                self.warnings.append(f"NIF/NIE '{value}' puede ser inválido: {nif_error}")
        
        if value is not None and "parse_money" in field.transforms:
            num_error = validate_is_numeric(value)
            if num_error:
                self.errors.append(ValidationError(
                    field_key=field.key,
                    error_type="invalid_number",
                    message=f"Campo '{field.key}' debe ser numérico: {num_error}",
                    source_sheet=source_sheet,
                    source_cell=source_cell,
                    raw_value=value
                ))
                is_valid = False
        
        if value is not None and "parse_date" in field.transforms:
            date_error = validate_is_date(value)
            if date_error:
                self.errors.append(ValidationError(
                    field_key=field.key,
                    error_type="invalid_date",
                    message=f"Campo '{field.key}' debe ser fecha válida: {date_error}",
                    source_sheet=source_sheet,
                    source_cell=source_cell,
                    raw_value=value
                ))
                is_valid = False
        
        return is_valid
    
    def validate_totals(self, items: list[float], total: float,
                        tolerance: float = 0.02) -> bool:
        """
        Valida que la suma de items coincida con el total
        """
        calculated = sum(items)
        error = validate_tolerance(calculated, total, tolerance)
        
        if error:
            self.warnings.append(
                f"Suma de items ({calculated:.2f}) no coincide con total ({total:.2f}): {error}"
            )
            return False
        
        return True
    
    def has_errors(self) -> bool:
        """Devuelve True si hay errores"""
        return len(self.errors) > 0
    
    def get_errors_dict(self) -> list[dict]:
        """Convierte errores a diccionarios para JSON"""
        return [
            {
                "field": e.field_key,
                "type": e.error_type,
                "message": e.message,
                "source_sheet": e.source_sheet,
                "source_cell": e.source_cell,
                "raw_value": str(e.raw_value) if e.raw_value else None
            }
            for e in self.errors
        ]
    
    def clear(self):
        """Limpia errores y warnings"""
        self.errors = []
        self.warnings = []
