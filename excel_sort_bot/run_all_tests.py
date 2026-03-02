#!/usr/bin/env python3
"""
🔥 SUITE COMPLETA DE PRUEBAS — Hernandez Bueno Sort Bot v2.2 🔥

Ejecuta TODOS los tests del sistema:
- Tests 1-6 Básicos (BY_CROP, BY_MUNICIPIO, exclusión, AND)
- Prueba 7 Enterprise (end-to-end básico)
- Prueba 8 Enterprise v2 (preflight, META_VALIDATION)
- Prueba 9 Idempotencia (double commit attack)
- Prueba 0 E2E (300 parcelas, stress test, fingerprint)

Uso: python3 run_all_tests.py
"""
import sys
import subprocess
from pathlib import Path
from datetime import datetime

# Colores ANSI
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

BASE_DIR = Path(__file__).parent


def print_header():
    print(f"\n{CYAN}{'='*70}{RESET}")
    print(f"{BOLD}{CYAN}  🔥 HERNANDEZ BUENO SORT BOT — SUITE COMPLETA DE PRUEBAS 🔥{RESET}")
    print(f"{CYAN}{'='*70}{RESET}")
    print(f"  Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Base Dir: {BASE_DIR}")
    print(f"{CYAN}{'='*70}{RESET}\n")


def run_test(name: str, script_path: str) -> bool:
    """Ejecuta un test y retorna True si pasa"""
    print(f"\n{YELLOW}{'─'*60}{RESET}")
    print(f"{BOLD}▶ {name}{RESET}")
    print(f"{YELLOW}{'─'*60}{RESET}")
    
    full_path = BASE_DIR / script_path
    
    if not full_path.exists():
        print(f"{RED}❌ Archivo no encontrado: {script_path}{RESET}")
        return False
    
    try:
        result = subprocess.run(
            [sys.executable, str(full_path)],
            cwd=str(BASE_DIR),
            capture_output=True,
            text=True,
            timeout=300  # 5 min max por test
        )
        
        # Mostrar output
        if result.stdout:
            # Filtrar solo líneas importantes
            lines = result.stdout.split('\n')
            for line in lines:
                if any(x in line for x in ['✅', '❌', '🎉', '⚠️', 'PASS', 'FAIL', '📊', '💬', '🔑']):
                    print(f"  {line}")
        
        if result.returncode == 0:
            print(f"\n{GREEN}✅ {name}: PASSED{RESET}")
            return True
        else:
            print(f"\n{RED}❌ {name}: FAILED (exit code {result.returncode}){RESET}")
            if result.stderr:
                print(f"  Error: {result.stderr[:500]}")
            return False
            
    except subprocess.TimeoutExpired:
        print(f"{RED}❌ {name}: TIMEOUT (>5 min){RESET}")
        return False
    except Exception as e:
        print(f"{RED}❌ {name}: ERROR - {e}{RESET}")
        return False


def main():
    print_header()
    
    # Lista de tests a ejecutar
    tests = [
        ("Tests 1-6 Básicos", "test_internal.py"),
        ("Prueba 7 Enterprise", "test_enterprise.py"),
        ("Prueba 8 Enterprise v2", "test_enterprise_v2.py"),
        ("Prueba 9 Idempotencia", "test_idempotency.py"),
        ("Template Fingerprint", "tests/test_template_fingerprint.py"),
        ("Prueba 0 E2E (300 parcelas)", "tests/test_prueba0_e2e.py"),
    ]
    
    results = {}
    
    for name, script in tests:
        results[name] = run_test(name, script)
    
    # Resumen final
    print(f"\n{CYAN}{'='*70}{RESET}")
    print(f"{BOLD}{CYAN}  📊 RESUMEN FINAL{RESET}")
    print(f"{CYAN}{'='*70}{RESET}\n")
    
    passed = 0
    failed = 0
    
    for name, success in results.items():
        if success:
            print(f"  {GREEN}✅ {name}{RESET}")
            passed += 1
        else:
            print(f"  {RED}❌ {name}{RESET}")
            failed += 1
    
    total = len(results)
    
    print(f"\n{CYAN}{'─'*40}{RESET}")
    print(f"  Total: {passed}/{total} tests pasados")
    
    if failed == 0:
        print(f"\n{GREEN}{BOLD}🎉🎉🎉 TODOS LOS TESTS PASARON 🎉🎉🎉{RESET}")
        print(f"{GREEN}El sistema v2.2 está listo para producción.{RESET}\n")
        return 0
    else:
        print(f"\n{RED}{BOLD}⚠️ {failed} test(s) fallaron{RESET}")
        print(f"{YELLOW}Revisa los errores antes de desplegar.{RESET}\n")
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
