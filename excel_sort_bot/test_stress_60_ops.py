#!/usr/bin/env python3
"""
🔥 STRESS TEST: 60 Operaciones con IA en 3 Cuadernos
Prueba masiva del sistema RTE Enterprise con ediciones reales.
"""
import sys
import shutil
from pathlib import Path
from datetime import datetime
import random

sys.path.insert(0, str(Path(__file__).parent))

from src.rte_api import (
    rte_start_session,
    rte_preview,
    rte_commit,
    rte_resolve,
    rte_export_audit,
    rte_close
)


def print_header(title):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")


def print_op(num, instruction, result, success):
    status = "✅" if success else "❌"
    cells = result.get("cells_changed", 0)
    rows = result.get("rows_changed", 0)
    print(f"  {status} [{num:02d}] {instruction[:50]}... → cells={cells}, rows={rows}")
    return success


# ============================================
# INSTRUCCIONES PARA TESTS (20 por archivo)
# ============================================

INSTRUCTIONS_SET_1 = [
    # Fechas
    "Cambia la fecha de la fila 15 a 20/03/2026",
    "Actualiza la fecha del tratamiento de la fila 25 a 15/04/2026",
    "Pon la fecha 10/05/2026 en la fila 35",
    "Modifica la fecha de la fila 45 a 22/06/2026",
    # Dosis
    "Cambia la dosis de la fila 20 a 3,50 l",
    "Actualiza la dosis de la fila 30 a 2,00 kg",
    "Pon dosis 4,25 l en la fila 40",
    "Modifica la dosis de la fila 50 a 1,75 l",
    # Productos (observaciones)
    "Añade 'Aplicación preventiva' como observación en fila 18",
    "Escribe 'Tratamiento urgente' en observaciones de fila 28",
    "Pon 'Revisado por técnico' en observaciones de fila 38",
    "Añade observación 'Control mensual' en fila 48",
    # Operaciones estructurales
    "Inserta 2 filas después de la 60",
    "Inserta 3 filas después de la 80",
    "Crea una hoja llamada 'Notas 2026'",
    # Más cambios
    "Cambia la fecha de fila 55 a 01/07/2026",
    "Actualiza dosis de fila 65 a 5,00 l",
    "Pon observación 'Fin de campaña' en fila 75",
    "Cambia fecha de fila 85 a 15/08/2026",
    "Actualiza la dosis de fila 90 a 2,50 l",
]

INSTRUCTIONS_SET_2 = [
    # Fechas diferentes
    "Cambia la fecha de la fila 12 a 05/03/2026",
    "Actualiza la fecha del tratamiento de la fila 22 a 18/04/2026",
    "Pon la fecha 25/05/2026 en la fila 32",
    "Modifica la fecha de la fila 42 a 08/06/2026",
    # Dosis diferentes
    "Cambia la dosis de la fila 17 a 4,00 l",
    "Actualiza la dosis de la fila 27 a 3,25 kg",
    "Pon dosis 2,75 l en la fila 37",
    "Modifica la dosis de la fila 47 a 6,00 l",
    # Observaciones
    "Añade 'Fumigación programada' como observación en fila 14",
    "Escribe 'Pendiente revisión' en observaciones de fila 24",
    "Pon 'Aprobado inspector' en observaciones de fila 34",
    "Añade observación 'Segundo pase' en fila 44",
    # Estructurales
    "Inserta 4 filas después de la 70",
    "Inserta 2 filas después de la 95",
    "Crea una hoja llamada 'Registro Extra'",
    # Más
    "Cambia la fecha de fila 52 a 12/07/2026",
    "Actualiza dosis de fila 62 a 3,80 l",
    "Pon observación 'Dosis ajustada' en fila 72",
    "Cambia fecha de fila 82 a 20/08/2026",
    "Actualiza la dosis de fila 92 a 4,50 l",
]

INSTRUCTIONS_SET_3 = [
    # Fechas
    "Cambia la fecha de la fila 13 a 08/03/2026",
    "Actualiza la fecha del tratamiento de la fila 23 a 22/04/2026",
    "Pon la fecha 30/05/2026 en la fila 33",
    "Modifica la fecha de la fila 43 a 15/06/2026",
    # Dosis
    "Cambia la dosis de la fila 19 a 3,75 l",
    "Actualiza la dosis de la fila 29 a 2,50 kg",
    "Pon dosis 5,25 l en la fila 39",
    "Modifica la dosis de la fila 49 a 1,50 l",
    # Observaciones
    "Añade 'Tratamiento estándar' como observación en fila 16",
    "Escribe 'Verificado campo' en observaciones de fila 26",
    "Pon 'Sin incidencias' en observaciones de fila 36",
    "Añade observación 'Repetir en 15 días' en fila 46",
    # Estructurales
    "Inserta 3 filas después de la 55",
    "Inserta 2 filas después de la 85",
    "Crea una hoja llamada 'Control Adicional'",
    # Más
    "Cambia la fecha de fila 58 a 05/07/2026",
    "Actualiza dosis de fila 68 a 4,20 l",
    "Pon observación 'Cierre temporada' en fila 78",
    "Cambia fecha de fila 88 a 25/08/2026",
    "Actualiza la dosis de fila 95 a 3,00 l",
]


def process_file(file_path: str, instructions: list, file_num: int):
    """Procesa un archivo con las instrucciones dadas"""
    
    print_header(f"ARCHIVO {file_num}: {Path(file_path).name}")
    print(f"   Total instrucciones: {len(instructions)}")
    
    results = []
    
    # Iniciar sesión
    try:
        session = rte_start_session(file_path, mode="ADMIN")
        session_id = session["session_id"]
        print(f"   Session: {session_id} (locked)")
    except Exception as e:
        print(f"   ❌ Error iniciando sesión: {e}")
        return results
    
    # Procesar cada instrucción
    for i, instruction in enumerate(instructions, 1):
        try:
            # Preview con IA
            preview = rte_preview(
                session_id=session_id,
                instruction=instruction,
                use_ai=True
            )
            
            if not preview["ops"]:
                print(f"  ⚠️ [{i:02d}] No ops generadas: {instruction[:40]}...")
                results.append(False)
                continue
            
            # Commit (force=True para destructivas)
            needs_force = preview.get("requires_confirmation", False)
            commit = rte_commit(
                session_id, 
                preview["proposal_id"],
                force=needs_force
            )
            
            success = commit.get("success", False)
            results.append(print_op(i, instruction, commit, success))
            
        except Exception as e:
            print(f"  ❌ [{i:02d}] Error: {str(e)[:50]}")
            results.append(False)
    
    # Export audit
    try:
        audit = rte_export_audit(session_id)
        print(f"\n   📊 Audit: {audit['total_commits']} commits exitosos")
    except Exception as e:
        print(f"\n   ⚠️ Audit error: {e}")
    
    # Cerrar sesión
    try:
        rte_close(session_id)
        print(f"   Session closed ✅")
    except Exception as e:
        print(f"   ⚠️ Close error: {e}")
    
    return results


def main():
    print_header("🔥 STRESS TEST: 60 Operaciones con IA")
    print(f"   Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    BASE_DIR = Path(__file__).parent
    
    # Archivos a procesar
    FILES = [
        ("ENRIQUE_IGLESIAS_LOPEZ_2026_RESUELTO.xlsx", INSTRUCTIONS_SET_1),
        ("JUAN_GARCIA_HERNANDEZ_2026_RESUELTO.xlsx", INSTRUCTIONS_SET_2),
        ("PEDRO_PEREZ_MARTINEZ_2026_RESUELTO.xlsx", INSTRUCTIONS_SET_3),
    ]
    
    all_results = []
    
    for i, (filename, instructions) in enumerate(FILES, 1):
        file_path = BASE_DIR / filename
        
        if not file_path.exists():
            print(f"\n⚠️ Archivo no existe: {filename}")
            continue
        
        # Crear backup
        backup = BASE_DIR / f"BACKUP_{filename}"
        if not backup.exists():
            shutil.copy(file_path, backup)
            print(f"\n📁 Backup creado: BACKUP_{filename}")
        
        results = process_file(str(file_path), instructions, i)
        all_results.extend(results)
    
    # ============================================
    # SUMMARY
    # ============================================
    print_header("📊 RESUMEN FINAL")
    
    passed = sum(1 for r in all_results if r)
    total = len(all_results)
    
    print(f"""
    Total operaciones: {total}
    Exitosas: {passed}
    Fallidas: {total - passed}
    Tasa de éxito: {passed/total*100:.1f}%
    
    {"✅ STRESS TEST COMPLETADO!" if passed > total * 0.8 else "⚠️ REVISAR ERRORES"}
    
    Archivos modificados:
    - ENRIQUE_IGLESIAS_LOPEZ_2026_RESUELTO.xlsx
    - JUAN_GARCIA_HERNANDEZ_2026_RESUELTO.xlsx  
    - PEDRO_PEREZ_MARTINEZ_2026_RESUELTO.xlsx
    
    Backups creados (por si necesitas restaurar):
    - BACKUP_ENRIQUE_IGLESIAS_LOPEZ_2026_RESUELTO.xlsx
    - BACKUP_JUAN_GARCIA_HERNANDEZ_2026_RESUELTO.xlsx
    - BACKUP_PEDRO_PEREZ_MARTINEZ_2026_RESUELTO.xlsx
    """)
    
    return 0 if passed > total * 0.8 else 1


if __name__ == "__main__":
    sys.exit(main())
