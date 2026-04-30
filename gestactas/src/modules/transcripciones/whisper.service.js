const WHISPER_MAX_BYTES = 25 * 1024 * 1024;
const WHISPER_SAFE_CHUNK_BYTES = 24 * 1024 * 1024;

function getOpenAiKey() {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem('gestactas_openai_api_key') || '';
}

function estimateChunkDuration(totalDurationSeconds, totalBytes, chunkBytes) {
  if (!totalDurationSeconds || !totalBytes) return 0;
  return Number(((chunkBytes / totalBytes) * totalDurationSeconds).toFixed(2));
}

export function splitAudioBlob(blob, durationSeconds = 0) {
  if (!blob || blob.size <= WHISPER_MAX_BYTES) {
    return [{
      index: 0,
      startSeconds: 0,
      endSeconds: durationSeconds || 0,
      durationSeconds: durationSeconds || 0,
      sizeBytes: blob?.size || 0,
      blob,
    }];
  }

  const chunks = [];
  const totalBytes = blob.size;
  let offset = 0;
  let startSeconds = 0;
  let index = 0;

  while (offset < totalBytes) {
    const end = Math.min(offset + WHISPER_SAFE_CHUNK_BYTES, totalBytes);
    const chunkBlob = blob.slice(offset, end, blob.type || 'audio/webm');
    const chunkDuration = estimateChunkDuration(durationSeconds, totalBytes, chunkBlob.size);
    const endSeconds = durationSeconds ? Number((startSeconds + chunkDuration).toFixed(2)) : 0;

    chunks.push({
      index,
      startSeconds,
      endSeconds,
      durationSeconds: chunkDuration,
      sizeBytes: chunkBlob.size,
      blob: chunkBlob,
    });

    startSeconds = endSeconds;
    offset = end;
    index += 1;
  }

  return chunks;
}

async function transcribeChunk({ chunk, apiKey, language = 'es', onProgress }) {
  const form = new FormData();
  const extension = (chunk.blob.type || 'audio/webm').includes('mp4') ? 'm4a' : 'webm';
  form.append('file', new File([chunk.blob], `gestactas-parte-${chunk.index + 1}.${extension}`, { type: chunk.blob.type || 'audio/webm' }));
  form.append('model', 'whisper-1');
  form.append('language', language);
  form.append('response_format', 'verbose_json');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`Whisper API devolvió ${response.status}: ${errorText}`);
    error.code = 'whisper_api_error';
    throw error;
  }

  const payload = await response.json();
  onProgress?.(chunk.index + 1);
  return {
    ...chunk,
    text: payload.text || '',
    raw: payload,
  };
}

export function createWhisperService() {
  return {
    getApiKey: getOpenAiKey,
    getMaxBytes() {
      return WHISPER_MAX_BYTES;
    },
    getSafeChunkBytes() {
      return WHISPER_SAFE_CHUNK_BYTES;
    },
    splitAudioBlob,
    async transcribe({ blob, durationSeconds = 0, language = 'es', onProgress }) {
      const apiKey = getOpenAiKey();
      if (!apiKey) {
        const error = new Error('No hay clave de OpenAI configurada para Whisper.');
        error.code = 'missing_openai_key';
        throw error;
      }

      const chunks = splitAudioBlob(blob, durationSeconds);
      const parts = [];
      for (const chunk of chunks) {
        const part = await transcribeChunk({ chunk, apiKey, language, onProgress: (done) => {
          onProgress?.({ done, total: chunks.length, currentChunk: chunk.index + 1 });
        } });
        parts.push(part);
      }

      return {
        text: parts.map((part) => part.text.trim()).filter(Boolean).join('\n\n'),
        fragments: parts.map((part) => ({
          index: part.index,
          startSeconds: part.startSeconds,
          endSeconds: part.endSeconds,
          durationSeconds: part.durationSeconds,
          sizeBytes: part.sizeBytes,
          text: part.text || '',
        })),
      };
    },
  };
}
