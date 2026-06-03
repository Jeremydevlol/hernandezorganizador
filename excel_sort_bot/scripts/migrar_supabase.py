#!/usr/bin/env python3
"""
Migra los datos de una base de datos Supabase a otra.
Copia las tablas: cuadernos, carpetas, productos_globales.

Uso (credenciales por variables de entorno, NO hardcodeadas):

    export OLD_SUPABASE_URL="https://VIEJO.supabase.co"
    export OLD_SUPABASE_KEY="<secret key de la BD vieja>"
    export NEW_SUPABASE_URL="https://lfjgzhiurpdqtnrgnwww.supabase.co"
    export NEW_SUPABASE_KEY="<secret key de la BD nueva>"
    python3 scripts/migrar_supabase.py

Requisitos: la tabla 'cuadernos', 'carpetas' y 'productos_globales' deben existir
ya en la BD nueva (ejecuta antes docs/schema_nueva_bd_completo.sql).

El script es idempotente: usa upsert por id, así que puedes re-ejecutarlo.
"""
import os
import sys

try:
    from supabase import create_client
except ImportError:
    print("Falta supabase-py. Instala con: pip install supabase")
    sys.exit(1)


TABLAS = ["carpetas", "cuadernos", "productos_globales"]


def _cliente(url_env: str, key_env: str):
    url = os.environ.get(url_env)
    key = os.environ.get(key_env)
    if not url or not key:
        print(f"Faltan {url_env} y/o {key_env} en el entorno.")
        sys.exit(1)
    return create_client(url, key)


def _leer_todo(client, tabla: str):
    """Lee todas las filas de una tabla paginando (evita el límite de 1000)."""
    filas = []
    paso = 1000
    inicio = 0
    while True:
        resp = client.table(tabla).select("*").range(inicio, inicio + paso - 1).execute()
        lote = resp.data or []
        filas.extend(lote)
        if len(lote) < paso:
            break
        inicio += paso
    return filas


def main():
    old = _cliente("OLD_SUPABASE_URL", "OLD_SUPABASE_KEY")
    new = _cliente("NEW_SUPABASE_URL", "NEW_SUPABASE_KEY")

    total = 0
    for tabla in TABLAS:
        try:
            filas = _leer_todo(old, tabla)
        except Exception as e:
            print(f"  ⚠️  No se pudo leer '{tabla}' de la BD vieja ({e}); se omite.")
            continue
        if not filas:
            print(f"  · {tabla}: 0 filas (nada que migrar)")
            continue
        # Insertar en lotes de 100 para no exceder límites de payload
        migradas = 0
        for i in range(0, len(filas), 100):
            lote = filas[i:i + 100]
            try:
                new.table(tabla).upsert(lote).execute()
                migradas += len(lote)
            except Exception as e:
                print(f"  ⚠️  Error subiendo lote de '{tabla}' ({e}); intentando fila a fila…")
                for fila in lote:
                    try:
                        new.table(tabla).upsert(fila).execute()
                        migradas += 1
                    except Exception as e2:
                        print(f"      ✗ fila id={fila.get('id')} falló: {e2}")
        print(f"  ✓ {tabla}: {migradas}/{len(filas)} filas migradas")
        total += migradas

    print(f"\n✅ Migración completada. {total} filas copiadas a la BD nueva.")


if __name__ == "__main__":
    main()
