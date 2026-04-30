import { generateId, nowIso } from '../shared/utils.js';

export function createEmptyTranscripcion(overrides = {}) {
  const timestamp = nowIso();

  return {
    id: generateId('transcripcion'),
    junta_id: null,
    grabacion_id: null,
    metodo: 'whisper_api',
    estado: 'pendiente',
    texto: '',
    texto_editado: '',
    usar_texto_editado: false,
    idioma: 'es',
    duracion_segundos: 0,
    tamano_audio_bytes: 0,
    coste_estimado: 0,
    error_codigo: '',
    error_mensaje: '',
    fragmentos: [],
    created_at: timestamp,
    updated_at: timestamp,
    sync_status: 'local_only',
    ...overrides,
  };
}
