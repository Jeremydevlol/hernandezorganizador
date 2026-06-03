-- =============================================================================
-- ESQUEMA COMPLETO — Nueva base de datos Supabase (Cuaderno de Explotación)
-- Pegar TODO en: Supabase → SQL Editor → Run
-- Crea las 3 tablas que usa el backend: cuadernos, carpetas, productos_globales
-- =============================================================================

-- ───────────────────────────── CARPETAS ─────────────────────────────────────
create table if not exists public.carpetas (
  id         text primary key,
  nombre     text not null,
  parent_id  text references public.carpetas(id) on delete set null,
  orden      integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_carpetas_parent
  on public.carpetas (parent_id);

-- ───────────────────────────── CUADERNOS ────────────────────────────────────
create table if not exists public.cuadernos (
  id               text primary key,
  nombre           text,
  titular          text,
  anio             integer,
  data             jsonb not null,
  num_parcelas     integer default 0,
  num_tratamientos integer default 0,
  carpeta_id       text references public.carpetas(id) on delete set null,
  updated_at       timestamptz default now()
);

create index if not exists idx_cuadernos_anio_nombre
  on public.cuadernos (anio desc nulls last, nombre asc nulls last);
create index if not exists idx_cuadernos_anio
  on public.cuadernos (anio desc nulls last);
create index if not exists idx_cuadernos_titular
  on public.cuadernos (titular asc nulls last);
create index if not exists idx_cuadernos_updated_at
  on public.cuadernos (updated_at desc);
create index if not exists idx_cuadernos_carpeta
  on public.cuadernos (carpeta_id);

-- ─────────────────────────── PRODUCTOS_GLOBALES ─────────────────────────────
create table if not exists public.productos_globales (
  id               text primary key,
  nombre_comercial text,
  numero_registro  text,
  materia_activa   text,
  formulacion      text,
  tipo             text default 'fitosanitario',
  unidad           text default 'L',
  proveedor        text,
  notas            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- Índice único para el upsert por (nombre_comercial + numero_registro)
create unique index if not exists idx_productos_globales_unico
  on public.productos_globales (lower(nombre_comercial), lower(coalesce(numero_registro, '')));

-- =============================================================================
-- NOTA SOBRE RLS (Row Level Security)
-- El backend (FastAPI) accede con la SECRET KEY (service_role), que ignora RLS.
-- Para que funcione SIN configurar políticas, deja RLS DESACTIVADO en estas
-- tablas (es lo que hay ahora). Si activas RLS, tendrás que añadir políticas
-- que permitan al service_role el acceso completo.
-- =============================================================================
