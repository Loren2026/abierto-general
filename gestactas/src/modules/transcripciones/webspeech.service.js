function getRecognitionConstructor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function createWebSpeechService() {
  return {
    isSupported() {
      return Boolean(getRecognitionConstructor());
    },

    async transcribe({ blob, language = 'es-ES', onProgress }) {
      const Recognition = getRecognitionConstructor();
      if (!Recognition) {
        const error = new Error('Web Speech API no está disponible en este navegador.');
        error.code = 'webspeech_unsupported';
        throw error;
      }

      return new Promise((resolve, reject) => {
        const recognition = new Recognition();
        recognition.lang = language;
        recognition.continuous = true;
        recognition.interimResults = true;

        const audio = document.createElement('audio');
        const url = URL.createObjectURL(blob);
        audio.src = url;
        audio.preload = 'metadata';
        audio.controls = false;
        audio.muted = false;

        let finalText = '';
        let interimText = '';
        let finished = false;

        function cleanup() {
          if (finished) return;
          finished = true;
          recognition.onresult = null;
          recognition.onerror = null;
          recognition.onend = null;
          audio.pause();
          URL.revokeObjectURL(url);
        }

        recognition.onresult = (event) => {
          interimText = '';
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            const text = result[0]?.transcript || '';
            if (result.isFinal) finalText += `${text} `;
            else interimText += text;
          }
          onProgress?.({ interimText, finalText: finalText.trim() });
        };

        recognition.onerror = (event) => {
          cleanup();
          const error = new Error(`Web Speech API ha fallado: ${event.error || 'error desconocido'}`);
          error.code = event.error || 'webspeech_error';
          reject(error);
        };

        recognition.onend = () => {
          cleanup();
          const merged = `${finalText} ${interimText}`.trim();
          if (!merged) {
            const error = new Error('Web Speech API no ha devuelto texto utilizable.');
            error.code = 'webspeech_empty';
            reject(error);
            return;
          }
          resolve({ text: merged, fragments: [] });
        };

        audio.onended = () => {
          try {
            recognition.stop();
          } catch {
            cleanup();
            resolve({ text: `${finalText} ${interimText}`.trim(), fragments: [] });
          }
        };

        audio.play().catch(() => {
          // Si no se puede reproducir automáticamente, seguimos igualmente. En móvil puede requerir gesto previo.
        });

        try {
          recognition.start();
        } catch (error) {
          cleanup();
          reject(error);
        }
      });
    },
  };
}
