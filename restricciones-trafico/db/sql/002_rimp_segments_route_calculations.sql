-- PREPARADO PERO SIN EJECUTAR: no aplicar en Supabase sin autorización de Loren.
CREATE TABLE IF NOT EXISTS rimp_segments (
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
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rimp_segments_road ON rimp_segments(road_normalized);
CREATE INDEX IF NOT EXISTS idx_rimp_segments_scope ON rimp_segments(source_scope);

CREATE TABLE IF NOT EXISTS route_calculations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  provider TEXT NOT NULL,
  origin_text TEXT NOT NULL,
  destination_text TEXT NOT NULL,
  departure_date TEXT NOT NULL,
  departure_time TEXT NOT NULL,
  cargo_type TEXT NOT NULL DEFAULT 'general',
  vehicle_profile TEXT NOT NULL,
  request_json TEXT NOT NULL,
  response_json TEXT NOT NULL,
  selected_route_geometry TEXT,
  selected_route_distance_km REAL,
  fixed_speed_kmh REAL NOT NULL DEFAULT 78,
  eta_minutes INTEGER,
  eta_at TEXT,
  crossed_restrictions_json TEXT,
  warnings_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_route_calculations_created_at ON route_calculations(created_at);
CREATE INDEX IF NOT EXISTS idx_route_calculations_provider ON route_calculations(provider);
