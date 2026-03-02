#!/usr/bin/env python3
"""
🔥 TEST ENTERPRISE: Semantic Resolver + Contract Validator
Prueba los blindajes enterprise.
"""
import sys
import shutil
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))

from src.rte_semantic_resolver import SemanticResolver
from src.rte_contract_validator import (
    ContractValidator, ValueValidator, DataType,
    SecureProposal, FileLockManager, file_lock_manager
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
    print_header("🔥 TEST ENTERPRISE: Blindajes v1.0")
    print(f"  Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    BASE_DIR = Path(__file__).parent
    TEST_FILE = BASE_DIR / "JUAN_GARCIA_HERNANDEZ_2026_RESUELTO.xlsx"
    
    if not TEST_FILE.exists():
        print(f"❌ Archivo no existe: {TEST_FILE}")
        return 1
    
    results = []
    
    # ============================================
    # 1. SEMANTIC RESOLVER
    # ============================================
    print_header("1. SEMANTIC RESOLVER")
    
    resolver = SemanticResolver(str(TEST_FILE))
    
    # Test: "fila 15"
    target = resolver.resolve("fila 15")
    results.append(test_result(
        "Fila directa",
        15 in target.rows,
        f"'fila 15' → rows={target.rows}"
    ))
    
    # Test: "orden X" (buscar un orden que exista)
    target = resolver.resolve("orden 1")
    results.append(test_result(
        "Orden numérico",
        len(target.rows) > 0,
        f"'orden 1' → {target.description}"
    ))
    
    # Test: resolver columna
    col = resolver.resolve_column("fecha", "inf.trat 1")
    results.append(test_result(
        "Columna fecha",
        col == "E",
        f"'fecha' → col {col}"
    ))
    
    col = resolver.resolve_column("producto", "inf.trat 1")
    results.append(test_result(
        "Columna producto",
        col == "I",
        f"'producto' → col {col}"
    ))
    
    col = resolver.resolve_column("dosis", "inf.trat 1")
    results.append(test_result(
        "Columna dosis",
        col == "K",
        f"'dosis' → col {col}"
    ))
    
    # Test: último tratamiento
    target = resolver.resolve("último tratamiento")
    results.append(test_result(
        "Último tratamiento",
        len(target.rows) > 0,
        f"→ {target.description}"
    ))
    
    # Test: combinar referencia + campo
    cell = resolver.get_cell_for_field("orden 1", "fecha")
    results.append(test_result(
        "get_cell_for_field",
        cell is not None and cell.startswith("E"),
        f"'orden 1' + 'fecha' → {cell}"
    ))
    
    resolver.close()
    
    # ============================================
    # 2. VALUE VALIDATORS
    # ============================================
    print_header("2. VALUE VALIDATORS")
    
    # Fecha válida
    valid, err, norm = ValueValidator.validate("25/03/2026", DataType.DATE)
    results.append(test_result(
        "Fecha DD/MM/YYYY",
        valid and isinstance(norm, datetime),
        f"'25/03/2026' → {norm}"
    ))
    
    # Fecha formato alternativo
    valid, err, norm = ValueValidator.validate("2026-03-25", DataType.DATE)
    results.append(test_result(
        "Fecha YYYY-MM-DD",
        valid,
        f"'2026-03-25' → {norm}"
    ))
    
    # Fecha inválida
    valid, err, norm = ValueValidator.validate("fecha_mala", DataType.DATE)
    results.append(test_result(
        "Fecha inválida",
        not valid,
        f"'fecha_mala' → error: {err}"
    ))
    
    # Dosis válida
    valid, err, norm = ValueValidator.validate("3,50 l", DataType.DOSE)
    results.append(test_result(
        "Dosis con unidad",
        valid and norm == "3,50 l",
        f"'3,50 l' → {norm}"
    ))
    
    # Dosis solo número → auto formato
    valid, err, norm = ValueValidator.validate("2.5", DataType.DOSE)
    results.append(test_result(
        "Dosis auto-formato",
        valid and "l" in norm,
        f"'2.5' → {norm}"
    ))
    
    # Superficie válida
    valid, err, norm = ValueValidator.validate("5,25", DataType.SURFACE)
    results.append(test_result(
        "Superficie válida",
        valid and norm == 5.25,
        f"'5,25' → {norm}"
    ))
    
    # Superficie <= 0
    valid, err, norm = ValueValidator.validate("-1", DataType.SURFACE)
    results.append(test_result(
        "Superficie negativa",
        not valid,
        f"'-1' → error"
    ))
    
    # Producto (uppercase)
    valid, err, norm = ValueValidator.validate("glifosato", DataType.PRODUCT)
    results.append(test_result(
        "Producto uppercase",
        valid and norm == "GLIFOSATO",
        f"'glifosato' → {norm}"
    ))
    
    # Fórmula válida
    valid, err, norm = ValueValidator.validate("=SUM(A1:A10)", DataType.FORMULA)
    results.append(test_result(
        "Fórmula permitida",
        valid,
        f"'=SUM()' → ok"
    ))
    
    # Fórmula bloqueada
    valid, err, norm = ValueValidator.validate("=INDIRECT(A1)", DataType.FORMULA)
    results.append(test_result(
        "Fórmula bloqueada",
        not valid,
        f"'=INDIRECT()' → bloqueada"
    ))
    
    # ============================================
    # 3. CONTRACT VALIDATOR
    # ============================================
    print_header("3. CONTRACT VALIDATOR")
    
    validator = ContractValidator()
    validator.set_sheet_names([
        "inf.gral 1", "inf.gral 2", "2.1. DATOS PARCELAS",
        "inf.trat 1", "inf.trat 2", "inf.trat 3", "inf.trat 4",
        "reg.prod", "reg.fert.", "reg. cosecha"
    ])
    
    # Alias "tratamientos" → "inf.trat 1"
    resolved = validator.resolve_sheet_name("tratamientos")
    results.append(test_result(
        "Alias tratamientos",
        resolved == "inf.trat 1",
        f"'tratamientos' → '{resolved}'"
    ))
    
    # Alias "parcelas"
    resolved = validator.resolve_sheet_name("parcelas")
    results.append(test_result(
        "Alias parcelas",
        resolved == "2.1. DATOS PARCELAS",
        f"'parcelas' → '{resolved}'"
    ))
    
    # Case-insensitive
    resolved = validator.resolve_sheet_name("INF.TRAT 1")
    results.append(test_result(
        "Case-insensitive",
        resolved == "inf.trat 1",
        f"'INF.TRAT 1' → '{resolved}'"
    ))
    
    # Validar edición de celda OK
    result = validator.validate_cell_edit("inf.trat 1", "E15", "25/03/2026")
    results.append(test_result(
        "Edit fecha OK",
        result.valid,
        f"E15 = '25/03/2026' → válido"
    ))
    
    # Validar edición de celda - fila protegida
    result = validator.validate_cell_edit("inf.trat 1", "E5", "25/03/2026")
    results.append(test_result(
        "Edit fila protegida",
        not result.valid,
        f"E5 → {result.errors}"
    ))
    
    # Validar operación de hoja protegida
    result = validator.validate_sheet_operation("DELETE", "inf.trat 1")
    results.append(test_result(
        "Delete hoja protegida",
        not result.valid,
        f"DELETE inf.trat 1 → {result.errors}"
    ))
    
    # ============================================
    # 4. TAMPER-PROOF PROPOSALS
    # ============================================
    print_header("4. TAMPER-PROOF PROPOSALS")
    
    # Crear propuesta segura
    ops = [{"op": "SET_CELL", "sheet": "inf.trat 1", "cell": "E15", "value": "25/03/2026"}]
    proposal = SecureProposal.create(
        proposal_id="test123",
        ops=ops,
        checksum_before="abc123",
        session_id="session1",
        ttl_minutes=10
    )
    
    results.append(test_result(
        "Proposal created",
        proposal.proposal_id == "test123",
        f"ID: {proposal.proposal_id}, hash: {proposal.ops_hash}"
    ))
    
    # Verificar hash OK
    results.append(test_result(
        "Verify ops_hash OK",
        proposal.verify_ops_hash(ops),
        "Ops sin modificar"
    ))
    
    # Verificar hash FAIL (ops modificadas)
    modified_ops = [{"op": "SET_CELL", "sheet": "inf.trat 1", "cell": "E15", "value": "MODIFIED"}]
    results.append(test_result(
        "Verify ops_hash FAIL",
        not proposal.verify_ops_hash(modified_ops),
        "Ops modificadas → detectado"
    ))
    
    # TTL
    results.append(test_result(
        "Proposal not expired",
        not proposal.is_expired(),
        f"Expires: {proposal.expires_at}"
    ))
    
    # ============================================
    # 5. FILE LOCKING
    # ============================================
    print_header("5. FILE LOCKING")
    
    test_path = "/tmp/test_lock_file.xlsx"
    
    # Adquirir lock
    success, error = file_lock_manager.acquire(test_path, "session_A")
    results.append(test_result(
        "Acquire lock",
        success,
        f"session_A → lock acquired"
    ))
    
    # Intentar lock desde otra sesión (debe fallar)
    success, error = file_lock_manager.acquire(test_path, "session_B")
    results.append(test_result(
        "Lock conflict",
        not success,
        f"session_B → {error}"
    ))
    
    # Misma sesión puede re-adquirir
    success, error = file_lock_manager.acquire(test_path, "session_A")
    results.append(test_result(
        "Same session reacquire",
        success,
        f"session_A → ok"
    ))
    
    # Verificar owner
    owner = file_lock_manager.get_lock_owner(test_path)
    results.append(test_result(
        "Lock owner",
        owner == "session_A",
        f"owner = {owner}"
    ))
    
    # Liberar lock
    released = file_lock_manager.release(test_path, "session_A")
    results.append(test_result(
        "Release lock",
        released,
        "Lock released"
    ))
    
    # Ahora session_B puede adquirir
    success, error = file_lock_manager.acquire(test_path, "session_B")
    results.append(test_result(
        "New session acquires",
        success,
        f"session_B → lock acquired"
    ))
    
    file_lock_manager.release(test_path, "session_B")
    
    # ============================================
    # SUMMARY
    # ============================================
    print_header("📊 TEST SUMMARY")
    
    passed = sum(1 for r in results if r)
    total = len(results)
    
    print(f"""
    Total tests: {total}
    Passed: {passed}
    Failed: {total - passed}
    
    {"✅ ALL TESTS PASSED!" if passed == total else "❌ SOME TESTS FAILED"}
    
    Enterprise Blindajes Tested:
    ✅ Semantic Resolver (orden, fila, parcela, producto)
    ✅ Column Resolver (fecha→E, producto→I, dosis→K)
    ✅ Value Validators (fecha, dosis, superficie, producto)
    ✅ Contract Validator (hojas/filas protegidas)
    ✅ Sheet Aliases (tratamientos, parcelas, etc.)
    ✅ Tamper-proof Proposals (ops_hash, TTL)
    ✅ File Locking (concurrencia)
    """)
    
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
