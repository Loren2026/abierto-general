import { createEmptyTranscripcion } from '../../models/transcripcion.js';
import { nowIso } from '../../shared/utils.js';

function getCostEstimate({ metodo, durationSeconds }) {
  if (metodo === 'web_speech') return 0.03;
  const hours = Number(durationSeconds || 0) / 3600;
  return Number((hours * 0.36).toFixed(2));
}

function getTextoActivo(transcripcion) {
  return transcripcion.usar_texto_editado && transcripcion.texto_editado
    ? transcripcion.texto_editado
    : transcripcion.texto;
}

export function createTranscripcionesService({ repository, whisperService, webSpeechService, grabacionesService }) {
  return {
    async listByJuntaId(juntaId) {
      const items = await repository.listByJuntaId(juntaId);
      return items.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).map((item) => ({
        ...item,
        texto_activo: getTextoActivo(item),
      }));
    },

    async getById(id) {
      const item = await repository.getById(id);
      return item ? { ...item, texto_activo: getTextoActivo(item) } : null;
    },

    async getLatestByGrabacionId(grabacionId) {
      const items = await repository.listByGrabacionId(grabacionId);
      const sorted = items.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
      return sorted[0] ? { ...sorted[0], texto_activo: getTextoActivo(sorted[0]) } : null;
    },

    async startTranscription({ juntaId, grabacionId, metodo = 'whisper_api', language = 'es', onProgress }) {
      const grabacion = await grabacionesService.getById(grabacionId);
      if (!grabacion?.audio_blob) {
        const error = new Error('No hay audio grabado disponible para transcribir.');
        error.code = 'missing_recording_blob';
        throw error;
      }

      const timestamp = nowIso();
      const draft = createEmptyTranscripcion({
        junta_id: juntaId,
        grabacion_id: grabacionId,
        metodo,
        estado: 'procesando',
        idioma: language,
        duracion_segundos: grabacion.duracion_segundos || 0,
        tamano_audio_bytes: grabacion.tamano_bytes || grabacion.audio_blob.size || 0,
        coste_estimado: getCostEstimate({ metodo, durationSeconds: grabacion.duracion_segundos }),
        created_at: timestamp,
        updated_at: timestamp,
      });
      await repository.save(draft);

      try {
        let result;
        if (metodo === 'web_speech') {
          result = await webSpeechService.transcribe({
            blob: grabacion.audio_blob,
            language: language === 'es' ? 'es-ES' : language,
            onProgress,
          });
        } else {
          result = await whisperService.transcribe({
            blob: grabacion.audio_blob,
            durationSeconds: grabacion.duracion_segundos || 0,
            language,
            onProgress,
          });
        }

        const updated = {
          ...draft,
          estado: 'completada',
          texto: result.text || '',
          texto_editado: '',
          usar_texto_editado: false,
          fragmentos: result.fragments || [],
          error_codigo: '',
          error_mensaje: '',
          updated_at: nowIso(),
        };
        await repository.save(updated);
        return { ...updated, texto_activo: getTextoActivo(updated) };
      } catch (error) {
        const failed = {
          ...draft,
          estado: 'error',
          error_codigo: error.code || 'transcription_error',
          error_mensaje: error.message || 'No se ha podido completar la transcripción.',
          updated_at: nowIso(),
        };
        await repository.save(failed);
        throw error;
      }
    },

    async saveEditedText(id, textoEditado) {
      const item = await repository.getById(id);
      if (!item) return null;
      const updated = {
        ...item,
        texto_editado: textoEditado,
        usar_texto_editado: true,
        updated_at: nowIso(),
      };
      await repository.save(updated);
      return { ...updated, texto_activo: getTextoActivo(updated) };
    },

    async resetEditedText(id) {
      const item = await repository.getById(id);
      if (!item) return null;
      const updated = {
        ...item,
        texto_editado: '',
        usar_texto_editado: false,
        updated_at: nowIso(),
      };
      await repository.save(updated);
      return { ...updated, texto_activo: getTextoActivo(updated) };
    },

    async delete(id) {
      return repository.delete(id);
    },

    getWhisperChunkPlan(blob, durationSeconds = 0) {
      return whisperService.splitAudioBlob(blob, durationSeconds);
    },

    isWebSpeechSupported() {
      return webSpeechService.isSupported();
    },
  };
}
