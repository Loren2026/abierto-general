import { getState, setState } from '../../core/store.js';

function formatDuration(totalSeconds) {
  const safe = Math.max(0, Math.round(totalSeconds || 0));
  return [
    String(Math.floor(safe / 3600)).padStart(2, '0'),
    String(Math.floor((safe % 3600) / 60)).padStart(2, '0'),
    String(safe % 60).padStart(2, '0'),
  ].join(':');
}

function formatCost(value) {
  return `${Number(value || 0).toFixed(2).replace('.', ',')} €`;
}

export function bindTranscripcionesUi({ router, grabacionesService, juntasService, transcripcionesService }) {
  const methodCards = Array.from(document.querySelectorAll('[data-transcription-method]'));
  const startButton = document.getElementById('btnIniciarTranscripcion');
  const retranscribeButton = document.getElementById('btnRetranscribir');
  const saveButton = document.getElementById('btnGuardarTranscripcion');
  const resetButton = document.getElementById('btnResetTranscripcion');
  const goActaButton = document.getElementById('btnIrGenerarActa');
  const recordingSelect = document.getElementById('transcripcionGrabacionSelect');
  const methodInfo = document.getElementById('transcriptionMethodInfo');
  const progressText = document.getElementById('transcripcionProgressText');
  const progressBar = document.getElementById('transcripcionProgressBar');
  const statusBox = document.getElementById('transcripcionStatusBox');
  const statusMessage = document.getElementById('transcripcionStatusMessage');
  const transcriptEditor = document.getElementById('transcripcionEditor');
  const transcriptMeta = document.getElementById('transcripcionMeta');
  const fragmentInfo = document.getElementById('transcripcionFragmentInfo');
  const transcriptList = document.getElementById('transcripcionesHistorial');
  const activeBadge = document.getElementById('transcripcionJuntaBadge');

  function setMethod(method) {
    setState({ selectedTranscriptionMethod: method });
    methodCards.forEach((card) => card.classList.toggle('selected', card.dataset.transcriptionMethod === method));
    if (method === 'web_speech') {
      methodInfo.textContent = transcripcionesService.isWebSpeechSupported()
        ? 'Modo económico asistido. Menor precisión, depende del navegador y del micrófono.'
        : 'Web Speech API no está disponible en este navegador.';
      return;
    }
    methodInfo.textContent = 'Whisper API: mayor calidad y división automática del audio si supera 25 MB.';
  }

  function setProgress({ percent = 0, message = '' }) {
    const safe = Math.max(0, Math.min(100, percent));
    progressBar.style.width = `${safe}%`;
    progressText.textContent = message || `${safe}%`;
  }

  function setStatus(message, tone = 'muted') {
    statusBox.dataset.tone = tone;
    statusMessage.textContent = message;
  }

  async function getActiveJunta() {
    const { selectedJuntaId } = getState();
    if (!selectedJuntaId) return null;
    return juntasService.getDetailedById(selectedJuntaId);
  }

  async function renderRecordings() {
    const junta = await getActiveJunta();
    if (!junta) {
      activeBadge.textContent = 'Sin junta seleccionada';
      recordingSelect.innerHTML = '<option value="">No hay junta activa</option>';
      return [];
    }

    activeBadge.textContent = `${junta.comunidad?.nombre || 'Comunidad'} — ${junta.fecha || ''}`;
    const recordings = await grabacionesService.listByJuntaId(junta.id);
    recordingSelect.innerHTML = '<option value="">Selecciona una grabación...</option>' + recordings.map((item) => `
      <option value="${item.id}">${item.nombre} · ${formatDuration(item.duracion_segundos)} · ${Math.round((item.tamano_bytes || 0) / 1024)} KB</option>`).join('');

    const { selectedGrabacionId } = getState();
    if (selectedGrabacionId && recordings.some((item) => item.id === selectedGrabacionId)) {
      recordingSelect.value = selectedGrabacionId;
    } else if (recordings[0]) {
      recordingSelect.value = recordings[0].id;
      setState({ selectedGrabacionId: recordings[0].id });
    }

    return recordings;
  }

  async function renderHistory() {
    const junta = await getActiveJunta();
    if (!junta) {
      transcriptList.innerHTML = '<div class="card" style="cursor:default">No hay junta seleccionada.</div>';
      return;
    }

    const items = await transcripcionesService.listByJuntaId(junta.id);
    if (!items.length) {
      transcriptList.innerHTML = '<div class="card" style="cursor:default">Todavía no hay transcripciones guardadas para esta junta.</div>';
      return;
    }

    transcriptList.innerHTML = items.map((item) => `
      <div class="card" data-transcripcion-id="${item.id}" style="cursor:pointer">
        <div class="card-header">
          <span class="card-title">📝 ${item.metodo === 'web_speech' ? 'Web Speech' : 'Whisper API'}</span>
          <span class="card-badge ${item.estado === 'completada' ? 'badge-success' : item.estado === 'error' ? 'badge-danger' : 'badge-warning'}">${item.estado}</span>
        </div>
        <div class="card-meta">
          <span class="card-meta-item meta-date">⏱️ ${formatDuration(item.duracion_segundos)}</span>
          <span class="card-meta-item meta-type">💶 ${formatCost(item.coste_estimado)}</span>
          <span class="card-meta-item meta-time">🧩 ${(item.fragmentos || []).length || 1} fragmentos</span>
        </div>
      </div>`).join('');

    transcriptList.querySelectorAll('[data-transcripcion-id]').forEach((card) => {
      card.addEventListener('click', async () => {
        const transcripcion = await transcripcionesService.getById(card.dataset.transcripcionId);
        if (!transcripcion) return;
        setState({ selectedTranscripcionId: transcripcion.id, selectedGrabacionId: transcripcion.grabacion_id, selectedTranscriptionMethod: transcripcion.metodo });
        recordingSelect.value = transcripcion.grabacion_id;
        setMethod(transcripcion.metodo);
        renderTranscription(transcripcion);
      });
    });
  }

  function renderTranscription(transcripcion) {
    transcriptEditor.value = transcripcion?.texto_activo || '';
    transcriptMeta.textContent = transcripcion
      ? `Método: ${transcripcion.metodo === 'web_speech' ? 'Web Speech API' : 'Whisper API'} · Coste estimado: ${formatCost(transcripcion.coste_estimado)} · Duración: ${formatDuration(transcripcion.duracion_segundos)}`
      : 'Sin transcripción cargada.';

    if (!transcripcion) {
      fragmentInfo.textContent = 'Si el audio supera 25 MB, Whisper lo dividirá automáticamente antes de enviarlo.';
      return;
    }

    const fragments = transcripcion.fragmentos || [];
    fragmentInfo.textContent = fragments.length > 1
      ? `Audio dividido automáticamente en ${fragments.length} fragmentos para Whisper, manteniendo el orden cronológico.`
      : 'Transcripción de un único fragmento.';
  }

  async function inspectChunkPlan() {
    const { selectedGrabacionId } = getState();
    if (!selectedGrabacionId) return;
    const recording = await grabacionesService.getById(selectedGrabacionId);
    if (!recording?.audio_blob) return;
    const plan = transcripcionesService.getWhisperChunkPlan(recording.audio_blob, recording.duracion_segundos || 0);
    if (plan.length > 1) {
      fragmentInfo.textContent = `Whisper dividirá este audio en ${plan.length} fragmentos de hasta 24 MB aprox. antes de transcribir.`;
    } else {
      fragmentInfo.textContent = 'El audio no necesita división para Whisper.';
    }
  }

  async function loadSelectedExisting() {
    const { selectedGrabacionId } = getState();
    if (!selectedGrabacionId) {
      renderTranscription(null);
      return;
    }
    const transcripcion = await transcripcionesService.getLatestByGrabacionId(selectedGrabacionId);
    if (transcripcion) {
      setState({ selectedTranscripcionId: transcripcion.id, selectedTranscriptionMethod: transcripcion.metodo });
      setMethod(transcripcion.metodo);
      renderTranscription(transcripcion);
      return;
    }
    setState({ selectedTranscripcionId: null });
    renderTranscription(null);
  }

  async function startTranscription(force = false) {
    const junta = await getActiveJunta();
    const { selectedGrabacionId, selectedTranscriptionMethod } = getState();
    if (!junta || !selectedGrabacionId) {
      setStatus('Selecciona primero una junta y una grabación.', 'danger');
      return;
    }

    if (selectedTranscriptionMethod === 'web_speech' && !transcripcionesService.isWebSpeechSupported()) {
      setStatus('Este navegador no soporta Web Speech API.', 'danger');
      return;
    }

    if (!force) {
      const existing = await transcripcionesService.getLatestByGrabacionId(selectedGrabacionId);
      if (existing && existing.estado === 'completada') {
        setState({ selectedTranscripcionId: existing.id });
      }
    }

    setStatus('Iniciando transcripción...', 'warning');
    setProgress({ percent: 5, message: 'Preparando audio...' });

    try {
      const transcripcion = await transcripcionesService.startTranscription({
        juntaId: junta.id,
        grabacionId: selectedGrabacionId,
        metodo: selectedTranscriptionMethod,
        language: 'es',
        onProgress: (payload) => {
          if (selectedTranscriptionMethod === 'web_speech') {
            const text = payload.finalText || payload.interimText || '';
            transcriptEditor.value = text;
            setProgress({ percent: 60, message: 'Escuchando y transcribiendo...' });
            return;
          }
          const percent = payload.total ? Math.round((payload.done / payload.total) * 100) : 50;
          setProgress({ percent, message: `Procesando fragmento ${payload.done} de ${payload.total}...` });
        },
      });

      setState({ selectedTranscripcionId: transcripcion.id });
      renderTranscription(transcripcion);
      await renderHistory();
      setProgress({ percent: 100, message: 'Transcripción completada.' });
      setStatus('Transcripción completada y guardada en la junta.', 'success');
    } catch (error) {
      setProgress({ percent: 0, message: 'Transcripción fallida.' });
      setStatus(error.message || 'No se ha podido completar la transcripción.', 'danger');
    }
  }

  async function saveEdited() {
    const { selectedTranscripcionId } = getState();
    if (!selectedTranscripcionId) {
      setStatus('No hay una transcripción cargada para guardar correcciones.', 'danger');
      return;
    }
    const updated = await transcripcionesService.saveEditedText(selectedTranscripcionId, transcriptEditor.value);
    renderTranscription(updated);
    await renderHistory();
    setStatus('Correcciones guardadas.', 'success');
  }

  async function resetEdited() {
    const { selectedTranscripcionId } = getState();
    if (!selectedTranscripcionId) return;
    const updated = await transcripcionesService.resetEditedText(selectedTranscripcionId);
    renderTranscription(updated);
    await renderHistory();
    setStatus('Se ha restaurado el texto original de la transcripción.', 'warning');
  }

  recordingSelect?.addEventListener('change', async () => {
    setState({ selectedGrabacionId: recordingSelect.value || null });
    await inspectChunkPlan();
    await loadSelectedExisting();
  });

  methodCards.forEach((card) => card.addEventListener('click', () => setMethod(card.dataset.transcriptionMethod)));
  startButton?.addEventListener('click', () => startTranscription(false));
  retranscribeButton?.addEventListener('click', () => startTranscription(true));
  saveButton?.addEventListener('click', saveEdited);
  resetButton?.addEventListener('click', resetEdited);
  goActaButton?.addEventListener('click', () => router.goTo('generar-acta'));

  document.addEventListener('gestactas:screen-change', async (event) => {
    if (event.detail?.screenId === 'transcripcion') {
      await renderRecordings();
      await inspectChunkPlan();
      await loadSelectedExisting();
      await renderHistory();
      setMethod(getState().selectedTranscriptionMethod || 'whisper_api');
    }
  });

  return {
    async refresh() {
      await renderRecordings();
      await inspectChunkPlan();
      await loadSelectedExisting();
      await renderHistory();
      setMethod(getState().selectedTranscriptionMethod || 'whisper_api');
    },
  };
}
