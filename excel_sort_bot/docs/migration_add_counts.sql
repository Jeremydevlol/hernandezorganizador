-- =============================================================================
-- MIGRACIÓN: añadir columnas desnormalizadas para listar() rápido
-- Ejecutar en Supabase → SQL Editor
-- Objetivo: evitar descargar el JSONB data completo solo para contar filas
-- =============================================================================

-- 1. Añadir columnas (si no existen)
alter table public.cuadernos
    add column if not exists num_parcelas integer default 0,
    add column if not exists num_tratamientos integer default 0;

-- 2. Rellenar valores en filas existentes (backfill)
update public.cuadernos
set
    num_parcelas    = jsonb_array_length(coalesce(data->'parcelas', '[]'::jsonb)),
    num_tratamientos = jsonb_array_length(coalesce(data->'tratamientos', '[]'::jsonb))
where num_parcelas = 0 and num_tratamientos = 0;

-- 3. Índice para ordenar por updated_at (ya debería existir, pero por si acaso)
create index if not exists idx_cuadernos_updated_at
    on public.cuadernos (updated_at desc);

-- Listo. Las escrituras futuras del backend ya actualizarán estas columnas automáticamente.
