"""
Writers para generar el output Excel y logs
"""
from datetime import datetime
from typing import Optional

from .types import ExtractedValue, LogEntry, LogStatus, FieldConfig
from .io_excel import TemplateWriter


class OutputWriter:
    """
    Escritor de outputs que combina plantilla + datos + log
    """
    
    def __init__(self, template_path: str, log_sheet_name: str = "LOG"):
        """
        Args:
            template_path: Ruta a la plantilla RESUELTO
            log_sheet_name: Nombre de la hoja de log
        """
        self.template_writer = TemplateWriter(template_path)
        self.log_sheet_name = log_sheet_name
        self.log_entries: list[LogEntry] = []
    
    def write_extracted_value(self, extracted: ExtractedValue, 
                              field: FieldConfig) -> bool:
        """
        Escribe un valor extraído en la plantilla
        
        Args:
            extracted: Valor extraído con metadatos
            field: Configuración del campo
            
        Returns:
            True si se escribió correctamente
        """
        success = self.template_writer.write_value(
            sheet_name=field.target.sheet,
            cell_ref=field.target.cell,
            value=extracted.transformed_value
        )
        
        # Registrar en log
        status = LogStatus.OK if success else LogStatus.ERROR
        
        self.log_entries.append(LogEntry(
            timestamp=datetime.now(),
            field_key=field.key,
            status=status,
            extraction_method=extracted.extraction_method,
            raw_value=extracted.raw_value,
            transformed_value=extracted.transformed_value,
            source_sheet=extracted.source_sheet,
            source_cell=extracted.source_cell,
            target_sheet=field.target.sheet,
            target_cell=field.target.cell,
            message="OK" if success else "Error al escribir"
        ))
        
        return success
    
    def log_missing_field(self, field: FieldConfig, message: str = "Campo no encontrado"):
        """Registra un campo que no se pudo extraer"""
        status = LogStatus.ERROR if field.required else LogStatus.WARN
        
        self.log_entries.append(LogEntry(
            timestamp=datetime.now(),
            field_key=field.key,
            status=status,
            extraction_method="none",
            raw_value=None,
            transformed_value=None,
            source_sheet=None,
            source_cell=None,
            target_sheet=field.target.sheet,
            target_cell=field.target.cell,
            message=message
        ))
    
    def log_error(self, field_key: str, message: str):
        """Registra un error genérico"""
        self.log_entries.append(LogEntry(
            timestamp=datetime.now(),
            field_key=field_key,
            status=LogStatus.ERROR,
            extraction_method="error",
            raw_value=None,
            transformed_value=None,
            message=message
        ))
    
    def log_warning(self, field_key: str, message: str):
        """Registra un warning"""
        self.log_entries.append(LogEntry(
            timestamp=datetime.now(),
            field_key=field_key,
            status=LogStatus.WARN,
            extraction_method="warning",
            raw_value=None,
            transformed_value=None,
            message=message
        ))
    
    def finalize(self, output_path: str, write_log: bool = True):
        """
        Finaliza y guarda el archivo de salida
        
        Args:
            output_path: Ruta del archivo de salida
            write_log: Si escribir la hoja de log
        """
        if write_log and self.log_entries:
            log_sheet = self.template_writer.add_log_sheet(self.log_sheet_name)
            self.template_writer.write_log_entries(log_sheet, self.log_entries)
        
        self.template_writer.save(output_path)
    
    def close(self):
        """Cierra el writer"""
        self.template_writer.close()
    
    def get_log_summary(self) -> dict:
        """Devuelve un resumen del log"""
        ok_count = sum(1 for e in self.log_entries if e.status == LogStatus.OK)
        warn_count = sum(1 for e in self.log_entries if e.status == LogStatus.WARN)
        error_count = sum(1 for e in self.log_entries if e.status == LogStatus.ERROR)
        
        return {
            "total": len(self.log_entries),
            "ok": ok_count,
            "warnings": warn_count,
            "errors": error_count
        }
