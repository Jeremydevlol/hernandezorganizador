"""
Sistema de logging para registro y errores
"""
import json
from pathlib import Path
from datetime import datetime
from typing import Optional

from .types import ValidationError, LogEntry, LogStatus


class Logger:
    """
    Logger para registro de operaciones y errores
    """
    
    def __init__(self, debug: bool = False, output_dir: Optional[str] = None):
        """
        Args:
            debug: Si True, imprime mensajes de debug
            output_dir: Directorio para guardar logs (opcional)
        """
        self.debug = debug
        self.output_dir = Path(output_dir) if output_dir else None
        self.messages: list[dict] = []
    
    def log(self, level: str, message: str, **extra):
        """Log genérico"""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "message": message,
            **extra
        }
        self.messages.append(entry)
        
        if self.debug or level in ("ERROR", "WARN"):
            prefix = f"[{level}]"
            print(f"{prefix} {message}")
    
    def info(self, message: str, **extra):
        """Log de información"""
        self.log("INFO", message, **extra)
    
    def debug_log(self, message: str, **extra):
        """Log de debug"""
        if self.debug:
            self.log("DEBUG", message, **extra)
    
    def warn(self, message: str, **extra):
        """Log de warning"""
        self.log("WARN", message, **extra)
    
    def error(self, message: str, **extra):
        """Log de error"""
        self.log("ERROR", message, **extra)
    
    def log_extraction(self, field_key: str, success: bool, 
                       source: Optional[str] = None, value: any = None):
        """Log de extracción de campo"""
        level = "INFO" if success else "WARN"
        msg = f"Campo '{field_key}': {'OK' if success else 'NO ENCONTRADO'}"
        if source:
            msg += f" (fuente: {source})"
        if value and success:
            msg += f" = {str(value)[:50]}"
        
        self.log(level, msg, field=field_key, success=success)
    
    def log_write(self, field_key: str, target: str, success: bool):
        """Log de escritura"""
        level = "INFO" if success else "ERROR"
        msg = f"Escribir '{field_key}' en {target}: {'OK' if success else 'ERROR'}"
        self.log(level, msg, field=field_key, target=target)
    
    def save_errors(self, errors: list[ValidationError], 
                    output_path: Optional[str] = None):
        """
        Guarda errores de validación en JSON
        
        Args:
            errors: Lista de errores de validación
            output_path: Ruta del archivo (o usa output_dir + errors.json)
        """
        if not errors:
            return
        
        if output_path is None:
            if self.output_dir:
                output_path = str(self.output_dir / "output_errors.json")
            else:
                output_path = "output_errors.json"
        
        errors_data = {
            "generated_at": datetime.now().isoformat(),
            "total_errors": len(errors),
            "errors": [
                {
                    "field": e.field_key,
                    "type": e.error_type,
                    "message": e.message,
                    "source_sheet": e.source_sheet,
                    "source_cell": e.source_cell,
                    "raw_value": str(e.raw_value) if e.raw_value else None
                }
                for e in errors
            ]
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(errors_data, f, ensure_ascii=False, indent=2)
        
        self.info(f"Errores guardados en: {output_path}")
    
    def save_full_log(self, output_path: Optional[str] = None):
        """Guarda el log completo en JSON"""
        if output_path is None:
            if self.output_dir:
                output_path = str(self.output_dir / "full_log.json")
            else:
                output_path = "full_log.json"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.messages, f, ensure_ascii=False, indent=2)
    
    def get_summary(self) -> dict:
        """Devuelve un resumen del log"""
        levels = {}
        for msg in self.messages:
            level = msg.get("level", "UNKNOWN")
            levels[level] = levels.get(level, 0) + 1
        
        return {
            "total_messages": len(self.messages),
            "by_level": levels
        }
    
    def print_summary(self):
        """Imprime un resumen del procesamiento"""
        summary = self.get_summary()
        print("\n" + "="*50)
        print("RESUMEN DE PROCESAMIENTO")
        print("="*50)
        print(f"Total mensajes: {summary['total_messages']}")
        for level, count in summary['by_level'].items():
            print(f"  {level}: {count}")
        print("="*50)
