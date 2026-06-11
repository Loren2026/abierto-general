-- PREPARADO PERO SIN EJECUTAR: no aplicar en Supabase sin autorización de Loren.
-- Nota: los 381 registros actuales de restricciones viven en el backend FastAPI
-- (JSON procesado + SQLite local), no en una tabla public.restrictions de Supabase.
-- Por eso restriction_id queda como TEXT indexado, sin FOREIGN KEY, para evitar
-- fallo en el SQL editor hasta que Loren autorice migrar también restrictions.
CREATE TABLE IF NOT EXISTS public.restriction_geometries (
  id TEXT PRIMARY KEY,
  restriction_id TEXT NOT NULL,
  source_scope TEXT NOT NULL,
  road_normalized TEXT,
  geometry_geojson TEXT NOT NULL,
  buffer_geojson TEXT,
  geometry_type TEXT NOT NULL DEFAULT 'LineString',
  buffer_meters REAL DEFAULT 60,
  direction TEXT,
  method TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('alta','media','baja')),
  source_reference TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_restriction_geometries_restriction_id ON public.restriction_geometries(restriction_id);
CREATE INDEX IF NOT EXISTS idx_restriction_geometries_confidence ON public.restriction_geometries(confidence);
CREATE INDEX IF NOT EXISTS idx_restriction_geometries_road ON public.restriction_geometries(road_normalized);

ALTER TABLE public.restriction_geometries ENABLE ROW LEVEL SECURITY;

-- Sin políticas para anon/authenticated por ahora: deniega todo por defecto.
-- El backend de panel usa SUPABASE_SERVICE_ROLE_KEY mediante supabaseAdmin,
-- que bypasses RLS; cuando se exponga lectura pública/autenticada se añadirá
-- una política explícita y revisada.
