"""
Test Template Fingerprint
Valida que el fingerprinting detecta correctamente el cuaderno
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.template_fingerprint import fingerprint_workbook, load_registry, match_template, validate_template


FILE = "/Volumes/Uniclick4TB/organizadorhndezbueno/PABLO PEREZ RUBIO 2025.xlsx"


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def main():
    print_section("TEST: Template Fingerprint")
    
    if not Path(FILE).exists():
        print(f"❌ Archivo no encontrado: {FILE}")
        return False
    
    # 1) Fingerprint
    print_section("PASO 1: Generar Fingerprint")
    fp = fingerprint_workbook(FILE, parcels_sheet_hint_contains=["2.1.", "PARCELAS"])
    
    print(f"📊 Fingerprint:")
    print(f"   • Sheets: {len(fp.sheetnames)} hojas")
    print(f"   • Parcels sheet: {fp.parcels_sheet}")
    print(f"   • Header row: {fp.header_row}")
    print(f"   • Columns map: {fp.columns_map}")
    print(f"   • Header tokens (primeros 5): {fp.header_tokens[:5]}")
    
    # 2) Load Registry
    print_section("PASO 2: Cargar Registry")
    registry = load_registry()
    print(f"📋 Templates registrados: {len(registry['templates'])}")
    for t in registry["templates"]:
        print(f"   • {t['template_id']}")
    print(f"📋 Policy: accept >= {registry['policy']['accept_threshold']}, warn >= {registry['policy']['warn_threshold']}")
    
    # 3) Match Template
    print_section("PASO 3: Match Template")
    decision = match_template(fp, registry)
    
    print(f"🎯 Decisión:")
    print(f"   • Template ID: {decision['template_id']}")
    print(f"   • Score: {decision['score']}")
    print(f"   • Status: {decision['status']}")
    print(f"   • Reasons: {decision['reasons']}")
    
    # 4) Validate
    print_section("PASO 4: Validaciones")
    
    checks = {
        "parcels_sheet_found": fp.parcels_sheet is not None,
        "header_row_found": fp.header_row is not None,
        "polygon_column": "polygon" in fp.columns_map,
        "parcel_column": "parcel" in fp.columns_map,
        "recinto_column": "recinto" in fp.columns_map,
        "status_valid": decision["status"] in ["ACCEPT", "WARN"],
        "score_reasonable": decision["score"] >= 0.65,
    }
    
    for check, passed in checks.items():
        status = "✅" if passed else "❌"
        print(f"   {status} {check}")
    
    all_passed = all(checks.values())
    
    print_section("RESUMEN")
    if all_passed:
        print("🎉 Fingerprint test PASSED")
    else:
        print("⚠️ Fingerprint test FAILED")
    
    return all_passed


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
