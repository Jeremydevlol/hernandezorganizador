# 🚀 Guía de Upgrade: Persistencia con Supabase (v2.5)

Esta guía detalla cómo migrar el almacenamiento de propuestas (actualmente en memoria RAM) a una base de datos persistente (Supabase) para soportar reinicios y múltiples instancias.

---

## 🛑 El Problema Actual (Memoria RAM)

Actualmente en `api/server.py`:
```python
proposals_store = {}           # Se borra al reiniciar
committed_proposals = {}       # Se pierde la protección anti-duplicados al reiniciar
```

**Consecuencias:**
1. Si Render/Heroku reinicia el dyno, todas las propuestas pendientes dan **Error 404**.
2. Si escalas a 2 servidores, la memoria no se comparte.
3. Si el servidor se cae, "olvida" qué tratamientos ya ejecutó, permitiendo duplicados accidentales.

---

## ✅ La Solución: Tabla `proposals` en Supabase

### 1. SQL Schema (Ejecutar en Supabase SQL Editor)

```sql
-- Tabla para almacenar propuestas temporales y su estado
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  status text check (status in ('pending', 'committed', 'expired')) default 'pending',
  
  -- Datos del archivo temporal
  file_path text not null,
  
  -- Para auditoría y recuperación
  original_filename text,
  
  -- JSON completo con el intent, parcels, rows (lo que hoy guardamos en RAM)
  data jsonb not null,
  
  -- Commit info (para idempotencia)
  committed_at timestamptz,
  
  -- TTL index: borrado automático después de 24h (opcional)
  expires_at timestamptz default (now() + interval '24 hours')
);

-- Índice para búsquedas rápidas
create index idx_proposals_status on public.proposals(status);
```

### 2. Cambios en `api/server.py`

#### A. Nuevas dependencias
```bash
pip install supabase
```

#### B. Inicialización
```python
import os
from supabase import create_client, Client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)
```

#### C. Crear Propuesta (POST /preview)
Reemplazar `proposals_store[id] = data` por:

```python
data_payload = {
    "intent": intent,
    "resolved_date": resolved_date,
    "matched_parcels": [p.to_dict() for p in matched_parcels],
    "rows": rows_preview,
    "treatment_data": treatment_data
}

res = supabase.table("proposals").insert({
    "file_path": str(input_path),
    "data": data_payload,
    "status": "pending"
}).execute()

proposal_id = res.data[0]['id']
```

#### D. Commit Propuesta (POST /commit)
Reemplazar la lógica de memoria por:

```python
# 1. Verificar estado actual (Idempotencia DB-level)
res = supabase.table("proposals").select("*").eq("id", proposal_id).single().execute()
proposal = res.data

if not proposal:
    raise HTTPException(404, "Propuesta no encontrada")

if proposal['status'] == 'committed':
     return JSONResponse(status_code=409, content={"error": "ALREADY_COMMITTED", ...})

# 2. Ejecutar lógica de escritura (ParcelManager...)
# ... (código existente) ...

# 3. Marcar como committed (Atomic Update)
supabase.table("proposals").update({
    "status": "committed",
    "committed_at": "now()"
}).eq("id", proposal_id).execute()
```

---

## 🧹 Limpieza (Cron Job)

En lugar de `cleanup_old_proposals()` en Python que gasta CPU, usa **pg_cron** en Supabase o simplemente deja que los archivos temporales se limpien solos, ya que los metadatos pesan poco.

Si necesitas borrar archivos físicos:
- Mantén un job ligero en Python que consulte `proposals` donde `created_at < now() - 1 hour` y borre los `file_path`.

---

## 🚀 Beneficios
- **Persistent:** Sobrevive a reinicios.
- **Auditable:** Tienes un historial SQL de cada tratamiento generado.
- **Scalable:** Funciona con N servidores concurrentes.
