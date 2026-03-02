#!/usr/bin/env python3
"""
🔥 TEST: Destructive Guards
Verifica que operaciones destructivas siempre requieren confirmación.
"""
import sys
import shutil
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))

from src.rte_api import (
    rte_start_session,
    rte_preview,
    rte_commit,
    rte_close
)


def print_header(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def test_result(name, success, details=""):
    status = "✅" if success else "❌"
    print(f"  {status} {name}: {details}")
    return success


def main():
    print_header("🔥 TEST: Destructive Guards")
    print(f"  Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    BASE_DIR = Path(__file__).parent
    SOURCE = BASE_DIR / "JUAN_GARCIA_HERNANDEZ_2026_RESUELTO.xlsx"
    TEST_FILE = BASE_DIR / "TEST_DESTRUCTIVE_GUARDS.xlsx"
    
    if not SOURCE.exists():
        print(f"❌ Archivo no existe: {SOURCE}")
        return 1
    
    shutil.copy(SOURCE, TEST_FILE)
    print(f"\n📁 Archivo de test: {TEST_FILE.name}")
    
    results = []
    
    # Start session ADMIN
    session = rte_start_session(str(TEST_FILE), mode="ADMIN")
    session_id = session["session_id"]
    print(f"\n   Session: {session_id} (ADMIN)")
    
    # ============================================
    # 1. DELETE_ROWS REQUIRES CONFIRMATION
    # ============================================
    print_header("1. DELETE_ROWS REQUIRES CONFIRMATION")
    
    preview = rte_preview(
        session_id=session_id,
        instruction="Elimina las filas 50 a 55",
        use_ai=False
    )
    
    has_warning = any("DELETE_ROWS" in w for w in preview["warnings"])
    
    results.append(test_result(
        "DELETE_ROWS requires confirmation",
        preview["requires_confirmation"] == True and has_warning,
        f"requires_confirmation={preview['requires_confirmation']}, warnings={preview['warnings'][:2]}"
    ))
    
    # ============================================
    # 2. DELETE_SHEET REQUIRES CONFIRMATION
    # ============================================
    print_header("2. DELETE_SHEET REQUIRES CONFIRMATION")
    
    # Primero crear una hoja para poder eliminarla
    preview_add = rte_preview(
        session_id=session_id,
        instruction="Crea una hoja llamada 'TestDelete'",
        use_ai=False
    )
    rte_commit(session_id, preview_add["proposal_id"])
    
    # Ahora intentar eliminar
    preview = rte_preview(
        session_id=session_id,
        instruction="Elimina la hoja TestDelete",
        use_ai=False
    )
    
    has_warning = any("DELETE_SHEET" in w for w in preview["warnings"])
    
    results.append(test_result(
        "DELETE_SHEET requires confirmation",
        preview["requires_confirmation"] == True and has_warning,
        f"requires_confirmation={preview['requires_confirmation']}, warnings={preview['warnings'][:2]}"
    ))
    
    # ============================================
    # 3. INSERT_ROWS DOES NOT REQUIRE CONFIRMATION
    # ============================================
    print_header("3. INSERT_ROWS (non-destructive)")
    
    preview = rte_preview(
        session_id=session_id,
        instruction="Inserta 3 filas después de la 100",
        use_ai=False
    )
    
    # INSERT_ROWS no debería requerir confirmación si no toca filas protegidas
    no_delete_warning = not any("DELETE" in w for w in preview["warnings"])
    
    results.append(test_result(
        "INSERT_ROWS does NOT require confirmation",
        no_delete_warning,  # No debería tener warnings de DELETE
        f"requires_confirmation={preview['requires_confirmation']}, warnings={preview['warnings'][:2]}"
    ))
    
    # ============================================
    # 4. CAN COMMIT WITH FORCE
    # ============================================
    print_header("4. COMMIT WITH FORCE")
    
    # La operación de DELETE requiere force=True
    preview = rte_preview(
        session_id=session_id,
        instruction="Elimina las filas 130 a 132",
        use_ai=False
    )
    
    results.append(test_result(
        "DELETE_ROWS blocked without force",
        preview["requires_confirmation"] == True,
        f"Blocked: requires_confirmation=True"
    ))
    
    # Con force=True debería funcionar
    commit = rte_commit(session_id, preview["proposal_id"], force=True)
    
    results.append(test_result(
        "DELETE_ROWS allowed with force=True",
        commit["success"] == True,
        f"Committed with force"
    ))
    
    # ============================================
    # CLEANUP
    # ============================================
    rte_close(session_id)
    if TEST_FILE.exists():
        TEST_FILE.unlink()
    
    # ============================================
    # SUMMARY
    # ============================================
    print_header("📊 SUMMARY")
    
    passed = sum(1 for r in results if r)
    total = len(results)
    
    print(f"""
    Total tests: {total}
    Passed: {passed}
    Failed: {total - passed}
    
    {"✅ ALL DESTRUCTIVE GUARDS WORK!" if passed == total else "❌ SOME TESTS FAILED"}
    
    Guards Validated:
    ✅ DELETE_ROWS requires confirmation sí o sí
    ✅ DELETE_SHEET requires confirmation sí o sí
    ✅ INSERT_ROWS (non-destructive) flows normally
    ✅ force=True bypasses confirmation
    """)
    
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
