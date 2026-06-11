-- PREPARADO PERO SIN EJECUTAR: no aplicar en Supabase sin autorización de Loren.
-- RLS queda activado en todas las tablas. Sin políticas anon/authenticated:
-- deniega todo por defecto. El backend debe acceder con service_role.
CREATE TABLE IF NOT EXISTS public.rimp_segments (
  id TEXT PRIMARY KEY,
  source_scope TEXT NOT NULL,
  source_file TEXT NOT NULL,
  source_annex TEXT,
  source_page INTEGER,
  source_row_raw TEXT NOT NULL,
  road TEXT,
  road_normalized TEXT,
  segment_from TEXT,
  segment_to TEXT,
  pk_start REAL,
  pk_end REAL,
  geometry_geojson TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('alta','media','baja','pendiente')),
  method TEXT NOT NULL,
  active_year INTEGER NOT NULL DEFAULT 2026,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rimp_segments_road ON public.rimp_segments(road_normalized);
CREATE INDEX IF NOT EXISTS idx_rimp_segments_scope ON public.rimp_segments(source_scope);

ALTER TABLE public.rimp_segments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.route_calculations (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider TEXT NOT NULL,
  origin_text TEXT NOT NULL,
  destination_text TEXT NOT NULL,
  departure_date DATE NOT NULL,
  departure_time TIME NOT NULL,
  cargo_type TEXT NOT NULL DEFAULT 'general',
  vehicle_profile JSONB NOT NULL,
  request_json JSONB NOT NULL,
  response_json JSONB NOT NULL,
  selected_route_geometry JSONB,
  selected_route_distance_km REAL,
  fixed_speed_kmh REAL NOT NULL DEFAULT 78,
  eta_minutes INTEGER,
  eta_at TIMESTAMPTZ,
  crossed_restrictions_json JSONB,
  warnings_json JSONB
);
CREATE INDEX IF NOT EXISTS idx_route_calculations_created_at ON public.route_calculations(created_at);
CREATE INDEX IF NOT EXISTS idx_route_calculations_provider ON public.route_calculations(provider);

ALTER TABLE public.route_calculations ENABLE ROW LEVEL SECURITY;

-- Sin políticas para anon/authenticated por ahora: deniega todo por defecto.
-- El backend de panel usa SUPABASE_SERVICE_ROLE_KEY mediante supabaseAdmin,
-- que bypasses RLS; si en el futuro hay lectura desde cliente, crear políticas
-- SELECT específicas antes de exponer las tablas.
