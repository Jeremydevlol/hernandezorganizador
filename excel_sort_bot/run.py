#!/usr/bin/env python3
"""
Hernandez Bueno Sort Bot - Ordenador profesional de Excels base usando plantilla RESUELTO

Uso:
    python run.py --input base.xlsx --template resuelto.xlsx --output final.xlsx
    python run.py --input-dir ./bases --template resuelto.xlsx --output-dir ./salidas
"""
import argparse
import json
import sys
from pathlib import Path
from datetime import datetime

# Añadir src al path
sys.path.insert(0, str(Path(__file__).parent))

from src.types import (
    SourceConfig, SourceType, TakeDirection, TargetConfig, 
    FieldConfig, MappingMeta, MappingConfig, ProcessingResult
)
from src.io_excel import ExcelReader, TemplateWriter
from src.extractors import RobustExtractor
from src.transformers import apply_transforms
from src.validators import Validator
from src.writers import OutputWriter
from src.logger import Logger


def load_mapping(mapping_path: str) -> MappingConfig:
    """Carga el archivo de mapping JSON"""
    with open(mapping_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Parsear meta
    meta_data = data.get("meta", {})
    meta = MappingMeta(
        template_default_sheet=meta_data.get("template_default_sheet", "Resumen"),
        log_sheet_name=meta_data.get("log_sheet_name", "LOG"),
        version=meta_data.get("version", "1.0")
    )
    
    # Parsear fields
    fields = []
    for field_data in data.get("fields", []):
        source_data = field_data.get("source", {})
        target_data = field_data.get("target", {})
        
        # Parsear source
        source_type_str = source_data.get("type", "label")
        source_type = SourceType(source_type_str)
        
        take_str = source_data.get("take", "right")
        take = TakeDirection(take_str)
        
        source = SourceConfig(
            type=source_type,
            labels=source_data.get("labels", []),
            take=take,
            max_distance=source_data.get("max_distance", 2),
            patterns=source_data.get("patterns", []),
            sheet_hint=source_data.get("sheet_hint"),
            copy_field=source_data.get("copy_field")
        )
        
        target = TargetConfig(
            sheet=target_data.get("sheet", meta.template_default_sheet),
            cell=target_data.get("cell", "A1")
        )
        
        field = FieldConfig(
            key=field_data.get("key", "unknown"),
            required=field_data.get("required", False),
            source=source,
            target=target,
            transforms=field_data.get("transforms", []),
            description=field_data.get("description", "")
        )
        
        fields.append(field)
    
    return MappingConfig(meta=meta, fields=fields)


def process_file(input_path: str, template_path: str, output_path: str,
                 mapping: MappingConfig, strict: bool = False,
                 debug: bool = False) -> ProcessingResult:
    """
    Procesa un archivo Excel base y genera el output
    
    Args:
        input_path: Ruta al Excel base
        template_path: Ruta a la plantilla RESUELTO
        output_path: Ruta del archivo de salida
        mapping: Configuración de mapping
        strict: Si True, detiene en cualquier error
        debug: Si True, imprime mensajes de debug
        
    Returns:
        ProcessingResult con el resultado del procesamiento
    """
    logger = Logger(debug=debug)
    logger.info(f"Procesando: {input_path}")
    logger.info(f"Plantilla: {template_path}")
    logger.info(f"Salida: {output_path}")
    
    # Inicializar
    extracted_values = []
    errors = []
    warnings = []
    
    try:
        # Abrir Excel base
        reader = ExcelReader(input_path)
        logger.info(f"Hojas encontradas en base: {reader.sheet_names}")
        
        # Inicializar extractor
        extractor = RobustExtractor(reader, debug=debug)
        
        # Inicializar writer con plantilla
        writer = OutputWriter(template_path, mapping.meta.log_sheet_name)
        
        # Inicializar validador
        validator = Validator(strict=strict)
        
        # Diccionario para guardar valores extraídos por key (para copy_from)
        extracted_by_key: dict[str, Any] = {}
        
        # Procesar cada campo del mapping
        for field in mapping.fields:
            logger.debug_log(f"\nProcesando campo: {field.key}")
            
            extracted = None
            
            # Manejar COPY_FROM (copiar de otro campo ya extraído)
            if field.source.type == SourceType.COPY_FROM:
                copy_key = field.source.copy_field
                if copy_key and copy_key in extracted_by_key:
                    copied_value = extracted_by_key[copy_key]
                    # Crear un ExtractedValue para el campo copiado
                    from src.types import ExtractedValue
                    extracted = ExtractedValue(
                        key=field.key,
                        raw_value=copied_value,
                        transformed_value=copied_value,
                        source_sheet="(copy)",
                        source_cell=f"from:{copy_key}",
                        extraction_method="copy_from",
                        confidence=1.0
                    )
                else:
                    logger.debug_log(f"  Campo fuente '{copy_key}' no encontrado para copiar")
            else:
                # 1. Extraer valor normalmente
                extracted = extractor.extract(field.key, field.source)
            
            if extracted:
                # 2. Aplicar transformaciones
                transformed_value = apply_transforms(
                    extracted.raw_value, 
                    field.transforms
                )
                extracted.transformed_value = transformed_value
                
                # Guardar valor transformado para posibles copy_from
                extracted_by_key[field.key] = transformed_value
                
                # 3. Validar
                is_valid = validator.validate_field(
                    transformed_value, 
                    field,
                    extracted.source_sheet,
                    extracted.source_cell
                )
                
                if is_valid or not strict:
                    # 4. Escribir en plantilla
                    success = writer.write_extracted_value(extracted, field)
                    
                    if success:
                        logger.log_extraction(
                            field.key, True, 
                            f"{extracted.source_sheet}!{extracted.source_cell}",
                            transformed_value
                        )
                        extracted_values.append(extracted)
                    else:
                        logger.error(f"No se pudo escribir campo '{field.key}'")
                        writer.log_error(field.key, "Error al escribir en plantilla")
            else:
                # Campo no encontrado
                msg = f"Campo '{field.key}' no encontrado"
                logger.log_extraction(field.key, False)
                writer.log_missing_field(field, msg)
                
                if field.required:
                    errors.append(msg)
                    if strict:
                        raise ValueError(msg)
                else:
                    warnings.append(msg)
        
        # Agregar errores del validador
        for error in validator.errors:
            errors.append(error.message)
        for warn in validator.warnings:
            warnings.append(warn)
        
        # Finalizar y guardar
        success = len(errors) == 0 or not strict
        
        if success:
            writer.finalize(output_path, write_log=True)
            logger.info(f"Archivo generado: {output_path}")
        else:
            logger.error("No se generó archivo debido a errores (modo strict)")
        
        # Guardar errores si los hay
        if validator.errors:
            error_path = str(Path(output_path).with_suffix('.errors.json'))
            logger.save_errors(validator.errors, error_path)
        
        # Cerrar
        reader.close()
        writer.close()
        
        # Resumen
        log_summary = writer.get_log_summary()
        logger.info(f"\nResumen: OK={log_summary['ok']}, WARN={log_summary['warnings']}, ERROR={log_summary['errors']}")
        
        return ProcessingResult(
            input_file=input_path,
            output_file=output_path,
            success=success,
            extracted_values=extracted_values,
            log_entries=writer.log_entries,
            errors=validator.errors,
            warnings=warnings
        )
        
    except Exception as e:
        logger.error(f"Error procesando archivo: {str(e)}")
        import traceback
        if debug:
            traceback.print_exc()
        
        return ProcessingResult(
            input_file=input_path,
            output_file=output_path,
            success=False,
            extracted_values=[],
            log_entries=[],
            errors=[],
            warnings=[str(e)]
        )


def process_directory(input_dir: str, template_path: str, output_dir: str,
                      mapping: MappingConfig, strict: bool = False,
                      debug: bool = False) -> list[ProcessingResult]:
    """
    Procesa todos los archivos Excel en un directorio
    Genera summary.json con estadísticas del batch
    """
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    results = []
    
    # Buscar archivos Excel
    excel_files = list(input_path.glob("*.xlsx")) + list(input_path.glob("*.xls"))
    
    # Filtrar archivos que empiecen con ~ (temporales) o que tengan RESUELTO/ORDENADO
    excel_files = [
        f for f in excel_files 
        if not f.name.startswith('~') 
        and 'RESUELTO' not in f.name.upper()
        and 'ORDENADO' not in f.name.upper()
    ]
    
    start_time = datetime.now()
    print(f"\nEncontrados {len(excel_files)} archivos Excel en {input_dir}")
    
    for i, excel_file in enumerate(excel_files, 1):
        print(f"\n[{i}/{len(excel_files)}] Procesando: {excel_file.name}")
        
        output_file = output_path / f"{excel_file.stem}_ORDENADO.xlsx"
        
        result = process_file(
            str(excel_file),
            template_path,
            str(output_file),
            mapping,
            strict=strict,
            debug=debug
        )
        
        results.append(result)
        
        status = "✓ OK" if result.success else "✗ ERROR"
        print(f"   {status}")
    
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    # Calcular estadísticas
    success_count = sum(1 for r in results if r.success)
    warning_count = sum(1 for r in results if r.success and len(r.warnings) > 0)
    error_count = sum(1 for r in results if not r.success)
    
    # Calcular confidence promedio
    all_confidences = []
    for r in results:
        for ev in r.extracted_values:
            all_confidences.append(ev.confidence)
    
    avg_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0
    
    # Generar summary.json
    summary = {
        "generated_at": datetime.now().isoformat(),
        "duration_seconds": round(duration, 2),
        "input_dir": str(input_dir),
        "output_dir": str(output_dir),
        "template": str(template_path),
        "total_files": len(results),
        "ok": success_count,
        "with_warnings": warning_count,
        "failed": error_count,
        "success_rate": round(success_count / len(results) * 100, 1) if results else 0,
        "average_confidence": round(avg_confidence, 3),
        "files": [
            {
                "input": r.input_file,
                "output": r.output_file,
                "status": "OK" if r.success else "ERROR",
                "fields_extracted": len(r.extracted_values),
                "warnings": len(r.warnings),
                "errors": len(r.errors),
                "avg_confidence": round(
                    sum(ev.confidence for ev in r.extracted_values) / len(r.extracted_values), 3
                ) if r.extracted_values else 0
            }
            for r in results
        ]
    }
    
    summary_path = output_path / "summary.json"
    with open(summary_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
    
    # Resumen final
    print(f"\n{'='*60}")
    print("RESUMEN BATCH")
    print(f"{'='*60}")
    print(f"Total archivos:     {len(results)}")
    print(f"✓ OK:               {success_count}")
    print(f"⚠ Con warnings:     {warning_count}")
    print(f"✗ Fallidos:         {error_count}")
    print(f"Tasa de éxito:      {summary['success_rate']}%")
    print(f"Confidence prom.:   {summary['average_confidence']}")
    print(f"Tiempo total:       {duration:.1f}s")
    print(f"{'='*60}")
    print(f"📄 Resumen guardado: {summary_path}")
    
    return results


def main():
    """Punto de entrada principal"""
    parser = argparse.ArgumentParser(
        description="Hernandez Bueno Sort Bot - Ordenador de Excels base usando plantilla RESUELTO",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  # Procesar un solo archivo
  python run.py --input base.xlsx --template resuelto.xlsx --output final.xlsx
  
  # Procesar una carpeta
  python run.py --input-dir ./bases --template resuelto.xlsx --output-dir ./salidas
  
  # Con modo debug
  python run.py --input base.xlsx --template resuelto.xlsx --output final.xlsx --debug
        """
    )
    
    # Argumentos de entrada
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument(
        '--input', '-i',
        metavar='FILE',
        help='Archivo Excel base a procesar'
    )
    input_group.add_argument(
        '--input-dir',
        metavar='DIR',
        help='Directorio con archivos Excel base a procesar'
    )
    
    # Plantilla (obligatorio)
    parser.add_argument(
        '--template', '-t',
        required=True,
        metavar='FILE',
        help='Archivo Excel plantilla RESUELTO'
    )
    
    # Salida
    parser.add_argument(
        '--output', '-o',
        metavar='FILE',
        help='Archivo Excel de salida (requerido si --input)'
    )
    parser.add_argument(
        '--output-dir',
        metavar='DIR',
        help='Directorio de salida (requerido si --input-dir)'
    )
    
    # Mapping
    parser.add_argument(
        '--mapping', '-m',
        default='config/mapping.json',
        metavar='FILE',
        help='Archivo de mapping JSON (default: config/mapping.json)'
    )
    
    # Opciones
    parser.add_argument(
        '--strict',
        action='store_true',
        help='Modo estricto: no genera output si hay errores'
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Modo debug: muestra mensajes detallados'
    )
    
    args = parser.parse_args()
    
    # Validar argumentos
    if args.input and not args.output:
        parser.error("Se requiere --output cuando se usa --input")
    
    if args.input_dir and not args.output_dir:
        parser.error("Se requiere --output-dir cuando se usa --input-dir")
    
    # Verificar que existen los archivos
    if args.input and not Path(args.input).exists():
        print(f"Error: No se encuentra el archivo de entrada: {args.input}")
        sys.exit(1)
    
    if not Path(args.template).exists():
        print(f"Error: No se encuentra la plantilla: {args.template}")
        sys.exit(1)
    
    if not Path(args.mapping).exists():
        print(f"Error: No se encuentra el mapping: {args.mapping}")
        sys.exit(1)
    
    # Cargar mapping
    print(f"\n{'='*60}")
    print("EXCEL SORT BOT - Ordenador de Excels")
    print(f"{'='*60}")
    print(f"Mapping: {args.mapping}")
    
    try:
        mapping = load_mapping(args.mapping)
        print(f"Campos configurados: {len(mapping.fields)}")
    except Exception as e:
        print(f"Error cargando mapping: {e}")
        sys.exit(1)
    
    # Procesar
    if args.input:
        # Archivo único
        result = process_file(
            args.input,
            args.template,
            args.output,
            mapping,
            strict=args.strict,
            debug=args.debug
        )
        
        sys.exit(0 if result.success else 1)
    else:
        # Directorio
        results = process_directory(
            args.input_dir,
            args.template,
            args.output_dir,
            mapping,
            strict=args.strict,
            debug=args.debug
        )
        
        success_count = sum(1 for r in results if r.success)
        sys.exit(0 if success_count == len(results) else 1)


if __name__ == "__main__":
    main()
