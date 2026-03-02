"""
Tests para parsers y transformadores del Hernandez Bueno Sort Bot
"""
import pytest
from datetime import date
import sys
from pathlib import Path

# Añadir src al path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.transformers import (
    transform_parse_money,
    transform_parse_date,
    transform_validate_nif_nie,
    transform_strip,
    transform_uppercase,
    transform_title_case,
    transform_clean_nif,
    apply_transforms
)
from src.validators import validate_nif_nie_format
from src.extractors import normalize_text, labels_match, extract_by_pattern


class TestParseMoney:
    """Tests para parse_money"""
    
    def test_integer(self):
        assert transform_parse_money(1234) == 1234.0
    
    def test_float(self):
        assert transform_parse_money(1234.56) == 1234.56
    
    def test_spanish_format(self):
        """Formato español: 1.234,56"""
        assert transform_parse_money("1.234,56") == 1234.56
    
    def test_spanish_format_thousands(self):
        """Formato español con miles: 12.345.678,90"""
        assert transform_parse_money("12.345.678,90") == 12345678.90
    
    def test_english_format(self):
        """Formato inglés: 1,234.56"""
        assert transform_parse_money("1,234.56") == 1234.56
    
    def test_with_euro_symbol_before(self):
        """Con símbolo € antes"""
        assert transform_parse_money("€1234.56") == 1234.56
    
    def test_with_euro_symbol_after(self):
        """Con símbolo € después"""
        assert transform_parse_money("1234.56€") == 1234.56
    
    def test_with_eur(self):
        """Con EUR"""
        assert transform_parse_money("1234.56 EUR") == 1234.56
    
    def test_comma_decimal(self):
        """Solo coma decimal"""
        assert transform_parse_money("1234,56") == 1234.56
    
    def test_dot_decimal(self):
        """Solo punto decimal"""
        assert transform_parse_money("1234.56") == 1234.56
    
    def test_integer_string(self):
        """Entero como string"""
        assert transform_parse_money("1234") == 1234.0
    
    def test_none(self):
        """None devuelve None"""
        assert transform_parse_money(None) is None
    
    def test_empty_string(self):
        """String vacío devuelve None"""
        assert transform_parse_money("") is None
    
    def test_spaces(self):
        """Con espacios"""
        result = transform_parse_money("  1234.56  ")
        assert result == 1234.56


class TestParseDate:
    """Tests para parse_date"""
    
    def test_datetime_object(self):
        """Objeto datetime"""
        from datetime import datetime
        dt = datetime(2024, 10, 15, 12, 30)
        result = transform_parse_date(dt)
        assert result == date(2024, 10, 15)
    
    def test_date_object(self):
        """Objeto date"""
        d = date(2024, 10, 15)
        result = transform_parse_date(d)
        assert result == date(2024, 10, 15)
    
    def test_spanish_format_slash(self):
        """Formato dd/mm/yyyy"""
        result = transform_parse_date("15/10/2024")
        assert result == date(2024, 10, 15)
    
    def test_spanish_format_dash(self):
        """Formato dd-mm-yyyy"""
        result = transform_parse_date("15-10-2024")
        assert result == date(2024, 10, 15)
    
    def test_iso_format(self):
        """Formato yyyy-mm-dd"""
        result = transform_parse_date("2024-10-15")
        assert result == date(2024, 10, 15)
    
    def test_short_year(self):
        """Año corto dd/mm/yy"""
        result = transform_parse_date("15/10/24")
        # Nota: años < 100 se interpretan como 19xx o 20xx según la librería
        assert result is not None
    
    def test_none(self):
        """None devuelve None"""
        assert transform_parse_date(None) is None
    
    def test_invalid_date(self):
        """Fecha inválida devuelve None"""
        result = transform_parse_date("not a date")
        assert result is None


class TestValidateNifNie:
    """Tests para validación de NIF/NIE"""
    
    def test_valid_nif_known(self):
        """NIF válido conocido"""
        # 12345678Z es un NIF válido
        result = validate_nif_nie_format("12345678Z")
        assert result is None  # None = válido
    
    def test_valid_nie_x(self):
        """NIE válido con X"""
        # X1234567L es un ejemplo
        result = validate_nif_nie_format("X0000000T")
        assert result is None
    
    def test_invalid_nif_wrong_letter(self):
        """NIF con letra incorrecta"""
        result = validate_nif_nie_format("12345678A")  # Z es la correcta
        assert result is not None  # Tiene error
    
    def test_transform_cleans_separators(self):
        """El transformador limpia separadores"""
        result = transform_clean_nif("12-345-678-Z")
        assert result == "12345678Z"
    
    def test_transform_with_separators(self):
        """NIF con separadores"""
        # Usar un NIF válido de 9 caracteres
        result = transform_validate_nif_nie("12-345-678-Z")
        # El transformador ahora limpia los separadores
        assert result == "12345678Z"
    
    def test_short_nif(self):
        """NIF muy corto"""
        result = validate_nif_nie_format("1234A")
        assert result is not None
    
    def test_none(self):
        """None devuelve None"""
        result = validate_nif_nie_format(None)
        assert result is None


class TestNormalizeText:
    """Tests para normalización de texto"""
    
    def test_lowercase(self):
        """Convierte a minúsculas"""
        assert normalize_text("HOLA MUNDO") == "hola mundo"
    
    def test_remove_accents(self):
        """Quita tildes"""
        assert normalize_text("España") == "espana"
        assert normalize_text("Año") == "ano"
        assert normalize_text("Dirección") == "direccion"
    
    def test_strip(self):
        """Quita espacios"""
        assert normalize_text("  hola  ") == "hola"
    
    def test_multiple_spaces(self):
        """Colapsa espacios múltiples"""
        assert normalize_text("hola    mundo") == "hola mundo"
    
    def test_empty(self):
        """String vacío"""
        assert normalize_text("") == ""
    
    def test_none_like(self):
        """None-like values"""
        assert normalize_text("") == ""


class TestLabelsMatch:
    """Tests para coincidencia de etiquetas"""
    
    def test_exact_match(self):
        """Coincidencia exacta"""
        assert labels_match("NIF", ["NIF", "NIE"]) is True
    
    def test_case_insensitive(self):
        """Insensible a mayúsculas"""
        assert labels_match("nif", ["NIF"]) is True
        assert labels_match("NIF", ["nif"]) is True
    
    def test_with_accents(self):
        """Con tildes"""
        assert labels_match("Dirección", ["direccion", "address"]) is True
    
    def test_partial_match(self):
        """Coincidencia parcial"""
        assert labels_match("NIF: 12345678Z", ["NIF"]) is True
    
    def test_no_match(self):
        """Sin coincidencia"""
        assert labels_match("Email", ["NIF", "NIE"]) is False
    
    def test_empty_labels(self):
        """Lista de etiquetas vacía"""
        assert labels_match("NIF", []) is False


class TestPatternExtraction:
    """Tests para extracción por patrón"""
    
    def test_nif_pattern(self):
        """Patrón NIF"""
        result = extract_by_pattern("Mi NIF es 12345678Z", "nif_nie")
        assert result is not None
        assert "12345678Z" in result
    
    def test_nie_pattern(self):
        """Patrón NIE"""
        result = extract_by_pattern("NIE: X1234567L", "nif_nie")
        assert result is not None
    
    def test_email_pattern(self):
        """Patrón email"""
        result = extract_by_pattern("Contacto: test@example.com", "email")
        assert result == "test@example.com"
    
    def test_phone_pattern(self):
        """Patrón teléfono español"""
        result = extract_by_pattern("Tel: 666123456", "phone")
        assert result is not None
    
    def test_postal_code(self):
        """Código postal español"""
        result = extract_by_pattern("CP: 28001", "postal_code")
        assert result == "28001"
    
    def test_money_pattern(self):
        """Patrón dinero"""
        result = extract_by_pattern("Total: 1.234,56€", "money")
        assert result is not None


class TestApplyTransforms:
    """Tests para aplicación de transformaciones en cadena"""
    
    def test_single_transform(self):
        """Una sola transformación"""
        result = apply_transforms("  hello  ", ["strip"])
        assert result == "hello"
    
    def test_chain_transforms(self):
        """Cadena de transformaciones"""
        result = apply_transforms("  hello world  ", ["strip", "uppercase"])
        assert result == "HELLO WORLD"
    
    def test_money_and_round(self):
        """Parse money y redondear"""
        result = apply_transforms("1.234,567", ["parse_money", "round_2"])
        assert result == 1234.57
    
    def test_unknown_transform(self):
        """Transformación desconocida se ignora"""
        result = apply_transforms("hello", ["unknown_transform", "uppercase"])
        assert result == "HELLO"
    
    def test_empty_transforms(self):
        """Sin transformaciones"""
        result = apply_transforms("hello", [])
        assert result == "hello"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
