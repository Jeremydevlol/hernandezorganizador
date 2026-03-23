# Persistencia de Cuadernos con Supabase (Producción)

## Problema

En **Render** (y plataformas similares), el sistema de archivos es **efímero**:
- Los datos guardados en disco se **pierden** cuando el dyno se reinicia o duerme
- Los cuadernos editados desaparecen al recargar la página o volver a entrar

## Solución: Supabase

Para que los cuadernos se guarden de forma **persistente**, configura Supabase como almacenamiento. Paea q nsn **RENDER**

### 1. Crear tabla en Supabase

En el **SQL Editor** de tu proyecto Supabase, ejecuta:

```sql
-- Tabla para cuadernos de explotación (persistente)
create table if not exists public.cuadernos (
  id text primary key,
  nombre text,
  titular text,
  anio integer,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- Índice para listar por fecha de modificación
create index if not exists idx_cuadernos_updated_at on public.cuadernos(updated_at desc);

-- Habilitar RLS (opcional, para seguridad)
alter table public.cuadernos enable row level security;

-- Política: permitir todo al service role (backend)
create policy "Service role full access" on public.cuadernos
  for all using (true) with check (true);
```

### 2. Variables de entorno en Render agdhghbds&/&/&%%Rgayyys

En **Render Dashboard** → tu servicio → **Environment**:

| Variable | Valor |
|----------|-------|
| `STORAGE_MODE` | `supabase` |
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_KEY` | Tu **service_role** key (no la anon key) |

Obtén la URL y la key en: Supabase → Project Settings → API.

### 3. Reiniciar el servicio

Tras guardar las variables, Render reiniciará el servicio. Los cuadernos se guardarán en Supabase y **persistirán** entre recargas y reinicios.


