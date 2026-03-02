"""
Transformadores de datos para normalización y conversión
"""
import re
from typing import Any, Optional, Callable
from datetime import datetime, date
from decimal import Decimal, InvalidOperation


# ============================================================
# TRANSFORMADORES INDIVIDUALES
# ============================================================

def transform_strip(value: Any) -> Any:
    """Elimina espacios al inicio y final"""
    if isinstance(value, str):
        return value.strip()
    return value


def transform_uppercase(value: Any) -> Any:
    """Convierte a mayúsculas"""
    if isinstance(value, str):
        return value.upper()
    return value


def transform_lowercase(value: Any) -> Any:
    """Convierte a minúsculas"""
    if isinstance(value, str):
        return value.lower()
    return value


def transform_title_case(value: Any) -> Any:
    """Convierte a Title Case"""
    if isinstance(value, str):
        return value.title()
    return value


def transform_parse_money(value: Any) -> Optional[float]:
    """
    Parsea un valor monetario a float
    
    Acepta formatos:
    - 1.234,56 (español)
    - 1,234.56 (inglés)
    - €1234.56
    - 1234 EUR
    """
    if value is None:
        return None
    
    if isinstance(value, (int, float)):
        return float(value)
    
    text = str(value).strip()
    
    # Quitar símbolos de moneda
    text = re.sub(r'[€$]|\s*EUR\s*|\s*USD\s*', '', text, flags=re.IGNORECASE)
    text = text.strip()
    
    if not text:
        return None
    
    # Detectar formato español (1.234,56) vs inglés (1,234.56)
    # Contar puntos y comas
    dots = text.count('.')
    commas = text.count(',')
    
    # Encontrar la posición del último punto y última coma
    last_dot = text.rfind('.')
    last_comma = text.rfind(',')
    
    if dots >= 1 and commas >= 1:
        # Tiene ambos, determinar cuál es el decimal
        if last_comma > last_dot:
            # Coma después del punto: formato español (1.234,56)
            text = text.replace('.', '').replace(',', '.')
        else:
            # Punto después de la coma: formato inglés (1,234.56)
            text = text.replace(',', '')
    elif commas == 1 and dots == 0:
        # Solo coma decimal: 1234,56 -> coma a punto
        text = text.replace(',', '.')
    elif dots == 1 and commas == 0:
        # Solo punto decimal: 1234.56 -> ya está bien
        pass
    elif commas > 1 and dots == 0:
        # Múltiples comas como separador de miles, última es decimal
        # Ej: 1,234,56 - poco común pero posible
        parts = text.split(',')
        if len(parts[-1]) <= 2:
            # Última parte parece decimal
            text = ''.join(parts[:-1]) + '.' + parts[-1]
        else:
            text = text.replace(',', '')
    
    # Quitar espacios restantes
    text = text.replace(' ', '')
    
    try:
        return float(text)
    except ValueError:
        return None


def transform_round_2(value: Any) -> Optional[float]:
    """Redondea a 2 decimales"""
    if value is None:
        return None
    try:
        return round(float(value), 2)
    except (ValueError, TypeError):
        return None


def transform_parse_date(value: Any) -> Optional[date]:
    """
    Parsea una fecha de diversos formatos
    
    Acepta:
    - datetime de Excel
    - dd/mm/yyyy
    - dd-mm-yyyy
    - yyyy-mm-dd
    """
    if value is None:
        return None
    
    if isinstance(value, datetime):
        return value.date()
    
    if isinstance(value, date):
        return value
    
    text = str(value).strip()
    
    # Formatos a probar
    formats = [
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%Y-%m-%d",
        "%d/%m/%y",
        "%d-%m-%y",
        "%Y/%m/%d",
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    
    # Intentar parsear formato ISO con hora
    try:
        if 'T' in text or ' ' in text:
            return datetime.fromisoformat(text.replace(' ', 'T').split('T')[0]).date()
    except ValueError:
        pass
    
    return None


def transform_validate_nif_nie(value: Any) -> Any:
    """
    Valida y normaliza un NIF/NIE español
    
    Returns:
        El NIF/NIE normalizado (sin separadores) si es válido
    """
    if value is None:
        return None
    
    text = str(value).strip().upper()
    
    # Primero limpiar separadores (guiones, espacios, puntos)
    text = re.sub(r'[-\s./]', '', text)
    
    # Limpiar caracteres no alfanuméricos restantes
    text = re.sub(r'[^A-Z0-9]', '', text)
    
    # Validar longitud
    if len(text) < 8 or len(text) > 9:
        return value  # Devolver sin cambios
    
    # Algoritmo de validación NIF/NIE
    nif_letters = "TRWAGMYFPDXBNJZSQVHLCKE"
    
    if text[0] in 'XYZ':
        # NIE: reemplazar primera letra
        nie_map = {'X': '0', 'Y': '1', 'Z': '2'}
        number_part = nie_map[text[0]] + text[1:-1]
        check_letter = text[-1]
    elif text[0].isdigit():
        # NIF normal
        number_part = text[:-1]
        check_letter = text[-1]
    else:
        # Otro formato (sociedades, etc.)
        return text
    
    try:
        number = int(number_part)
        expected_letter = nif_letters[number % 23]
        
        if check_letter == expected_letter:
            return text  # Válido
        else:
            # Inválido pero devolver normalizado
            return text
    except ValueError:
        return value


def transform_empty_to_none(value: Any) -> Any:
    """Convierte strings vacíos a None"""
    if isinstance(value, str) and not value.strip():
        return None
    return value


def transform_to_text(value: Any) -> str:
    """Convierte cualquier valor a texto"""
    if value is None:
        return ""
    return str(value)


def transform_clean_nif(value: Any) -> Any:
    """Limpia un NIF/NIE quitando separadores y normalizando"""
    if value is None:
        return None
    
    text = str(value).strip().upper()
    # Quitar guiones, espacios y otros separadores
    text = re.sub(r'[-\s./]', '', text)
    return text


# ============================================================
# REGISTRY Y PIPELINE
# ============================================================

# Registro de transformadores disponibles
TRANSFORM_REGISTRY: dict[str, Callable] = {
    "strip": transform_strip,
    "uppercase": transform_uppercase,
    "lowercase": transform_lowercase,
    "title_case": transform_title_case,
    "parse_money": transform_parse_money,
    "round_2": transform_round_2,
    "parse_date": transform_parse_date,
    "validate_nif_nie": transform_validate_nif_nie,
    "empty_to_none": transform_empty_to_none,
    "to_text": transform_to_text,
    "clean_nif": transform_clean_nif,
}


def apply_transforms(value: Any, transforms: list[str]) -> Any:
    """
    Aplica una lista de transformaciones en orden
    
    Args:
        value: Valor inicial
        transforms: Lista de nombres de transformadores
        
    Returns:
        Valor transformado
    """
    result = value
    
    for transform_name in transforms:
        if transform_name not in TRANSFORM_REGISTRY:
            print(f"[Warning] Transformador desconocido: {transform_name}")
            continue
        
        transformer = TRANSFORM_REGISTRY[transform_name]
        try:
            result = transformer(result)
        except Exception as e:
            print(f"[Warning] Error aplicando {transform_name}: {e}")
            # Continuar con el valor actual
    
    return result


def register_transform(name: str, func: Callable):
    """Registra un nuevo transformador"""
    TRANSFORM_REGISTRY[name] = func
