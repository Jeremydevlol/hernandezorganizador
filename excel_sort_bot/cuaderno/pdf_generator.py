"""
CUADERNO DE EXPLOTACIÓN - GENERADOR DE PDF MODERNO (fpdf2)
Genera documentos PDF profesionales, modernos y legibles para inspecciones.
Diseño premium con jerarquía visual clara, métricas destacadas y tablas elegantes.
"""
import unicodedata
import re
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Any, Dict, Tuple

try:
    from fpdf import FPDF
    from fpdf.fonts import FontFace
    FPDF2_AVAILABLE = True
except ImportError:
    FPDF2_AVAILABLE = False
    FPDF = None
    FontFace = None

from .models import CuadernoExplotacion, Tratamiento, Parcela, HojaExcel


# ============================================
# PALETA DE COLORES MODERNA
# ============================================

# Primarios
COLOR_PRIMARY = (15, 76, 117)         # Azul oscuro profesional
COLOR_PRIMARY_LIGHT = (30, 115, 170)  # Azul medio
COLOR_PRIMARY_PALE = (230, 242, 250)  # Azul muy claro (fondos)

# Acento
COLOR_ACCENT = (0, 150, 136)         # Verde teal moderno
COLOR_ACCENT_LIGHT = (224, 247, 244)  # Verde teal claro

# Neutrales
COLOR_TEXT_DARK = (33, 37, 41)        # Casi negro
COLOR_TEXT = (52, 58, 64)             # Gris oscuro
COLOR_TEXT_MUTED = (108, 117, 125)    # Gris medio
COLOR_TEXT_LIGHT = (173, 181, 189)    # Gris claro

# Fondos
COLOR_BG_LIGHT = (248, 249, 250)     # Gris muy claro
COLOR_BG_STRIPE = (241, 243, 245)    # Gris claro alterno
COLOR_WHITE = (255, 255, 255)

# Tablas
COLOR_TABLE_HEADER = (15, 76, 117)    # Azul oscuro
COLOR_TABLE_HEADER_TEXT = (255, 255, 255)
COLOR_TABLE_ROW_ALT = (245, 247, 250)
COLOR_TABLE_BORDER = (206, 212, 218)

# Acentos semánticos
COLOR_SUCCESS = (25, 135, 84)         # Verde éxito
COLOR_INFO = (13, 110, 253)           # Azul info
COLOR_WARNING = (255, 193, 7)         # Amarillo aviso


# ============================================
# HELPER: sanitización de texto
# ============================================

def _sanitize(text: Any) -> str:
    """Sanitiza texto para fpdf2: convierte caracteres especiales a ASCII seguro."""
    if text is None:
        return ""
    s = str(text)
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    replacements = {
        "\u2014": "-", "\u2013": "-", "\u2026": "...",
        "\u00ab": '"', "\u00bb": '"',
        "\u201c": '"', "\u201d": '"',
        "\u2018": "'", "\u2019": "'",
        "ª": "a", "º": "o", "\x93": "",
    }
    for old, new in replacements.items():
        s = s.replace(old, new)
    s = s.encode("ascii", "ignore").decode("ascii")
    return s.strip()


def _sanitize_row(row: List[Any]) -> List[str]:
    """Sanitiza todos los elementos de una fila."""
    return [_sanitize(cell) for cell in row]


# Si fpdf2 no está disponible, crear clase base dummy para que el módulo cargue
if FPDF is None:
    class _DummyFPDF:
        def __init__(self, *args, **kwargs):
            raise ImportError("fpdf2 no está instalado. Ejecuta: pip install fpdf2")
    _BasePDF = _DummyFPDF
else:
    _BasePDF = FPDF


class ModernPDF(_BasePDF):
    """PDF base con cabecera y pie de página modernos."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._doc_title = "Cuaderno de Explotacion"
        self._doc_year = ""
        self._doc_titular = ""
        self._is_cover = True  # No dibujar header/footer en portada

    def header(self):
        if self._is_cover:
            return
        # Barra superior con color primario + accent
        self.set_fill_color(*COLOR_PRIMARY)
        self.rect(0, 0, self.w, 3, "F")
        self.set_fill_color(*COLOR_ACCENT)
        self.rect(0, 3, self.w, 0.5, "F")

        # Marca texto izquierda + año derecha
        self.set_y(6)
        self.set_font("Helvetica", "B", 8)
        self.set_text_color(*COLOR_PRIMARY)
        self.cell(140, 5, _sanitize("CUADERNO DE EXPLOTACION"), align="L")
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*COLOR_TEXT_MUTED)
        year_text = _sanitize(f"Ano {self._doc_year}") if self._doc_year else ""
        self.cell(0, 5, year_text, align="R", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

        # Línea separadora fina
        self.set_draw_color(*COLOR_TABLE_BORDER)
        self.set_line_width(0.2)
        self.line(18, self.get_y(), self.w - 18, self.get_y())
        self.ln(4)

    def footer(self):
        if self._is_cover:
            return
        self.set_y(-18)
        # Línea separadora
        self.set_draw_color(*COLOR_TABLE_BORDER)
        self.set_line_width(0.2)
        self.line(18, self.get_y(), self.w - 18, self.get_y())
        self.ln(3)

        # Tres columnas: titular | página | marca
        col_w = (self.w - 36) / 3
        self.set_x(18)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*COLOR_TEXT_LIGHT)
        self.cell(col_w, 4, _sanitize(self._doc_titular or ""), align="L")

        self.set_font("Helvetica", "B", 7)
        self.set_text_color(*COLOR_PRIMARY_LIGHT)
        self.cell(col_w, 4, f"- {self.page_no()} -", align="C")

        self.set_font("Helvetica", "", 7)
        self.set_text_color(*COLOR_TEXT_LIGHT)
        self.cell(col_w, 4, _sanitize("Hernandez Bueno"), align="R")


# ============================================
# GENERADOR PRINCIPAL
# ============================================

class PDFGenerator:
    """
    Generador de PDF moderno para Cuadernos de Explotación.
    Diseño profesional con jerarquía visual, métricas destacadas y tablas elegantes.
    """

    def __init__(self):
        if not FPDF2_AVAILABLE:
            raise ImportError("fpdf2 no esta instalado. Ejecuta: pip install fpdf2")

        self.headings_style = FontFace(
            emphasis="BOLD",
            color=COLOR_TABLE_HEADER_TEXT,
            fill_color=COLOR_TABLE_HEADER,
        )

    # ============================================
    # CREACIÓN DEL PDF
    # ============================================

    def _crear_pdf(self, titulo: str = "", year: str = "", titular: str = "") -> ModernPDF:
        """Crea un PDF landscape A4 con configuración base."""
        pdf = ModernPDF(orientation="L", unit="mm", format="A4")
        pdf.set_auto_page_break(auto=True, margin=22)
        pdf.set_margins(18, 22, 18)
        pdf._doc_title = titulo
        pdf._doc_year = year
        pdf._doc_titular = titular
        pdf.set_font("Helvetica", size=10)
        return pdf

    # ============================================
    # PORTADA PROFESIONAL
    # ============================================

    def _portada(self, pdf: ModernPDF, cuaderno: CuadernoExplotacion):
        """Genera portada profesional con tarjeta de datos y métricas."""
        pdf._is_cover = True
        pdf.add_page()

        pw = pdf.w   # page width
        ph = pdf.h   # page height

        # --- Barra superior decorativa ---
        pdf.set_fill_color(*COLOR_PRIMARY)
        pdf.rect(0, 0, pw, 38, "F")
        pdf.set_fill_color(*COLOR_PRIMARY_LIGHT)
        pdf.rect(0, 38, pw, 2, "F")

        # Título principal sobre la barra
        pdf.set_y(10)
        pdf.set_font("Helvetica", "B", 24)
        pdf.set_text_color(*COLOR_WHITE)
        pdf.cell(0, 12, _sanitize("CUADERNO DE EXPLOTACION"), align="C",
                 new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 11)
        pdf.set_text_color(200, 220, 240)
        pdf.cell(0, 7, _sanitize("REGISTRO DE TRATAMIENTOS FITOSANITARIOS"),
                 align="C", new_x="LMARGIN", new_y="NEXT")

        # --- Línea accent ---
        pdf.set_y(44)
        pdf.set_fill_color(*COLOR_ACCENT)
        pdf.rect((pw - 80) / 2, 44, 80, 1.5, "F")

        # --- Año grande centrado ---
        pdf.set_y(52)
        pdf.set_font("Helvetica", "B", 48)
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.cell(0, 25, str(cuaderno.año), align="C", new_x="LMARGIN", new_y="NEXT")

        # --- Tarjeta de datos ---
        card_w = 180
        card_x = (pw - card_w) / 2
        card_y = 85
        fields = [
            ("Explotacion", cuaderno.nombre_explotacion),
            ("Titular", cuaderno.titular),
            ("NIF/CIF", cuaderno.nif_titular),
            ("Domicilio", cuaderno.domicilio),
            ("Codigo Expl.", cuaderno.codigo_explotacion),
        ]
        self._draw_info_card(pdf, card_x, card_y, card_w, fields)

        # --- Métricas resumen ---
        n_fields = len(fields)
        card_bottom = card_y + n_fields * 10 + 14
        metrics_y = card_bottom + 8
        metric_w = 50
        gap = 12
        total_w = 3 * metric_w + 2 * gap
        start_x = (pw - total_w) / 2

        for i, (val, label) in enumerate([
            (str(len(cuaderno.parcelas)), "Parcelas"),
            (str(len(cuaderno.productos)), "Productos"),
            (str(len(cuaderno.tratamientos)), "Tratamientos"),
        ]):
            self._draw_metric_box(pdf, start_x + i * (metric_w + gap),
                                   metrics_y, metric_w, 28, val, label)

        # --- Pie de portada ---
        pdf.set_y(ph - 22)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*COLOR_TEXT_LIGHT)
        now = datetime.now().strftime("%d/%m/%Y")
        pdf.cell(0, 5, _sanitize(f"Documento generado el {now}"), align="C",
                 new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*COLOR_PRIMARY_LIGHT)
        pdf.cell(0, 5, _sanitize("Hernandez Bueno - Cuaderno de Explotacion Digital"),
                 align="C")

        # Barra inferior
        pdf.set_fill_color(*COLOR_PRIMARY)
        pdf.rect(0, ph - 5, pw, 5, "F")

    # ============================================
    # COMPONENTES VISUALES
    # ============================================

    def _draw_info_card(self, pdf: ModernPDF, x, y, w, fields: List[Tuple[str, str]]):
        """Tarjeta con campos label: valor, sombra y borde accent."""
        row_h = 10
        padding = 7
        total_h = len(fields) * row_h + padding * 2

        # Sombra
        pdf.set_fill_color(215, 220, 228)
        pdf.rect(x + 1.5, y + 1.5, w, total_h, "F")

        # Fondo blanco + borde
        pdf.set_fill_color(*COLOR_WHITE)
        pdf.set_draw_color(*COLOR_TABLE_BORDER)
        pdf.set_line_width(0.3)
        pdf.rect(x, y, w, total_h, "DF")

        # Borde superior accent
        pdf.set_fill_color(*COLOR_ACCENT)
        pdf.rect(x, y, w, 2, "F")

        # Campos
        label_w = 50
        value_w = w - label_w - padding * 2
        cy = y + padding + 1
        for label, value in fields:
            pdf.set_xy(x + padding, cy)
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_text_color(*COLOR_TEXT_MUTED)
            pdf.cell(label_w, row_h, _sanitize(f"{label}:"), align="L")
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(*COLOR_TEXT_DARK)
            val_text = _sanitize(value or "-")
            # Truncar valores muy largos
            if len(val_text) > 60:
                val_text = val_text[:57] + "..."
            pdf.cell(value_w, row_h, val_text, align="L")
            cy += row_h

    def _draw_metric_box(self, pdf: ModernPDF, x, y, w, h, value: str, label: str):
        """Box de métrica: número grande + etiqueta."""
        pdf.set_fill_color(*COLOR_PRIMARY_PALE)
        pdf.set_draw_color(*COLOR_PRIMARY_LIGHT)
        pdf.set_line_width(0.3)
        pdf.rect(x, y, w, h, "DF")

        # Número
        pdf.set_xy(x, y + 2)
        pdf.set_font("Helvetica", "B", 20)
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.cell(w, 13, value, align="C")

        # Label
        pdf.set_xy(x, y + 16)
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(*COLOR_TEXT_MUTED)
        pdf.cell(w, 7, _sanitize(label), align="C")

    # ============================================
    # ENCABEZADOS DE SECCIÓN
    # ============================================

    def _seccion_header(self, pdf: ModernPDF, numero: int, titulo: str):
        """Encabezado de sección numerado con badge + línea accent."""
        # Verificar espacio: si queda poco, nueva página
        if pdf.get_y() > pdf.h - 50:
            pdf.add_page()

        pdf.ln(3)
        y0 = pdf.get_y()

        # Badge numérico
        bs = 9  # badge size
        pdf.set_fill_color(*COLOR_PRIMARY)
        pdf.rect(18, y0, bs, bs, "F")
        pdf.set_xy(18, y0)
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(*COLOR_WHITE)
        pdf.cell(bs, bs, str(numero), align="C")

        # Título
        pdf.set_xy(30, y0 - 0.5)
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.cell(0, bs + 1, _sanitize(titulo.upper()), align="L")
        pdf.ln(bs + 1)

        # Línea decorativa
        ly = pdf.get_y()
        pdf.set_fill_color(*COLOR_ACCENT)
        pdf.rect(18, ly, 35, 0.8, "F")
        pdf.set_fill_color(*COLOR_TABLE_BORDER)
        pdf.rect(53, ly + 0.25, pdf.w - 53 - 18, 0.3, "F")
        pdf.ln(5)

    def _sub_seccion(self, pdf: ModernPDF, titulo: str):
        """Subtítulo dentro de una sección."""
        pdf.ln(2)
        y = pdf.get_y()
        pdf.set_fill_color(*COLOR_ACCENT)
        pdf.rect(18, y + 1, 2.5, 5, "F")
        pdf.set_x(23)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*COLOR_PRIMARY_LIGHT)
        pdf.cell(0, 7, _sanitize(titulo), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(2)

    # ============================================
    # TABLAS MODERNAS
    # ============================================

    def _tabla_moderna(self, pdf: ModernPDF, data: List[List[str]], col_widths: tuple,
                       font_size: int = 8):
        """Tabla con cabecera del color primario, filas alternas, cabeceras repetidas."""
        if not data:
            return
        pdf.set_font("Helvetica", size=font_size)
        with pdf.table(
            first_row_as_headings=True,
            headings_style=self.headings_style,
            col_widths=col_widths,
            cell_fill_color=COLOR_TABLE_ROW_ALT,
            cell_fill_mode="ROWS",
            repeat_headings=True,
            line_height=pdf.font_size * 2.3,
        ) as t:
            for row in data:
                t.row(_sanitize_row(row))

    def _tabla_info_moderna(self, pdf: ModernPDF, data: List[Tuple[str, str]],
                             col1_w: int = 55):
        """Tabla vertical de dos columnas label: valor con franjas alternas."""
        col2_w = pdf.w - 36 - col1_w  # Usar todo el ancho disponible
        pdf.set_font("Helvetica", size=9)
        for i, (label, value) in enumerate(data):
            y = pdf.get_y()
            if i % 2 == 0:
                pdf.set_fill_color(*COLOR_BG_STRIPE)
                pdf.rect(18, y, col1_w + col2_w, 7.5, "F")

            pdf.set_x(20)
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(*COLOR_TEXT_MUTED)
            pdf.cell(col1_w, 7.5, _sanitize(label), align="L")

            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*COLOR_TEXT_DARK)
            pdf.cell(col2_w, 7.5, _sanitize(value or "-"), align="L",
                     new_x="LMARGIN", new_y="NEXT")

    # ============================================
    # PIE DE DOCUMENTO
    # ============================================

    def _pie_documento(self, pdf: ModernPDF, cuaderno: CuadernoExplotacion):
        """Pie final del documento con separador y datos."""
        # Si queda muy poco espacio, nueva página para el pie
        if pdf.get_y() > pdf.h - 40:
            pdf.add_page()

        pdf.ln(8)

        # Separador decorativo centrado
        center = pdf.w / 2
        y = pdf.get_y()
        pdf.set_fill_color(*COLOR_TABLE_BORDER)
        pdf.rect(center - 40, y, 80, 0.3, "F")
        pdf.set_fill_color(*COLOR_ACCENT)
        pdf.rect(center - 8, y - 0.3, 16, 1, "F")
        pdf.ln(6)

        # Texto final
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*COLOR_TEXT_LIGHT)
        now = datetime.now().strftime("%d/%m/%Y %H:%M")
        pdf.cell(0, 4, _sanitize(f"Documento generado automaticamente el {now}"),
                 align="C", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*COLOR_PRIMARY_LIGHT)
        pdf.cell(0, 4, _sanitize(f"Cuaderno de Explotacion Digital - Ano {cuaderno.año}"),
                 align="C", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(*COLOR_TEXT_LIGHT)
        pdf.cell(0, 4, _sanitize("Este documento tiene caracter informativo y de respaldo."),
                 align="C", new_x="LMARGIN", new_y="NEXT")

    # ============================================
    # RESUMEN EJECUTIVO
    # ============================================

    def _resumen_ejecutivo(self, pdf: ModernPDF, cuaderno: CuadernoExplotacion,
                           num_tratamientos: int = None):
        """Panel de resumen con métricas clave."""
        n_trat = num_tratamientos if num_tratamientos is not None else len(cuaderno.tratamientos)

        y0 = pdf.get_y()
        panel_w = pdf.w - 36
        panel_h = 26

        # Fondo
        pdf.set_fill_color(*COLOR_BG_LIGHT)
        pdf.set_draw_color(*COLOR_TABLE_BORDER)
        pdf.set_line_width(0.2)
        pdf.rect(18, y0, panel_w, panel_h, "DF")

        # Título
        pdf.set_xy(22, y0 + 2)
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(*COLOR_TEXT_MUTED)
        pdf.cell(60, 4, _sanitize("RESUMEN DEL CUADERNO"))

        # Métricas
        metrics = [
            (str(len(cuaderno.parcelas)), "Parcelas", COLOR_PRIMARY),
            (str(len(cuaderno.productos)), "Productos", COLOR_ACCENT),
            (str(n_trat), "Tratamientos", COLOR_SUCCESS),
        ]
        mw = 55
        gap = 12
        total = len(metrics) * mw + (len(metrics) - 1) * gap
        sx = 18 + (panel_w - total) / 2

        for i, (val, label, color) in enumerate(metrics):
            mx = sx + i * (mw + gap)
            my = y0 + 7

            pdf.set_xy(mx, my)
            pdf.set_font("Helvetica", "B", 16)
            pdf.set_text_color(*color)
            pdf.cell(mw, 9, val, align="C")

            pdf.set_xy(mx, my + 9)
            pdf.set_font("Helvetica", "", 7)
            pdf.set_text_color(*COLOR_TEXT_MUTED)
            pdf.cell(mw, 5, _sanitize(label), align="C")

        pdf.set_y(y0 + panel_h + 4)

    # ============================================
    # MENSAJE VACÍO
    # ============================================

    def _mensaje_vacio(self, pdf: ModernPDF, texto: str):
        """Muestra un recuadro estilizado cuando no hay datos."""
        y = pdf.get_y()
        bw = 180
        bh = 14
        x = (pdf.w - bw) / 2

        pdf.set_fill_color(*COLOR_BG_LIGHT)
        pdf.set_draw_color(*COLOR_TABLE_BORDER)
        pdf.set_line_width(0.2)
        pdf.rect(x, y, bw, bh, "DF")

        pdf.set_xy(x, y)
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(*COLOR_TEXT_MUTED)
        pdf.cell(bw, bh, _sanitize(texto), align="C")
        pdf.ln(bh + 3)

    # ============================================
    # VALIDACIÓN DE DATOS
    # ============================================

    def _hoja_tiene_datos(self, hoja: HojaExcel) -> bool:
        """Verifica si una hoja importada realmente tiene datos (no solo filas vacías)."""
        if not hoja.datos:
            return False
        if not hoja.columnas:
            return False
        # Verificar que al menos una fila tenga algún valor no vacío
        for fila in hoja.datos:
            for celda in fila:
                if celda is not None and str(celda).strip():
                    return True
        return False

    def _parcela_tiene_datos(self, parcela: Parcela) -> bool:
        """Verifica si una parcela tiene datos mínimos significativos."""
        return bool(
            (parcela.nombre and parcela.nombre.strip())
            or (parcela.referencia_catastral and parcela.referencia_catastral.strip())
            or (parcela.especie and parcela.especie.strip())
            or (parcela.cultivo and parcela.cultivo.strip())
            or parcela.num_orden
        )

    def _tratamiento_tiene_datos(self, trat: Tratamiento) -> bool:
        """Verifica si un tratamiento tiene datos mínimos significativos."""
        return bool(
            (trat.fecha_aplicacion and trat.fecha_aplicacion.strip())
            and trat.productos
            and any(p.nombre_comercial and p.nombre_comercial.strip() for p in trat.productos)
        )

    # ============================================
    # NOTA INFORMATIVA
    # ============================================

    def _nota_info(self, pdf: ModernPDF, texto: str):
        """Muestra texto informativo pequeño (contadores, filtros, etc.)."""
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*COLOR_TEXT_MUTED)
        pdf.cell(0, 5, _sanitize(texto), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

    # ============================================
    # GENERADOR: CUADERNO COMPLETO
    # ============================================

    def generar_cuaderno_completo(self, cuaderno: CuadernoExplotacion,
                                   output_path: str,
                                   date_desde: Optional[str] = None,
                                   date_hasta: Optional[str] = None,
                                   hojas_a_incluir: Optional[List[str]] = None) -> str:
        """Genera el PDF del cuaderno completo con diseño moderno.
        Analiza los datos antes de exportar: omite secciones/hojas vacías."""

        # ==============================
        # FASE 1: ANÁLISIS PREVIO
        # ==============================

        # Filtrar parcelas con datos reales (activas + con info mínima)
        parcelas_validas = [
            p for p in cuaderno.parcelas
            if p.activa and self._parcela_tiene_datos(p)
        ]

        # Filtrar productos con nombre
        productos_validos = [
            p for p in cuaderno.productos
            if p.nombre_comercial and p.nombre_comercial.strip()
        ]

        # Filtrar y aplicar rango de fechas a tratamientos
        tratamientos_list = cuaderno.tratamientos
        if date_desde or date_hasta:
            tratamientos_list = [
                t for t in cuaderno.tratamientos
                if (not date_desde or (t.fecha_aplicacion or "") >= date_desde)
                and (not date_hasta or (t.fecha_aplicacion or "") <= date_hasta)
            ]
        # Solo tratamientos con datos mínimos
        tratamientos_validos = [
            t for t in tratamientos_list
            if self._tratamiento_tiene_datos(t)
        ]

        # Filtrar hojas importadas: solo las que tienen datos reales
        hojas_validas = []
        if hojas_a_incluir:
            for h in cuaderno.hojas_originales:
                if h.sheet_id in hojas_a_incluir and self._hoja_tiene_datos(h):
                    hojas_validas.append(h)

        # ==============================
        # FASE 2: GENERACIÓN DEL PDF
        # ==============================

        pdf = self._crear_pdf(
            titulo=cuaderno.nombre_explotacion,
            year=str(cuaderno.año),
            titular=_sanitize(cuaderno.titular),
        )

        # --- PORTADA ---
        self._portada(pdf, cuaderno)

        # --- DATOS DE EXPLOTACIÓN + RESUMEN ---
        pdf._is_cover = False
        pdf.add_page()

        seccion_num = 1
        self._seccion_header(pdf, seccion_num, "Datos de la Explotacion")
        self._tabla_info_moderna(pdf, [
            ("Nombre Explotacion", cuaderno.nombre_explotacion),
            ("Titular", cuaderno.titular),
            ("NIF/CIF", cuaderno.nif_titular),
            ("Domicilio", cuaderno.domicilio),
            ("Codigo Explotacion", cuaderno.codigo_explotacion),
            ("Ano", str(cuaderno.año)),
        ])
        pdf.ln(6)

        # Dashboard con conteos reales (validados)
        self._resumen_ejecutivo(pdf, cuaderno, num_tratamientos=len(tratamientos_validos))

        # --- PARCELAS (solo si hay datos) ---
        if parcelas_validas:
            seccion_num += 1
            pdf.add_page()
            self._seccion_header(pdf, seccion_num, "Relacion de Parcelas")
            self._nota_info(pdf,
                f"{len(parcelas_validas)} parcela(s) activa(s) con datos")

            parcelas_data = [["Ord.", "Nombre / Referencia", "Ref. Catastral",
                              "Sup.(Ha)", "Cultivo", "Municipio"]]
            for i, p in enumerate(parcelas_validas, 1):
                sup = p.superficie_ha or p.superficie_cultivada or 0
                nombre = p.nombre or p.referencia_catastral or f"Parcela {i}"
                ref = p.referencia_catastral or "-"
                cultivo_txt = f"{p.cultivo or p.especie}".strip()
                if p.variedad and p.variedad.strip():
                    cultivo_txt += f" ({p.variedad.strip()})"
                parcelas_data.append([
                    str(p.num_orden if p.num_orden else i),
                    nombre,
                    ref,
                    f"{sup:.2f}",
                    cultivo_txt or "-",
                    p.municipio or p.termino_municipal or "-",
                ])
            self._tabla_moderna(pdf, parcelas_data, (15, 55, 48, 22, 50, 50), font_size=7)

        # --- PRODUCTOS (solo si hay datos) ---
        if productos_validos:
            seccion_num += 1
            pdf.add_page()
            self._seccion_header(pdf, seccion_num, "Registro de Productos Fitosanitarios")
            self._nota_info(pdf, f"{len(productos_validos)} producto(s) en inventario")

            prod_data = [["Producto", "N. Registro", "N. Lote", "Cantidad", "F. Adquisicion"]]
            for p in productos_validos:
                cant_text = ""
                if p.cantidad_adquirida:
                    cant_text = f"{p.cantidad_adquirida} {p.unidad}"
                prod_data.append([
                    p.nombre_comercial,
                    p.numero_registro or "-",
                    p.numero_lote or "-",
                    cant_text or "-",
                    p.fecha_adquisicion or "-",
                ])
            self._tabla_moderna(pdf, prod_data, (70, 42, 40, 40, 42))

        # --- TRATAMIENTOS (solo si hay datos) ---
        if tratamientos_validos:
            seccion_num += 1
            pdf.add_page()
            self._seccion_header(pdf, seccion_num, "Registro de Tratamientos Realizados")

            if date_desde or date_hasta:
                filtro = "Periodo: "
                if date_desde:
                    filtro += f"desde {date_desde} "
                if date_hasta:
                    filtro += f"hasta {date_hasta}"
                self._nota_info(pdf, filtro.strip())

            self._nota_info(pdf, f"{len(tratamientos_validos)} tratamiento(s) registrado(s)")

            trat_data = [["Fecha", "Parcela(s)", "Producto", "N. Reg.",
                          "Dosis", "Plaga/Enferm.", "Operador"]]
            for t in tratamientos_validos:
                parcelas_str = ", ".join(t.parcela_nombres[:2])
                if len(t.parcela_nombres) > 2:
                    parcelas_str += f" (+{len(t.parcela_nombres)-2})"
                if not parcelas_str and t.num_orden_parcelas:
                    parcelas_str = f"Ord. {t.num_orden_parcelas}"

                operador = t.operador or t.aplicador or ""
                for prod in t.productos:
                    if not (prod.nombre_comercial and prod.nombre_comercial.strip()):
                        continue  # Saltar productos vacíos dentro del tratamiento
                    trat_data.append([
                        t.fecha_aplicacion or "-",
                        parcelas_str or "-",
                        prod.nombre_comercial or "-",
                        prod.numero_registro or "-",
                        f"{prod.dosis} {prod.unidad_dosis}" if prod.dosis else "-",
                        t.plaga_enfermedad or "-",
                        operador or "-",
                    ])
            self._tabla_moderna(pdf, trat_data, (28, 40, 50, 30, 30, 38, 28), font_size=7)

        # --- HOJAS IMPORTADAS (solo las que tienen datos reales) ---
        if hojas_validas:
            for hoja in hojas_validas:
                seccion_num += 1
                pdf.add_page()
                self._seccion_header(pdf, seccion_num, f"Hoja: {hoja.nombre}")

                # Contar filas con datos reales (no vacías)
                filas_con_datos = [
                    fila for fila in hoja.datos
                    if any(c is not None and str(c).strip() for c in fila)
                ]
                self._nota_info(pdf,
                    f"Hoja importada - {len(filas_con_datos)} filas con datos, "
                    f"{len(hoja.columnas)} columnas")

                max_cols = 15
                max_filas = 200
                # Usar solo columnas no vacías
                cols_usadas = hoja.columnas[:max_cols]
                tabla_data = [cols_usadas]

                filas_exportadas = 0
                for fila in hoja.datos:
                    # Saltar filas completamente vacías
                    if not any(c is not None and str(c).strip() for c in fila):
                        continue
                    fila_limpia = [
                        str(c)[:50] if c is not None else ""
                        for c in fila[:max_cols]
                    ]
                    tabla_data.append(fila_limpia)
                    filas_exportadas += 1
                    if filas_exportadas >= max_filas:
                        restantes = len(filas_con_datos) - max_filas
                        if restantes > 0:
                            tabla_data.append(
                                [f"... ({restantes} filas mas)"]
                                + [""] * (len(cols_usadas) - 1)
                            )
                        break

                num_cols = len(cols_usadas)
                if num_cols > 0 and len(tabla_data) > 1:
                    cw = (pdf.w - 36) / num_cols
                    self._tabla_moderna(pdf, tabla_data,
                                         tuple([cw] * num_cols), font_size=6)

        # --- PIE FINAL ---
        self._pie_documento(pdf, cuaderno)
        pdf.output(output_path)
        return output_path

    # ============================================
    # GENERADOR: HISTÓRICO DE PARCELA
    # ============================================

    def generar_historico_parcela(self, cuaderno: CuadernoExplotacion,
                                   parcela_id: str, output_path: str) -> str:
        """Genera PDF del histórico de una parcela con diseño moderno."""
        parcela = cuaderno.obtener_parcela(parcela_id)
        if not parcela:
            raise ValueError(f"Parcela no encontrada: {parcela_id}")

        tratamientos = cuaderno.obtener_tratamientos_parcela(parcela_id)

        pdf = self._crear_pdf(
            titulo=f"Historico - {_sanitize(parcela.nombre)}",
            year=str(cuaderno.año),
            titular=_sanitize(cuaderno.titular),
        )

        # --- Portada simplificada ---
        pdf._is_cover = True
        pdf.add_page()
        pw, ph = pdf.w, pdf.h

        # Barra superior
        pdf.set_fill_color(*COLOR_PRIMARY)
        pdf.rect(0, 0, pw, 28, "F")
        pdf.set_fill_color(*COLOR_PRIMARY_LIGHT)
        pdf.rect(0, 28, pw, 2, "F")
        pdf.set_y(8)
        pdf.set_font("Helvetica", "B", 18)
        pdf.set_text_color(*COLOR_WHITE)
        pdf.cell(0, 12, _sanitize("HISTORICO DE TRATAMIENTOS"), align="C",
                 new_x="LMARGIN", new_y="NEXT")

        # Accent
        pdf.set_y(34)
        pdf.set_fill_color(*COLOR_ACCENT)
        pdf.rect((pw - 50) / 2, 34, 50, 1, "F")

        # Tarjeta parcela
        sup = parcela.superficie_ha or parcela.superficie_cultivada or 0
        ubicacion = f"{parcela.municipio or parcela.termino_municipal}"
        if parcela.provincia or parcela.codigo_provincia:
            prov = parcela.provincia or parcela.codigo_provincia
            if prov:
                ubicacion = f"{ubicacion}, {prov}".strip(", ")

        card_w = 160
        self._draw_info_card(pdf, (pw - card_w) / 2, 42, card_w, [
            ("Parcela", parcela.nombre),
            ("Ref. Catastral", parcela.referencia_catastral or "-"),
            ("Cultivo", f"{parcela.cultivo or parcela.especie} {parcela.variedad}".strip() or "-"),
            ("Superficie", f"{sup:.2f} Ha"),
            ("Ubicacion", ubicacion or "-"),
        ])

        # Métrica
        self._draw_metric_box(pdf, (pw - 55) / 2, 115, 55, 26,
                               str(len(tratamientos)), "Tratamientos")

        # Barra inferior
        pdf.set_fill_color(*COLOR_PRIMARY)
        pdf.rect(0, ph - 5, pw, 5, "F")

        # --- Página de datos ---
        pdf._is_cover = False
        pdf.add_page()

        self._seccion_header(pdf, 1, "Tratamientos Aplicados")

        if tratamientos:
            self._nota_info(pdf,
                f"{len(tratamientos)} tratamiento(s) registrado(s) para esta parcela")

            trat_data = [["Fecha", "Producto", "N. Reg.", "N. Lote",
                          "Dosis", "Plaga/Enfermedad", "Operador"]]
            for t in tratamientos:
                for prod in t.productos:
                    trat_data.append([
                        t.fecha_aplicacion or "-",
                        prod.nombre_comercial or "-",
                        prod.numero_registro or "-",
                        prod.numero_lote or "-",
                        f"{prod.dosis} {prod.unidad_dosis}" if prod.dosis else "-",
                        t.plaga_enfermedad or "-",
                        t.operador or t.aplicador or "-",
                    ])
            self._tabla_moderna(pdf, trat_data, (30, 52, 34, 30, 34, 48, 36))
        else:
            self._mensaje_vacio(pdf, "No hay tratamientos registrados para esta parcela")

        self._pie_documento(pdf, cuaderno)
        pdf.output(output_path)
        return output_path


# ============================================
# FUNCIONES HELPER (API pública)
# ============================================

def generar_pdf_cuaderno(cuaderno: CuadernoExplotacion, output_path: str = None) -> str:
    """Genera PDF de un cuaderno."""
    if output_path is None:
        output_path = f"cuaderno_{cuaderno.id}_{cuaderno.año}.pdf"
    generator = PDFGenerator()
    return generator.generar_cuaderno_completo(cuaderno, output_path)


def generar_pdf_parcela(cuaderno: CuadernoExplotacion, parcela_id: str,
                        output_path: str = None) -> str:
    """Genera PDF del histórico de una parcela."""
    if output_path is None:
        output_path = f"historico_parcela_{parcela_id}.pdf"
    generator = PDFGenerator()
    return generator.generar_historico_parcela(cuaderno, parcela_id, output_path)
