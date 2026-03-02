"""
Test de regresión para el Hernandez Bueno Sort Bot
Compara el output generado contra el fixture esperado
"""
import pytest
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

import openpyxl


# Celdas clave a verificar
CELDAS_CRITICAS = [
    # (hoja, celda, descripción, tipo_esperado)
    ('inf.gral 1', 'E6', 'Fecha apertura', 'date'),
    ('inf.gral 1', 'M6', 'Año', 'number'),
    ('inf.gral 1', 'D9', 'Nombre titular', 'text'),
    ('inf.gral 1', 'L9', 'NIF titular', 'text'),
    ('inf.gral 1', 'L10', 'Registro autonómico', 'number'),
    ('inf.gral 1', 'B11', 'Dirección', 'text'),
    ('inf.gral 1', 'G11', 'Localidad', 'text'),
    ('inf.gral 1', 'J11', 'Código postal', 'number'),
    ('inf.gral 1', 'M11', 'Provincia', 'text'),
    ('inf.gral 1', 'B12', 'Teléfono fijo', 'number'),
    ('inf.gral 1', 'F12', 'Teléfono móvil', 'number'),
    ('inf.gral 1', 'I12', 'Email', 'text'),
    ('inf.gral 2', 'I1', 'Año inf.gral 2', 'number'),
    ('inf.gral 2', 'B10', 'Aplicador nombre', 'text'),
    ('inf.gral 2', 'C10', 'Aplicador NIF', 'text'),
]


class TestRegression:
    """Tests de regresión contra fixture esperado"""
    
    @pytest.fixture
    def expected_workbook(self):
        """Carga el fixture esperado"""
        fixture_path = Path(__file__).parent.parent / 'fixtures' / 'expected_output.xlsx'
        if not fixture_path.exists():
            pytest.skip(f"Fixture no encontrado: {fixture_path}")
        return openpyxl.load_workbook(str(fixture_path), data_only=True)
    
    @pytest.fixture  
    def actual_workbook(self):
        """Carga el output actual (debe generarse antes de correr tests)"""
        output_path = Path(__file__).parent.parent / 'output_final.xlsx'
        if not output_path.exists():
            pytest.skip(f"Output no encontrado: {output_path}. Ejecuta el bot primero.")
        return openpyxl.load_workbook(str(output_path), data_only=True)
    
    def test_all_critical_cells_match(self, expected_workbook, actual_workbook):
        """Verifica que todas las celdas críticas coincidan"""
        errores = []
        
        for hoja, celda, descripcion, tipo in CELDAS_CRITICAS:
            expected_val = expected_workbook[hoja][celda].value
            actual_val = actual_workbook[hoja][celda].value
            
            if str(expected_val) != str(actual_val):
                errores.append(
                    f"{descripcion} ({hoja}!{celda}): "
                    f"esperado={expected_val}, actual={actual_val}"
                )
        
        if errores:
            pytest.fail(f"Celdas no coinciden:\n" + "\n".join(errores))
    
    def test_fecha_apertura_is_date(self, actual_workbook):
        """Verifica que la fecha de apertura sea tipo date"""
        val = actual_workbook['inf.gral 1']['E6'].value
        assert val is not None, "Fecha de apertura está vacía"
        assert isinstance(val, datetime), f"Fecha no es datetime: {type(val)}"
    
    def test_year_is_number(self, actual_workbook):
        """Verifica que el año sea numérico"""
        val = actual_workbook['inf.gral 1']['M6'].value
        assert val is not None, "Año está vacío"
        assert isinstance(val, (int, float)), f"Año no es número: {type(val)}"
        assert 2020 <= int(val) <= 2030, f"Año fuera de rango: {val}"
    
    def test_nif_format(self, actual_workbook):
        """Verifica formato del NIF"""
        val = actual_workbook['inf.gral 1']['L9'].value
        assert val is not None, "NIF está vacío"
        assert len(str(val)) >= 8, f"NIF muy corto: {val}"
    
    def test_registro_autonomico_is_number(self, actual_workbook):
        """Verifica que el registro autonómico sea numérico"""
        val = actual_workbook['inf.gral 1']['L10'].value
        assert val is not None, "Registro autonómico está vacío"
        assert isinstance(val, (int, float)), f"Registro no es número: {type(val)}"
    
    def test_postal_code_format(self, actual_workbook):
        """Verifica formato del código postal"""
        val = actual_workbook['inf.gral 1']['J11'].value
        assert val is not None, "Código postal está vacío"
        # Código postal español: 5 dígitos
        assert len(str(int(val))) == 5, f"Código postal inválido: {val}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
