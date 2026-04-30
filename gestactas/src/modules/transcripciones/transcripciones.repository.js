import { STORES } from '../../db/schema.js';

function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function createTranscripcionesRepository(db) {
  return {
    async listByJuntaId(juntaId) {
      const transaction = db.transaction(STORES.transcripciones, 'readonly');
      const index = transaction.objectStore(STORES.transcripciones).index('by_junta_id');
      return promisifyRequest(index.getAll(juntaId));
    },
    async listByGrabacionId(grabacionId) {
      const transaction = db.transaction(STORES.transcripciones, 'readonly');
      const index = transaction.objectStore(STORES.transcripciones).index('by_grabacion_id');
      return promisifyRequest(index.getAll(grabacionId));
    },
    async getById(id) {
      const transaction = db.transaction(STORES.transcripciones, 'readonly');
      return promisifyRequest(transaction.objectStore(STORES.transcripciones).get(id));
    },
    async save(transcripcion) {
      const transaction = db.transaction(STORES.transcripciones, 'readwrite');
      await promisifyRequest(transaction.objectStore(STORES.transcripciones).put(transcripcion));
      return transcripcion;
    },
    async delete(id) {
      const transaction = db.transaction(STORES.transcripciones, 'readwrite');
      await promisifyRequest(transaction.objectStore(STORES.transcripciones).delete(id));
      return true;
    },
  };
}
