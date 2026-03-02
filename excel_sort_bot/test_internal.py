"""
Script de pruebas internas para el sistema Preview/Commit v2
Con soporte de: cultivo vs municipio, recinto, exclusiones
"""
import sys
import json
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent))

from src.ai_processor import AIProcessor, resolve_date
from src.parcel_manager import ParcelManager

TEST_FILE = "/Volumes/Uniclick4TB/organizadorhndezbueno/PABLO PEREZ RUBIO 2025.xlsx"


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def test_case_1():
    """Test: BY_CROP - Cobre en cereales (cultivo real)"""
    print_section("TEST 1: Cobre en CEREALES (BY_CROP)")
    
    pm = ParcelManager(TEST_FILE)
    context = pm.get_context_for_ai()
    
    print(f"🌱 Cultivos disponibles: {context['crops']}")
    print(f"📍 Municipios disponibles: {context['municipios']}")
    
    ai = AIProcessor()
    message = "Aplica Cobre a 3 kg/ha ayer en todas las cebadas"
    
    print(f"\n💬 Comando: \"{message}\"")
    print("⏳ Consultando IA...")
    
    intent = ai.interpret_command(message, context)
    
    if "error" in intent:
        print(f"❌ Error IA: {intent['error']}")
        return False
    
    print(f"\n🤖 Intent recibido:")
    print(json.dumps(intent, indent=2, ensure_ascii=False))
    
    filters = intent.get("filters", {})
    targets = filters.get("targets", {})
    scope = targets.get("scope", "")
    
    print(f"\n📊 Verificaciones:")
    print(f"  • Scope: {scope} {'✅' if scope == 'BY_CROP' else '⚠️'}")
    print(f"  • Crop filter: {targets.get('crop')}")
    print(f"  • Municipio filter: {targets.get('municipio')} {'✅ (debe ser null)' if not targets.get('municipio') else '⚠️'}")
    
    date_obj = intent.get("data", {}).get("date", {})
    resolved_date = resolve_date(date_obj)
    print(f"  • Fecha resuelta: {resolved_date}")
    
    matched = pm.filter_parcels(scope, targets)
    print(f"  • Parcelas coincidentes: {len(matched)}")
    
    if matched:
        print(f"    Primeras 3:")
        for p in matched[:3]:
            print(f"      - Pol {p.polygon}, Parc {p.parcel}, Rec {p.recinto}: {p.crop} ({p.surface_ha} ha)")
    
    return scope == "BY_CROP" and len(matched) > 0


def test_case_2():
    """Test: BY_POLYGON_AND_PARCEL con recinto específico"""
    print_section("TEST 2: Polígono 502, parcela 5334 (un solo recinto)")
    
    pm = ParcelManager(TEST_FILE)
    context = pm.get_context_for_ai()
    
    ai = AIProcessor()
    message = "Añade Glifosato 3 l/ha hoy en polígono 502 parcela 5334"
    
    print(f"\n💬 Comando: \"{message}\"")
    
    intent = ai.interpret_command(message, context)
    
    if "error" in intent:
        print(f"❌ Error IA: {intent['error']}")
        return False
    
    targets = intent.get("filters", {}).get("targets", {})
    scope = targets.get("scope", "")
    
    print(f"\n📊 Verificaciones:")
    print(f"  • Scope: {scope} {'✅' if scope == 'BY_POLYGON_AND_PARCEL' else '⚠️'}")
    print(f"  • Polygon: {targets.get('polygon')}")
    print(f"  • Parcel: {targets.get('parcel')}")
    
    matched = pm.filter_parcels(scope, targets)
    print(f"  • Parcelas coincidentes: {len(matched)} {'✅' if len(matched) == 1 else '⚠️'}")
    
    if matched:
        for p in matched:
            print(f"    - Pol {p.polygon}, Parc {p.parcel}, Rec {p.recinto}: {p.surface_ha} ha")
    
    return len(matched) == 1


def test_case_3():
    """Test: Múltiples recintos sin exclusión"""
    print_section("TEST 3: Múltiples recintos (Pol 501, Parc 5011)")
    
    pm = ParcelManager(TEST_FILE)
    context = pm.get_context_for_ai()
    
    target_parcels = [p for p in pm.get_parcels() if p.polygon == 501 and p.parcel == 5011]
    print(f"📁 Recintos encontrados para Pol 501, Parc 5011: {len(target_parcels)}")
    for p in target_parcels:
        print(f"    - Recinto {p.recinto}: {p.surface_ha} ha, {p.crop}")
    
    ai = AIProcessor()
    message = "Añade Glifosato 3 l/ha hoy en polígono 501 parcela 5011"
    
    print(f"\n💬 Comando: \"{message}\"")
    
    intent = ai.interpret_command(message, context)
    
    if "error" in intent:
        print(f"❌ Error IA: {intent['error']}")
        return False
    
    targets = intent.get("filters", {}).get("targets", {})
    scope = targets.get("scope", "")
    
    matched = pm.filter_parcels(scope, targets)
    recintos = [p.recinto for p in matched]
    
    print(f"\n📊 Verificaciones:")
    print(f"  • Parcelas coincidentes: {len(matched)} {'✅' if len(matched) == len(target_parcels) else '⚠️'}")
    print(f"  • Recintos encontrados: {recintos}")
    
    treatment_data = intent.get("data", {})
    rows = pm.generate_treatment_rows(matched, treatment_data, "04/02/2026", start_order=1)
    
    print(f"\n📝 Filas generadas: {len(rows)}")
    for row in rows:
        print(f"    {row}")
    
    return len(matched) == len(target_parcels)


def test_case_4():
    """Test: Exclusión de recinto"""
    print_section("TEST 4: EXCLUSIÓN DE RECINTO (excepto recinto 2)")
    
    pm = ParcelManager(TEST_FILE)
    context = pm.get_context_for_ai()
    
    # Ver recintos disponibles
    target_parcels = [p for p in pm.get_parcels() if p.polygon == 501 and p.parcel == 5011]
    print(f"📁 Recintos existentes para Pol 501, Parc 5011:")
    for p in target_parcels:
        print(f"    - Recinto {p.recinto}: {p.surface_ha} ha")
    
    ai = AIProcessor()
    message = "Añade Glifosato 3 l/ha hoy en polígono 501 parcela 5011, excepto recinto 2"
    
    print(f"\n💬 Comando: \"{message}\"")
    print("⏳ Consultando IA...")
    
    intent = ai.interpret_command(message, context)
    
    if "error" in intent:
        print(f"❌ Error IA: {intent['error']}")
        return False
    
    print(f"\n🤖 Intent recibido:")
    print(json.dumps(intent, indent=2, ensure_ascii=False))
    
    targets = intent.get("filters", {}).get("targets", {})
    scope = targets.get("scope", "")
    
    print(f"\n📊 Verificaciones:")
    print(f"  • exclude_recinto: {targets.get('exclude_recinto')} {'✅' if targets.get('exclude_recinto') == [2] else '⚠️'}")
    
    matched = pm.filter_parcels(scope, targets)
    recintos_matched = [p.recinto for p in matched]
    
    print(f"  • Parcelas coincidentes: {len(matched)}")
    print(f"  • Recintos incluidos: {recintos_matched}")
    
    # Verificar que recinto 2 NO está incluido
    recinto_2_excluido = 2 not in recintos_matched
    print(f"  • Recinto 2 excluido: {'✅ SÍ' if recinto_2_excluido else '❌ NO'}")
    
    if matched:
        for p in matched:
            print(f"    - Recinto {p.recinto}: {p.surface_ha} ha")
    
    return recinto_2_excluido


def test_case_5():
    """Test: BY_MUNICIPIO (no confundir con cultivo)"""
    print_section("TEST 5: BY_MUNICIPIO (en MACOTERA)")
    
    pm = ParcelManager(TEST_FILE)
    context = pm.get_context_for_ai()
    
    print(f"📍 Municipios disponibles: {context['municipios']}")
    
    ai = AIProcessor()
    message = "Aplica Azufre 2 kg/ha hoy en todas las parcelas de MACOTERA"
    
    print(f"\n💬 Comando: \"{message}\"")
    print("⏳ Consultando IA...")
    
    intent = ai.interpret_command(message, context)
    
    if "error" in intent:
        print(f"❌ Error IA: {intent['error']}")
        return False
    
    print(f"\n🤖 Intent recibido:")
    print(json.dumps(intent, indent=2, ensure_ascii=False))
    
    targets = intent.get("filters", {}).get("targets", {})
    scope = targets.get("scope", "")
    
    print(f"\n📊 Verificaciones:")
    print(f"  • Scope: {scope} {'✅' if scope == 'BY_MUNICIPIO' else '⚠️ (esperado BY_MUNICIPIO)'}")
    print(f"  • Municipio filter: {targets.get('municipio')}")
    print(f"  • Crop filter: {targets.get('crop')} {'✅ (debe ser null)' if not targets.get('crop') else '⚠️'}")
    
    # Filtrar con el municipio
    logic = intent.get("filters", {}).get("logic", "AND")
    matched = pm.filter_parcels(scope, targets, logic)
    
    print(f"  • Parcelas coincidentes: {len(matched)}")
    
    if matched:
        print(f"    Primeras 5:")
        for p in matched[:5]:
            print(f"      - Pol {p.polygon}, Parc {p.parcel}: {p.crop} @ {p.municipio}")
    
    # Verificar que son del municipio correcto
    all_macotera = all("MACOTERA" in p.municipio for p in matched) if matched else False
    print(f"  • Todas de MACOTERA: {'✅' if all_macotera else '⚠️'}")
    
    return scope == "BY_MUNICIPIO" and len(matched) > 0


def test_case_6():
    """Test: Lógica AND compleja (crop + municipio + exclusión de recinto)"""
    print_section("TEST 6: LÓGICA AND COMPLEJA (trigo de MACOTERA, excepto recinto 2)")
    
    pm = ParcelManager(TEST_FILE)
    context = pm.get_context_for_ai()
    
    # Primero veamos cuántos trigos hay en MACOTERA
    all_parcels = pm.get_parcels()
    trigo_macotera = [p for p in all_parcels if "TRIGO" in p.crop and "MACOTERA" in p.municipio]
    print(f"📊 Trigo en MACOTERA (manual): {len(trigo_macotera)}")
    for p in trigo_macotera[:5]:
        print(f"    - Pol {p.polygon}, Parc {p.parcel}, Rec {p.recinto}: {p.surface_ha} ha")
    if len(trigo_macotera) > 5:
        print(f"    ... y {len(trigo_macotera) - 5} más")
    
    ai = AIProcessor()
    message = "Aplica Glifosato 3 l/ha hoy en todo el trigo de MACOTERA, excepto recinto 2"
    
    print(f"\n💬 Comando: \"{message}\"")
    print("⏳ Consultando IA...")
    
    intent = ai.interpret_command(message, context)
    
    if "error" in intent:
        print(f"❌ Error IA: {intent['error']}")
        return False
    
    print(f"\n🤖 Intent recibido:")
    print(json.dumps(intent, indent=2, ensure_ascii=False))
    
    filters = intent.get("filters", {})
    targets = filters.get("targets", {})
    logic = filters.get("logic", "AND")
    scope = targets.get("scope", "")
    
    print(f"\n📊 Verificaciones:")
    print(f"  • Logic: {logic}")
    print(f"  • Scope: {scope}")
    print(f"  • Crop: {targets.get('crop')}")
    print(f"  • Municipio: {targets.get('municipio')}")
    print(f"  • exclude_recinto: {targets.get('exclude_recinto')}")
    
    # Filtrar con lógica AND
    matched = pm.filter_parcels(scope, targets, logic)
    
    print(f"\n  • Parcelas coincidentes: {len(matched)}")
    if matched:
        for p in matched:
            print(f"    - Pol {p.polygon}, Parc {p.parcel}, Rec {p.recinto}: {p.crop} @ {p.municipio} ({p.surface_ha} ha)")
    
    # Verificaciones
    all_trigo = all("TRIGO" in p.crop for p in matched) if matched else False
    all_macotera = all("MACOTERA" in p.municipio for p in matched) if matched else False
    no_recinto_2 = all(p.recinto != 2 for p in matched) if matched else True
    
    print(f"\n  • Todas TRIGO: {'✅' if all_trigo else '⚠️'}")
    print(f"  • Todas MACOTERA: {'✅' if all_macotera else '⚠️'}")
    print(f"  • Sin recinto 2: {'✅' if no_recinto_2 else '❌'}")
    
    # Generar filas
    treatment_data = intent.get("data", {})
    date_obj = treatment_data.get("date", {})
    from src.ai_processor import resolve_date
    resolved_date = resolve_date(date_obj)
    
    rows = pm.generate_treatment_rows(matched, treatment_data, resolved_date, start_order=1)
    print(f"\n📝 Filas a escribir: {len(rows)}")
    
    if rows:
        output_path, count = pm.write_treatments(rows, output_path="/tmp/test_tratamientos_6.xlsx")
        print(f"💾 Commit simulado: {count} filas escritas en {output_path}")
    
    success = all_trigo and all_macotera and no_recinto_2 and len(matched) > 0
    return success


def main():
    print("\n" + "🧪"*30)
    print("  PRUEBAS v2 - Schema con Recinto + Municipio/Cultivo")
    print("  Fecha actual: 04/02/2026 (Europe/Madrid)")
    print("🧪"*30)
    
    if not Path(TEST_FILE).exists():
        print(f"❌ Archivo de prueba no encontrado: {TEST_FILE}")
        return
    
    print(f"\n📄 Archivo de prueba: {TEST_FILE}")
    
    results = []
    
    tests = [
        ("Test 1: BY_CROP cereales", test_case_1),
        ("Test 2: Polígono/Parcela única", test_case_2),
        ("Test 3: Múltiples recintos", test_case_3),
        ("Test 4: EXCLUSIÓN de recinto", test_case_4),
        ("Test 5: BY_MUNICIPIO", test_case_5),
        ("Test 6: LÓGICA AND COMPLEJA", test_case_6),
    ]
    
    for name, test_fn in tests:
        try:
            results.append((name, test_fn()))
        except Exception as e:
            print(f"❌ Error en {name}: {e}")
            import traceback
            traceback.print_exc()
            results.append((name, False))
    
    print_section("RESUMEN DE PRUEBAS")
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status} - {name}")
    
    all_passed = all(r[1] for r in results)
    print(f"\n{'🎉 Todas las pruebas pasaron!' if all_passed else '⚠️ Algunas pruebas fallaron'}")


if __name__ == "__main__":
    main()
