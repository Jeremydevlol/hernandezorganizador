"""
REGISTRO DE TRATAMIENTOS (hojas "3.1. Reg. Tratamientos" y "Trat. Asesorados")

Contenido común del Excel y del PDF, para que ambos salgan idénticos a la
plantilla de exportación del cliente (PLANTILLA_EXPORTACION.xlsx):

- 12 columnas: Nº Parcela, Nombre, Cultivo, Sup. Tratada, Fecha, Problemática,
  Aplicador, Equipo, Producto, Nº Registro, Dosis, Eficacia.
- Una fila por producto, con todos los datos del tratamiento repetidos.
- Un tratamiento con varias parcelas se desglosa en una fila por parcela, con
  la superficie de cada una.
- Al agrupar por parcela, cada grupo va precedido de una fila separadora vacía
  (sin el texto "Ord. N").
- Trat. Asesorados lleva debajo dos cuadros "VALIDACIÓN INTERMEDIA".
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional

COLUMNAS = [
    "Nº Parcela",
    "Nombre",
    "Cultivo",
    "Sup. Tratada\n(ha)",
    "Fecha\nAplicación",
    "Problemática",
    "Aplicador",
    "Equipo",
    "Producto",
    "Nº Registro",
    "Dosis",
    "Eficacia",
]
# Anchos de columna de la plantilla (unidades de Excel)
ANCHOS_EXCEL = [12.4, 32.4, 18.0, 14.0, 13.0, 20.0, 14.0, 13.0, 24.0, 14.0, 12.0, 13.0]
GRUPOS = [("IDENTIFICACIÓN PARCELA", 1, 3), ("TRATAMIENTO APLICADO", 4, 12)]
COL_SUPERFICIE = 3  # índice 0-based de "Sup. Tratada"
COL_FECHA = 4

TITULOS = {
    "tratamientos": ("3. TRATAMIENTOS FITOSANITARIOS", "3.1 REGISTRO DE TRATAMIENTOS FITOSANITARIOS"),
    "trat_asesor": ("TRATAMIENTOS ASESORADOS", "3.1 REGISTRO DE TRATAMIENTOS CON ASESORAMIENTO"),
}


@dataclass
class FilaRegistro:
    separador: bool = False
    valores: List[Any] = field(default_factory=list)


@dataclass
class DatosValidacion:
    """Datos de los cuadros "VALIDACIÓN INTERMEDIA" de Trat. Asesorados."""
    asesor: str = ""
    ropo: str = ""
    fecha: str = ""        # dd/mm/aa, como en la plantilla
    firma_asesor: str = ""  # PNG en base64 / data-url


def superficie_parcela(p: Any) -> float:
    for campo in ("superficie_cultivada", "superficie_ha", "superficie_sigpac"):
        try:
            v = float(getattr(p, campo, 0) or 0)
        except (TypeError, ValueError):
            v = 0.0
        if v:
            return v
    return 0.0


def parse_fecha(valor: Any) -> Any:
    """'2026-03-11' / '11/03/2026' → date; si no se reconoce, se devuelve tal cual."""
    if isinstance(valor, (date, datetime)):
        return valor.date() if isinstance(valor, datetime) else valor
    s = str(valor or "").strip()
    if not s:
        return ""
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s[:19] if "T" in s else s, fmt).date()
        except ValueError:
            continue
    return s


def fecha_dd_mm_aa(valor: Any) -> str:
    d = parse_fecha(valor)
    return d.strftime("%d/%m/%y") if isinstance(d, date) else str(d or "")


def texto_dosis(prod: Any) -> str:
    dosis = getattr(prod, "dosis", None)
    if dosis in (None, "", 0, 0.0):
        return ""
    unidad = (getattr(prod, "unidad_dosis", "") or "").strip()
    return f"{dosis} {unidad}".strip()


def _clave_sin_parcela(t: Any) -> str:
    ref = (getattr(t, "num_orden_parcelas", "") or "").strip()
    if ref:
        return f"ord:{ref.lower()}"
    nombres = getattr(t, "parcela_nombres", None) or []
    return "nom:" + ",".join(nombres).lower()


def _num_orden_txt(p: Any) -> str:
    n = getattr(p, "num_orden", None)
    try:
        return str(int(n)) if n not in (None, "") and int(n) else ""
    except (TypeError, ValueError):
        return str(n or "")


def filas_registro(tratamientos: List[Any], parcelas: List[Any], separar_por_parcela: bool) -> List[FilaRegistro]:
    """Filas de la hoja en el orden recibido (el del editor)."""
    por_id: Dict[str, Any] = {p.id: p for p in (parcelas or []) if getattr(p, "id", None)}
    entradas = []  # (clave_grupo, [valores por producto])

    for t in tratamientos:
        prods = [p for p in (getattr(t, "productos", None) or []) if (getattr(p, "nombre_comercial", "") or "").strip()]
        if not prods:
            prods = [None]
        problema_t = (getattr(t, "problema_fitosanitario", "") or getattr(t, "plaga_enfermedad", "") or "").strip()
        aplicador = getattr(t, "aplicador", "") or getattr(t, "operador", "") or ""
        fecha = parse_fecha(getattr(t, "fecha_aplicacion", ""))

        vinculadas = [por_id[pid] for pid in (getattr(t, "parcela_ids", None) or []) if pid in por_id]
        destinos = []  # (clave, nº, nombre, cultivo, superficie)
        if vinculadas:
            for p in vinculadas:
                cultivo_parcela = getattr(p, "especie", "") or getattr(p, "cultivo", "") or ""
                if len(vinculadas) == 1:
                    sup = float(getattr(t, "superficie_tratada", 0) or 0) or superficie_parcela(p)
                    cultivo = getattr(t, "cultivo_especie", "") or cultivo_parcela
                else:
                    # Desglose por parcela: superficie y cultivo de cada una
                    sup = superficie_parcela(p)
                    cultivo = cultivo_parcela or getattr(t, "cultivo_especie", "") or ""
                destinos.append((
                    f"id:{p.id}",
                    _num_orden_txt(p) or (getattr(t, "num_orden_parcelas", "") or ""),
                    getattr(p, "nombre", "") or "",
                    cultivo,
                    sup,
                ))
        else:
            destinos.append((
                _clave_sin_parcela(t),
                getattr(t, "num_orden_parcelas", "") or "",
                ", ".join(getattr(t, "parcela_nombres", None) or []),
                getattr(t, "cultivo_especie", "") or "",
                float(getattr(t, "superficie_tratada", 0) or 0),
            ))

        for clave, num, nombre, cultivo, sup in destinos:
            filas = []
            for prod in prods:
                problema = ((getattr(prod, "problema_fitosanitario", "") or "").strip() if prod else "") or problema_t
                filas.append([
                    num,
                    nombre,
                    cultivo,
                    sup if sup else None,
                    fecha,
                    problema,
                    aplicador,
                    getattr(t, "equipo", "") or "",
                    (getattr(prod, "nombre_comercial", "") or "") if prod else "",
                    (getattr(prod, "numero_registro", "") or "") if prod else "",
                    texto_dosis(prod) if prod else "",
                    getattr(t, "eficacia", "") or "",
                ])
            entradas.append((clave, filas))

    if separar_por_parcela:
        # Mantener juntos los grupos de una misma parcela sin alterar el orden
        # dentro de cada grupo (solo cambia algo si un tratamiento tenía varias parcelas).
        primera: Dict[str, int] = {}
        for i, (clave, _) in enumerate(entradas):
            primera.setdefault(clave, i)
        entradas = sorted(entradas, key=lambda e: primera[e[0]])

    out: List[FilaRegistro] = []
    prev: Optional[str] = None
    for clave, filas in entradas:
        if separar_por_parcela and clave != prev:
            out.append(FilaRegistro(separador=True))
        prev = clave
        out.extend(FilaRegistro(valores=v) for v in filas)
    return out


def datos_validacion(tratamientos: List[Any]) -> DatosValidacion:
    def primero(campo: str) -> str:
        return next((getattr(t, campo, "") for t in tratamientos if getattr(t, campo, "")), "") or ""
    return DatosValidacion(
        asesor=primero("nombre_asesor_trat"),
        ropo=primero("num_colegiado_asesor"),
        fecha=fecha_dd_mm_aa(primero("fecha_recomendacion_asesor")),
        firma_asesor=primero("firma_asesor"),
    )


def lineas_validacion(v: DatosValidacion) -> List[str]:
    """Texto de cada cuadro (las dos líneas vacías son el hueco para firmar)."""
    return [
        "VALIDACIÓN INTERMEDIA",
        "Firma",
        "",
        "",
        f"Asesor: {v.asesor}".rstrip(),
        f"Nº Inscripción ROPO: {v.ropo}".rstrip(),
        f"Fecha: {v.fecha}".rstrip(),
    ]
