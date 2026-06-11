-- PREPARADO PERO SIN EJECUTAR: no aplicar en Supabase sin autorización de Loren.
CREATE TABLE IF NOT EXISTS restriction_geometries (
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
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (restriction_id) REFERENCES restrictions(id)
);
CREATE INDEX IF NOT EXISTS idx_restriction_geometries_restriction_id ON restriction_geometries(restriction_id);
CREATE INDEX IF NOT EXISTS idx_restriction_geometries_confidence ON restriction_geometries(confidence);
CREATE INDEX IF NOT EXISTS idx_restriction_geometries_road ON restriction_geometries(road_normalized);
