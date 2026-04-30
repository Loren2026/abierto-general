export const DB_NAME = 'gestactas_db';
export const DB_VERSION = 4;

export const STORES = {
  meta: 'meta',
  settings: 'settings',
  comunidades: 'comunidades',
  propietarios: 'propietarios',
  juntas: 'juntas',
  grabaciones: 'grabaciones',
  transcripciones: 'transcripciones',
  actas: 'actas',
  syncQueue: 'sync_queue',
};

export const STORE_SCHEMAS = {
  [STORES.meta]: {
    keyPath: 'key',
    indexes: [],
  },
  [STORES.settings]: {
    keyPath: 'key',
    indexes: [],
  },
  [STORES.comunidades]: {
    keyPath: 'id',
    indexes: [
      { name: 'by_nombre', keyPath: 'nombre', options: { unique: false } },
      { name: 'by_updated_at', keyPath: 'updated_at', options: { unique: false } },
      { name: 'by_sync_status', keyPath: 'sync_status', options: { unique: false } },
    ],
  },
  [STORES.propietarios]: {
    keyPath: 'id',
    indexes: [
      { name: 'by_comunidad_id', keyPath: 'comunidad_id', options: { unique: false } },
      { name: 'by_cargo', keyPath: 'cargo', options: { unique: false } },
      { name: 'by_updated_at', keyPath: 'updated_at', options: { unique: false } },
      { name: 'by_sync_status', keyPath: 'sync_status', options: { unique: false } },
    ],
  },
  [STORES.juntas]: {
    keyPath: 'id',
    indexes: [
      { name: 'by_comunidad_id', keyPath: 'comunidad_id', options: { unique: false } },
      { name: 'by_fecha', keyPath: 'fecha', options: { unique: false } },
      { name: 'by_estado', keyPath: 'estado', options: { unique: false } },
      { name: 'by_tipo', keyPath: 'tipo', options: { unique: false } },
      { name: 'by_updated_at', keyPath: 'updated_at', options: { unique: false } },
    ],
  },
  [STORES.grabaciones]: {
    keyPath: 'id',
    indexes: [
      { name: 'by_junta_id', keyPath: 'junta_id', options: { unique: false } },
      { name: 'by_estado', keyPath: 'estado', options: { unique: false } },
      { name: 'by_updated_at', keyPath: 'updated_at', options: { unique: false } },
      { name: 'by_created_at', keyPath: 'created_at', options: { unique: false } },
      { name: 'by_tamano_bytes', keyPath: 'tamano_bytes', options: { unique: false } },
    ],
  },
  [STORES.transcripciones]: {
    keyPath: 'id',
    indexes: [
      { name: 'by_junta_id', keyPath: 'junta_id', options: { unique: false } },
      { name: 'by_grabacion_id', keyPath: 'grabacion_id', options: { unique: false } },
      { name: 'by_metodo', keyPath: 'metodo', options: { unique: false } },
      { name: 'by_estado', keyPath: 'estado', options: { unique: false } },
      { name: 'by_updated_at', keyPath: 'updated_at', options: { unique: false } },
    ],
  },
  [STORES.actas]: {
    keyPath: 'id',
    indexes: [
      { name: 'by_junta_id', keyPath: 'junta_id', options: { unique: false } },
      { name: 'by_estado', keyPath: 'estado', options: { unique: false } },
      { name: 'by_updated_at', keyPath: 'updated_at', options: { unique: false } },
    ],
  },
  [STORES.syncQueue]: {
    keyPath: 'id',
    indexes: [
      { name: 'by_store_name', keyPath: 'store_name', options: { unique: false } },
      { name: 'by_status', keyPath: 'status', options: { unique: false } },
      { name: 'by_created_at', keyPath: 'created_at', options: { unique: false } },
    ],
  },
};
