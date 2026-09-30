"""Registro de tratamientos (Excel/PDF) y catálogo de productos."""
from datetime import date

from cuaderno.models import Parcela, Tratamiento, ProductoAplicado
from cuaderno import registro_tratamientos as rt
from cuaderno.productos_catalogo import LocalCatalogoStorage


def _parcelas():
    return [
        Parcela(id="a", num_orden=3, nombre="PARCELA A", especie="CEBADA", superficie_cultivada=3.39),
        Parcela(id="b", num_orden=5, nombre="PARCELA B", especie="TRIGO", superficie_cultivada=0.79),
    ]


def test_una_fila_por_producto_con_datos_repetidos():
    t = Tratamiento(parcela_ids=["a"], cultivo_especie="CEBADA", superficie_tratada=3.39,
                    fecha_aplicacion="2026-03-11", problema_fitosanitario="MALAS HIERBAS",
                    aplicador="1", equipo="1", eficacia="BUENA",
                    productos=[ProductoAplicado(nombre_comercial="HERSAN", numero_registro="19812", dosis=0.6),
                               ProductoAplicado(nombre_comercial="URBOLE", numero_registro="25157", dosis=0.125,
                                                problema_fitosanitario="INSECTICIDA")])
    filas = rt.filas_registro([t], _parcelas(), separar_por_parcela=False)
    assert [f.separador for f in filas] == [False, False]
    assert filas[0].valores == ["3", "PARCELA A", "CEBADA", 3.39, date(2026, 3, 11), "MALAS HIERBAS",
                                "1", "1", "HERSAN", "19812", "0.6 L/Ha", "BUENA"]
    # Todos los datos del tratamiento se repiten; la problemática es la del producto
    assert filas[1].valores[:5] == filas[0].valores[:5]
    assert filas[1].valores[5] == "INSECTICIDA"


def test_varias_parcelas_se_desglosan_con_su_superficie_y_separador():
    t = Tratamiento(parcela_ids=["a", "b"], cultivo_especie="CEBADA", superficie_tratada=4.18,
                    fecha_aplicacion="2026-01-22",
                    productos=[ProductoAplicado(nombre_comercial="CHLORTOSINT", dosis=1.0)])
    filas = rt.filas_registro([t], _parcelas(), separar_por_parcela=True)
    assert [f.separador for f in filas] == [True, False, True, False]
    assert (filas[1].valores[0], filas[1].valores[3]) == ("3", 3.39)
    assert (filas[3].valores[0], filas[3].valores[2], filas[3].valores[3]) == ("5", "TRIGO", 0.79)


def test_datos_validacion_fecha_corta():
    t = Tratamiento(asesorado=True, nombre_asesor_trat="ASESOR", num_colegiado_asesor="123",
                    fecha_recomendacion_asesor="2026-06-10")
    v = rt.datos_validacion([t])
    assert rt.lineas_validacion(v)[-3:] == ["Asesor: ASESOR", "Nº Inscripción ROPO: 123", "Fecha: 10/06/26"]


def test_catalogo_no_borra_datos_al_actualizar(tmp_path):
    cat = LocalCatalogoStorage(str(tmp_path / "cat.json"))
    cat.upsert({"nombre_comercial": "HERSAN", "numero_registro": "19812", "materia_activa": "X",
                "problematica": "MALAS HIERBAS", "unidad_dosis": "L/Ha"})
    # Actualización con datos parciales (como al guardar un tratamiento)
    cat.upsert({"nombre_comercial": "HERSAN", "numero_registro": "19812", "tipo": "fitosanitario"})
    r = cat.listar("HERSAN")[0]
    assert (r["materia_activa"], r["problematica"], r["unidad_dosis"]) == ("X", "MALAS HIERBAS", "L/Ha")
    # Lo aprendido de tratamientos no pisa lo configurado a mano
    cat.upsert({"nombre_comercial": "HERSAN", "numero_registro": "19812", "problematica": "OTRA"}, solo_vacios=True)
    assert cat.listar("HERSAN")[0]["problematica"] == "MALAS HIERBAS"
