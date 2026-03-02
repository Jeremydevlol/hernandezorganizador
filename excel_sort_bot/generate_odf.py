#!/usr/bin/env python3
"""
Genera documento ODF con resumen del proyecto Hernandez Bueno Sort Bot + RTE Enterprise
"""
from odf.opendocument import OpenDocumentText
from odf.style import Style, TextProperties, ParagraphProperties, TableColumnProperties, TableCellProperties
from odf.text import P, H, List, ListItem, Span
from odf.table import Table, TableColumn, TableRow, TableCell

# Crear documento
doc = OpenDocumentText()

# ============================================
# ESTILOS
# ============================================

# Título principal
title_style = Style(name="Title", family="paragraph")
title_style.addElement(TextProperties(fontsize="24pt", fontweight="bold", color="#1a365d"))
title_style.addElement(ParagraphProperties(marginbottom="0.5cm", margintop="0.5cm"))
doc.styles.addElement(title_style)

# Subtítulo
subtitle_style = Style(name="Subtitle", family="paragraph")
subtitle_style.addElement(TextProperties(fontsize="14pt", fontstyle="italic", color="#4a5568"))
subtitle_style.addElement(ParagraphProperties(marginbottom="0.8cm"))
doc.styles.addElement(subtitle_style)

# Heading 1
h1_style = Style(name="Heading1", family="paragraph")
h1_style.addElement(TextProperties(fontsize="18pt", fontweight="bold", color="#2c5282"))
h1_style.addElement(ParagraphProperties(marginbottom="0.3cm", margintop="0.6cm"))
doc.styles.addElement(h1_style)

# Heading 2
h2_style = Style(name="Heading2", family="paragraph")
h2_style.addElement(TextProperties(fontsize="14pt", fontweight="bold", color="#2b6cb0"))
h2_style.addElement(ParagraphProperties(marginbottom="0.2cm", margintop="0.4cm"))
doc.styles.addElement(h2_style)

# Normal
normal_style = Style(name="Normal", family="paragraph")
normal_style.addElement(TextProperties(fontsize="11pt"))
normal_style.addElement(ParagraphProperties(marginbottom="0.2cm"))
doc.styles.addElement(normal_style)

# Bold
bold_style = Style(name="Bold", family="text")
bold_style.addElement(TextProperties(fontweight="bold"))
doc.styles.addElement(bold_style)

# Table cell
cell_style = Style(name="TableCell", family="table-cell")
cell_style.addElement(TableCellProperties(padding="0.1cm", border="0.5pt solid #cccccc"))
doc.automaticstyles.addElement(cell_style)

# Header cell
header_cell_style = Style(name="HeaderCell", family="table-cell")
header_cell_style.addElement(TableCellProperties(padding="0.1cm", border="0.5pt solid #cccccc", backgroundcolor="#e2e8f0"))
doc.automaticstyles.addElement(header_cell_style)

# ============================================
# CONTENIDO
# ============================================

# Título
doc.text.addElement(H(outlinelevel=1, stylename=title_style, text="🏢 Hernandez Bueno Sort Bot + RTE Enterprise v2.0"))

# Subtítulo
p = P(stylename=subtitle_style)
p.addText("Sistema completo de gestión de Cuadernos de Explotación Agrícola en Excel")
doc.text.addElement(p)

# ============================================
# SECCIÓN 1: ¿QUÉ ES?
# ============================================
doc.text.addElement(H(outlinelevel=1, stylename=h1_style, text="📋 ¿Qué es?"))

p = P(stylename=normal_style)
p.addText("Un sistema profesional con dos componentes principales para automatizar la gestión documental agrícola:")
doc.text.addElement(p)

# ============================================
# SECCIÓN 2: SORT BOT
# ============================================
doc.text.addElement(H(outlinelevel=1, stylename=h1_style, text="1️⃣ Sort Bot - Ordenador de Excels"))

# Tabla de características
table1 = Table()
table1.addElement(TableColumn())
table1.addElement(TableColumn())

features = [
    ("Característica", "Descripción"),
    ("Extracción inteligente", "Lee Excels desordenados y encuentra datos por etiquetas, regex o tablas"),
    ("Plantilla RESUELTO", "Rellena automáticamente una plantilla profesional preservando estilos y fórmulas"),
    ("Validación NIF/NIE", "Valida documentos españoles con el algoritmo oficial"),
    ("Batch processing", "Procesa carpetas completas de clientes"),
    ("Logging completo", "Genera hoja LOG + JSON de errores"),
]

for i, (col1, col2) in enumerate(features):
    tr = TableRow()
    style = header_cell_style if i == 0 else cell_style
    
    tc1 = TableCell(stylename=style)
    tc1.addElement(P(text=col1))
    tr.addElement(tc1)
    
    tc2 = TableCell(stylename=style)
    tc2.addElement(P(text=col2))
    tr.addElement(tc2)
    
    table1.addElement(tr)

doc.text.addElement(table1)

# ============================================
# SECCIÓN 3: RTE ENTERPRISE
# ============================================
doc.text.addElement(H(outlinelevel=1, stylename=h1_style, text="2️⃣ RTE Enterprise - Editor en Tiempo Real con IA"))

# Motor
doc.text.addElement(H(outlinelevel=2, stylename=h2_style, text="🧠 Motor de Edición (14 operaciones)"))

p = P(stylename=normal_style)
p.addText("SET_CELL, SET_RANGE, SET_FORMULA, INSERT_ROWS, DELETE_ROWS, FIND_REPLACE, RENAME_SHEET, y más...")
doc.text.addElement(p)

# IA
doc.text.addElement(H(outlinelevel=2, stylename=h2_style, text="🤖 Inteligencia Artificial"))

ia_features = [
    "Resolución Semántica: 'cambia la fecha del orden 39' → encuentra fila 67",
    "Fuzzy Matching: 'glifosato' → encuentra ROUNDUP",
    "Procesador IA con OpenAI: Interpreta instrucciones en lenguaje natural",
]

for feat in ia_features:
    p = P(stylename=normal_style)
    p.addText("• " + feat)
    doc.text.addElement(p)

# Blindajes
doc.text.addElement(H(outlinelevel=2, stylename=h2_style, text="🛡️ Blindajes Enterprise"))

table2 = Table()
table2.addElement(TableColumn())
table2.addElement(TableColumn())

blindajes = [
    ("Blindaje", "Descripción"),
    ("File Locking", "1 sesión activa por archivo"),
    ("Tamper-proof", "Hash de operaciones + checksum"),
    ("Destructive Guards", "DELETE requiere confirmación explícita"),
    ("Contract Validator", "Protege filas/hojas críticas"),
    ("Modos STRICT/POWER/ADMIN", "Permisos granulares por tipo de usuario"),
]

for i, (col1, col2) in enumerate(blindajes):
    tr = TableRow()
    style = header_cell_style if i == 0 else cell_style
    
    tc1 = TableCell(stylename=style)
    tc1.addElement(P(text=col1))
    tr.addElement(tc1)
    
    tc2 = TableCell(stylename=style)
    tc2.addElement(P(text=col2))
    tr.addElement(tc2)
    
    table2.addElement(tr)

doc.text.addElement(table2)

# Servidor
doc.text.addElement(H(outlinelevel=2, stylename=h2_style, text="🖥️ Servidor Web (FastAPI)"))

server_features = [
    "API REST completa en http://localhost:8000",
    "Frontend visual para editar sin código",
    "Documentación automática en /docs",
]

for feat in server_features:
    p = P(stylename=normal_style)
    p.addText("• " + feat)
    doc.text.addElement(p)

# ============================================
# SECCIÓN 4: CASO DE USO
# ============================================
doc.text.addElement(H(outlinelevel=1, stylename=h1_style, text="🎯 Caso de Uso Real"))

use_cases = [
    "1. Subir un Excel desorganizado de un agricultor",
    "2. El Sort Bot lo ordena automáticamente en la plantilla oficial",
    "3. Si necesita ajustes, abrir el RTE Editor y decir:",
    "   • 'Cambia la fecha del tratamiento 39 a 25 de marzo'",
    "   • 'Pon glifosato en la parcela 15-234-1'",
    "4. El sistema valida, previsualiza y aplica - todo protegido con rollback",
]

for uc in use_cases:
    p = P(stylename=normal_style)
    p.addText(uc)
    doc.text.addElement(p)

# ============================================
# SECCIÓN 5: ESTADO
# ============================================
doc.text.addElement(H(outlinelevel=1, stylename=h1_style, text="✅ Estado del Proyecto"))

status = [
    "85/85 tests pasados (100%)",
    "Producción local lista",
    "Escalable a Redis/Docker cuando se necesite",
]

for s in status:
    p = P(stylename=normal_style)
    p.addText("✓ " + s)
    doc.text.addElement(p)

# ============================================
# SECCIÓN 6: ARQUITECTURA
# ============================================
doc.text.addElement(H(outlinelevel=1, stylename=h1_style, text="📁 Arquitectura de Archivos"))

arch = [
    "run.py - CLI del Sort Bot",
    "rte_server.py - Servidor FastAPI",
    "frontend/ - UI visual (index.html, styles.css, app.js)",
    "src/workbook_rte.py - Motor RTE",
    "src/rte_ai_processor.py - IA con OpenAI",
    "src/rte_api.py - API interna",
    "src/rte_semantic_resolver.py - Resolutor semántico",
    "src/rte_fuzzy_resolver.py - Fuzzy matching",
    "src/rte_contract_validator.py - Validación de contratos",
]

for a in arch:
    p = P(stylename=normal_style)
    p.addText("📄 " + a)
    doc.text.addElement(p)

# ============================================
# FOOTER
# ============================================
p = P(stylename=normal_style)
doc.text.addElement(p)

p = P(stylename=subtitle_style)
p.addText("Desarrollado para Hernández Bueno - Automatización de Cuadernos de Explotación Agrícola 🌾")
doc.text.addElement(p)

p = P(stylename=normal_style)
p.addText("Versión: 2.0 Enterprise | Fecha: Febrero 2026")
doc.text.addElement(p)

# ============================================
# GUARDAR
# ============================================
output_path = "/Volumes/Uniclick4TB/organizadorhndezbueno/excel_sort_bot/Hernandez_Bueno_RTE_Enterprise.odt"
doc.save(output_path)
print(f"✅ Documento generado: {output_path}")
