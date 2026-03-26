-- =============================================================================
-- Carpetas: organización jerárquica de cuadernos
-- Ejecutar en Supabase → SQL Editor (o psql)
-- =============================================================================

-- Tabla de carpetas (soporta anidamiento con parent_id)
create table if not exists public.carpetas (
  id text primary key,
  nombre text not null,
  parent_id text references public.carpetas(id) on delete set null,
  orden integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.carpetas is
  'Carpetas para organizar cuadernos. parent_id=null → carpeta raíz.';

create index if not exists idx_carpetas_parent
  on public.carpetas (parent_id);

-- Añadir carpeta_id a la tabla de cuadernos
alter table public.cuadernos
  add column if not exists carpeta_id text references public.carpetas(id) on delete set null;

create index if not exists idx_cuadernos_carpeta
  on public.cuadernos (carpeta_id);
