const listeners = new Set();

const state = {
  currentScreen: 'dashboard',
  selectedComunidadId: null,
  selectedPropietarioId: null,
  selectedJuntaId: null,
  selectedGrabacionId: null,
  selectedTranscripcionId: null,
  selectedTranscriptionMethod: 'whisper_api',
  isBootstrapped: false,
};

export function getState() {
  return structuredClone(state);
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((listener) => listener(getState()));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
