#!/usr/bin/env python3
"""
Genera PDF para experto en Excel (no tecnico)
"""
from fpdf import FPDF

class PDF(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, 'Hernandez Bueno - Organizador de Cuadernos', align='R')
        self.ln(15)
    
    def footer(self):
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Pagina {self.page_no()}', align='C')

    def title_section(self, title):
        self.set_font('Helvetica', 'B', 22)
        self.set_text_color(26, 54, 93)
        self.cell(0, 12, title, ln=True)
        self.ln(5)
    
    def subtitle(self, text):
        self.set_font('Helvetica', 'I', 13)
        self.set_text_color(74, 85, 104)
        self.cell(0, 8, text, ln=True)
        self.ln(8)
    
    def heading1(self, text):
        self.set_font('Helvetica', 'B', 16)
        self.set_text_color(44, 82, 130)
        self.cell(0, 10, text, ln=True)
        self.ln(3)
    
    def heading2(self, text):
        self.set_font('Helvetica', 'B', 13)
        self.set_text_color(43, 108, 176)
        self.cell(0, 8, text, ln=True)
        self.ln(2)
    
    def body_text(self, text):
        self.set_font('Helvetica', '', 11)
        self.set_text_color(0, 0, 0)
        self.cell(0, 7, text, ln=True)
    
    def bullet_point(self, text):
        self.set_font('Helvetica', '', 11)
        self.set_text_color(0, 0, 0)
        self.cell(0, 7, f"    - {text}", ln=True)
    
    def benefit_point(self, text):
        self.set_font('Helvetica', 'B', 11)
        self.set_text_color(34, 139, 34)
        self.cell(0, 7, f"    >> {text}", ln=True)

    def add_table(self, headers, rows):
        self.set_font('Helvetica', 'B', 10)
        self.set_fill_color(226, 232, 240)
        self.set_text_color(0, 0, 0)
        col_width = (self.w - 30) / len(headers)
        for header in headers:
            self.cell(col_width, 8, header, border=1, fill=True, align='C')
        self.ln()
        self.set_font('Helvetica', '', 10)
        for row in rows:
            for i, cell in enumerate(row):
                if i == 0:
                    self.set_font('Helvetica', 'B', 10)
                else:
                    self.set_font('Helvetica', '', 10)
                self.cell(col_width, 7, cell, border=1, align='L')
            self.ln()
        self.ln(5)


# Crear PDF
pdf = PDF()
pdf.add_page()

# TITULO
pdf.title_section("Organizador de Cuadernos de Explotacion")
pdf.subtitle("Automatiza el trabajo con Excels de clientes agricolas")

# ============================================
# EL PROBLEMA
# ============================================
pdf.heading1("El Problema que Resolvemos")
pdf.body_text("Cada agricultor envia sus datos en un Excel diferente:")
pdf.bullet_point("Unos ponen el NIF en la celda B5, otros en D10")
pdf.bullet_point("Las fechas vienen en formatos distintos")
pdf.bullet_point("Los nombres de productos no coinciden con los oficiales")
pdf.bullet_point("Hay que copiar todo a mano a la plantilla RESUELTO")
pdf.ln(2)
pdf.benefit_point("RESULTADO: Horas perdidas copiando y verificando datos")
pdf.ln(5)

# ============================================
# LA SOLUCION
# ============================================
pdf.heading1("Nuestra Solucion: Dos Herramientas Potentes")

pdf.heading2("1. Ordenador Automatico")
pdf.body_text("Sube el Excel desordenado del cliente y en segundos:")
pdf.bullet_point("Encuentra automaticamente nombre, NIF, direccion, parcelas")
pdf.bullet_point("Valida que el NIF/NIE sea correcto (algoritmo oficial)")
pdf.bullet_point("Rellena la plantilla RESUELTO manteniendo estilos")
pdf.bullet_point("Genera un informe de lo que encontro y lo que falta")
pdf.ln(2)
pdf.benefit_point("AHORRO: De 30 minutos a 30 segundos por cliente")
pdf.ln(5)

pdf.heading2("2. Editor Inteligente con IA")
pdf.body_text("Si necesitas hacer ajustes, simplemente escribe lo que quieres:")
pdf.ln(2)
pdf.body_text("   Ejemplos de comandos:")
pdf.body_text("   - Cambia la fecha del tratamiento 39 a 25 de marzo")
pdf.body_text("   - Pon glifosato en la parcela 15-234-1")
pdf.body_text("   - Corrige el NIF del titular")
pdf.ln(2)
pdf.body_text("El sistema entiende tu instruccion, encuentra la celda correcta,")
pdf.body_text("te muestra los cambios ANTES de aplicarlos, y si te equivocas")
pdf.body_text("puedes deshacer con un clic.")
pdf.ln(2)
pdf.benefit_point("VENTAJA: Edita como si hablaras con un asistente")
pdf.ln(5)

# ============================================
# SEGURIDAD
# ============================================
pdf.heading1("Protecciones para tu Tranquilidad")

pdf.add_table(
    ["Proteccion", "Que hace"],
    [
        ["Bloqueo de archivo", "Solo una persona edita a la vez"],
        ["Historial completo", "Todo cambio queda registrado"],
        ["Deshacer cambios", "Vuelve atras en cualquier momento"],
        ["Confirmacion doble", "Los borrados requieren confirmar"],
        ["Validacion datos", "Avisa si un dato no es correcto"],
    ]
)

# ============================================
# FLUJO DE TRABAJO
# ============================================
pdf.heading1("Como se Usa (Paso a Paso)")

pdf.body_text("1. RECIBIR: El agricultor te envia su Excel")
pdf.body_text("2. SUBIR: Arrastras el archivo a la herramienta")
pdf.body_text("3. ORDENAR: El sistema extrae los datos automaticamente")
pdf.body_text("4. REVISAR: Ves que ha encontrado y que falta")
pdf.body_text("5. AJUSTAR: Si algo falta, lo corriges con comandos simples")
pdf.body_text("6. GUARDAR: Descargas el Excel final listo")
pdf.ln(5)

# ============================================
# BENEFICIOS
# ============================================
pdf.heading1("Beneficios Clave")

pdf.benefit_point("90% menos tiempo procesando cada cliente")
pdf.benefit_point("Cero errores de copia manual")
pdf.benefit_point("Validacion automatica de NIFs y fechas")
pdf.benefit_point("Historial de todos los cambios para auditoria")
pdf.benefit_point("Funciona con cualquier Excel que te envien")
pdf.ln(5)

# ============================================
# RESULTADO
# ============================================
pdf.heading1("Resultado Final")
pdf.body_text("Pasas de dedicar media manana a ordenar Excels de clientes...")
pdf.body_text("...a tenerlo todo listo mientras tomas el cafe de la manana.")
pdf.ln(5)

pdf.set_font('Helvetica', 'I', 10)
pdf.set_text_color(100, 100, 100)
pdf.cell(0, 6, "Desarrollado para Hernandez Bueno", ln=True)
pdf.cell(0, 6, "Cuadernos de Explotacion Agricola - Febrero 2026", ln=True)

# Guardar
output_path = "/Volumes/Uniclick4TB/organizadorhndezbueno/excel_sort_bot/Hernandez_Bueno_Para_Expertos_Excel.pdf"
pdf.output(output_path)
print(f"PDF generado: {output_path}")
