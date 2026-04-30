import { getState, setState } from '../../core/store.js';

function formatDuration(totalSeconds) {
  const safe = Math.max(0, Math.round(totalSeconds || 0));
  return [
    String(Math.floor(safe / 3600)).padStart(2, '0'),
    String(Math.floor((safe % 3600) / 60)).padStart(2, '0'),
    String(safe % 60).padStart(2, '0'),
  ].join(':');
}

function formatDateTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function bindGrabacionesUi({ router, legacyUi, grabacionesService, juntasService }) {
  const titleBadge = document.getElementById('grabacionJuntaBadge');
  const storageBanner = document.getElementById('grabacionStorageBanner');
  const recordingsList = document.getElementById('grabacionesList');
  const goTranscriptButton = document.getElementById('btnIrTranscripcion');
  let activeUrls = [];

  async function getActiveJunta() {
    const { selectedJuntaId } = getState();
    if (!selectedJuntaId) return null;
    return juntasService.getDetailedById(selectedJuntaId);
  }

  async function renderStorageBanner() {
    const usage = await grabacionesService.getStorageUsage();
    const alert = await grabacionesService.getStorageAlert();
    storageBanner.className = `storage-banner ${usage.status}`;
    storageBanner.innerHTML = `
      <div><strong>Audio local:</strong> ${usage.usedLabel} / ${usage.limitLabel}</div>
      <div>${alert.message || 'Capacidad local en rango correcto.'}</div>`;
  }

  function clearAudioUrls() {
    activeUrls.forEach((url) => URL.revokeObjectURL(url));
    activeUrls = [];
  }

  async function renderRecordings() {
    clearAudioUrls();

    const junta = await getActiveJunta();
    if (!junta) {
      titleBadge.textContent = 'Sin junta seleccionada';
      recordingsList.innerHTML = '<div class="card" style="cursor:default">Selecciona una junta para grabar.</div>';
      return;
    }

    titleBadge.textContent = `${junta.comunidad?.nombre || 'Comunidad'} — ${junta.fecha || ''}`;
    const recordings = await grabacionesService.listByJuntaId(junta.id);

    if (!recordings.length) {
      recordingsList.innerHTML = '<div class="card" style="cursor:default">Aún no hay grabaciones guardadas para esta junta.</div>';
      return;
    }

    recordingsList.innerHTML = recordings.map((item) => {
      const audioUrl = URL.createObjectURL(item.audio_blob);
      activeUrls.push(audioUrl);
      return `
        <div class="card" data-recording-id="${item.id}" style="cursor:default">
          <div class="card-header">
            <span class="card-title">🎙️ ${item.nombre}</span>
            <span class="card-badge badge-accent">${formatDuration(item.duracion_segundos)}</span>
          </div>
          <div class="card-meta">
            <span class="card-meta-item meta-date">💾 ${Math.round((item.tamano_bytes || 0) / 1024)} KB</span>
            <span class="card-meta-item meta-time">🗓️ ${formatDateTime(item.created_at)}</span>
            <span class="card-meta-item meta-people">🔖 ${item.marcador_count || 0} marc.</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
            <button class="btn btn-secondary" data-action="play">▶️ Reproducir</button>
            <button class="btn btn-danger" data-action="delete">🗑️ Eliminar</button>
          </div>
          <audio controls preload="metadata" style="width:100%;margin-top:10px" src="${audioUrl}"></audio>
        </div>`;
    }).join('');

    recordingsList.querySelectorAll('[data-recording-id]').forEach((card) => {
      const recordingId = card.dataset.recordingId;
      card.querySelector('[data-action="play"]')?.addEventListener('click', () => {
        card.querySelector('audio')?.play();
      });
      card.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
        await grabacionesService.delete(recordingId);
        await refresh();
      });
    });
  }

  async function refresh() {
    await renderStorageBanner();
    await renderRecordings();
  }

  async function persistCurrentRecording(payload) {
    const junta = await getActiveJunta();
    if (!junta) throw new Error('No hay junta seleccionada para asociar la grabación.');

    const saved = await grabacionesService.saveRecording({
      juntaId: junta.id,
      blob: payload.blob,
      durationSeconds: payload.durationSeconds,
      markerCount: payload.markerCount,
      nombre: `Grabación ${junta.comunidad?.nombre || ''} ${junta.fecha || ''}`.trim(),
    });

    setState({ selectedGrabacionId: saved.id });

    await refresh();
  }

  goTranscriptButton?.addEventListener('click', () => router.goTo('transcripcion'));

  document.addEventListener('gestactas:screen-change', async (event) => {
    if (event.detail?.screenId === 'grabacion') {
      await refresh();
      await legacyUi.refreshRecordingStorage?.();
    }
  });

  legacyUi.setRecordingHooks({
    onSaved: persistCurrentRecording,
    onRefresh: refresh,
  });

  return { refresh };
}
