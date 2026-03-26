-- =============================================================================
-- Cuadernos: organización por año (carpeta) y agricultor (nombre / titular)
-- Ejecutar en Supabase → SQL Editor (o psql) después de crear la tabla base.
-- =============================================================================

-- Tabla base (si aún no existe). Ajusta según tu despliegue.
create table if not exists public.cuadernos (
  id text primary key,
  nombre text,
  titular text,
  anio integer,
  data jsonb not null,
  updated_at timestamptz default now()
);

comment on column public.cuadernos.anio is
  'Año de campaña: agrupa en el explorador (carpetas por año) y filtra listados';

comment on column public.cuadernos.nombre is
  'Nombre de la explotación / etiqueta principal del agricultor en el listado';

comment on column public.cuadernos.titular is
  'Titular del cuaderno (nombre del agricultor cuando difiere del nombre de explotación)';

-- Listar por campaña más reciente y luego por nombre (como el sidebar: año → agricultor)
create index if not exists idx_cuadernos_anio_nombre
  on public.cuadernos (anio desc nulls last, nombre asc nulls last);

-- Consultas solo por año (carpetas “Campaña 2026”, etc.)
create index if not exists idx_cuadernos_anio
  on public.cuadernos (anio desc nulls last);

-- Opcional: búsqueda por titular
create index if not exists idx_cuadernos_titular
  on public.cuadernos (titular asc nulls last);

-- Índice de actualización (últimos modificados)
create index if not exists idx_cuadernos_updated_at
  on public.cuadernos (updated_at desc);
