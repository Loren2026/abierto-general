const DB_NAME = 'gestactas_ui';
const DB_VERSION = 1;
const STORE_NAMES = ['comunidades', 'juntas', 'grabaciones', 'transcripciones', 'actas', 'settings'];
const STORAGE_LIMIT_BYTES = 150 * 1024 * 1024;
const WHISPER_MAX_BYTES = 25 * 1024 * 1024;
const WHISPER_SAFE_CHUNK_BYTES = 24 * 1024 * 1024;

const state = {
  currentScreen: 'dashboard',
  selectedComunidadId: null,
  selectedJuntaId: null,
  selectedGrabacionId: null,
  selectedTranscripcionId: null,
  selectedActaId: null,
  selectedTranscriptionMethod: 'whisper_api',
};

const ui = {
  screens: {},
  bottomNav: [],
};

let dbPromise;
let mediaRecorder = null;
let mediaStream = null;
let recordingChunks = [];
let recordingStartedAt = 0;
let recordingElapsedMs = 0;
let recordingTimer = null;
let isRecording = false;
let isPaused = false;
let markers = [];
let pendingBlob = null;

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function nowIso() {
  return new Date().toISOString();
}

function generateId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function formatShortDate(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short' }).format(new Date(value));
}

function formatLongDate(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function formatDuration(totalSeconds) {
  const safe = Math.max(0, Math.round(totalSeconds || 0));
  return [
    String(Math.floor(safe / 3600)).padStart(2, '0'),
    String(Math.floor((safe % 3600) / 60)).padStart(2, '0'),
    String(safe % 60).padStart(2, '0'),
  ].join(':');
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2).replace('.', ',')}%`;
}

function formatEuro(value) {
  return `${Number(value || 0).toFixed(2).replace('.', ',')} €`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function nl2br(value) {
  return escapeHtml(value).replaceAll('\n', '<br>');
}

function parseOrderItems(raw) {
  return String(raw || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => line.replace(/^\d+[.)-]?\s*/, '') || `Punto ${index + 1}`);
}

function persistUiState() {
  localStorage.setItem('gestactas_ui_state', JSON.stringify(state));
}

function restoreUiState() {
  try {
    const saved = JSON.parse(localStorage.getItem('gestactas_ui_state') || '{}');
    Object.assign(state, saved || {});
  } catch {}
}

function setState(patch, options = {}) {
  Object.assign(state, patch);
  persistUiState();
  if (!options.silent) renderApp();
}

function stateCard({ tone = 'empty', title, body, actionLabel, action }) {
  const button = actionLabel ? `<button class="btn btn-primary" onclick="${action}">${actionLabel}</button>` : '';
  return `<div class="state-card state-${tone}"><div class="state-title">${title}</div><div class="state-body">${body}</div>${button}</div>`;
}

async function getDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      STORE_NAMES.forEach((name) => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function idbGetAll(storeName) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(storeName, id) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function idbPut(storeName, value) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(storeName, id) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function loadData() {
  const [comunidades, juntas, grabaciones, transcripciones, actas] = await Promise.all([
    idbGetAll('comunidades'),
    idbGetAll('juntas'),
    idbGetAll('grabaciones'),
    idbGetAll('transcripciones'),
    idbGetAll('actas'),
  ]);
  return {
    comunidades: comunidades.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)),
    juntas: juntas.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)),
    grabaciones: grabaciones.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    transcripciones: transcripciones.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)),
    actas: actas.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)),
  };
}

function getCurrentHashScreen() {
  const raw = window.location.hash.replace(/^#/, '').trim();
  return raw || state.currentScreen || 'dashboard';
}

function syncHash(screenId) {
  if (getCurrentHashScreen() === screenId) return;
  window.location.hash = screenId;
}

function activateScreen(screenId) {
  Object.entries(ui.screens).forEach(([key, node]) => node.classList.toggle('active', key === screenId));
  ui.bottomNav.forEach((button) => button.classList.toggle('active', button.id === `nav-${screenId}`));
  document.dispatchEvent(new CustomEvent('gestactas:screen-change', { detail: { screenId } }));
}

function withComunidad(comunidades, id) {
  return comunidades.find((item) => item.id === id) || null;
}

function withJunta(juntas, id) {
  return juntas.find((item) => item.id === id) || null;
}

function withTranscripcion(transcripciones, id) {
  return transcripciones.find((item) => item.id === id) || null;
}

function getActiveText(transcripcion) {
  if (!transcripcion) return '';
  return transcripcion.usar_texto_editado && transcripcion.texto_editado ? transcripcion.texto_editado : transcripcion.texto || '';
}

function getStorageStatus(bytes) {
  if (bytes >= STORAGE_LIMIT_BYTES * 0.9) return 'danger';
  if (bytes >= STORAGE_LIMIT_BYTES * 0.7) return 'warning';
  return 'ok';
}

async function getRecordingUsage() {
  const grabaciones = await idbGetAll('grabaciones');
  const usedBytes = grabaciones.reduce((sum, item) => sum + Number(item.tamano_bytes || 0), 0);
  let availableBytes = STORAGE_LIMIT_BYTES;
  if (navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      availableBytes = Math.min(STORAGE_LIMIT_BYTES, Number(estimate.quota || STORAGE_LIMIT_BYTES));
    } catch {}
  }
  return {
    usedBytes,
    limitBytes: availableBytes,
    status: getStorageStatus(usedBytes),
  };
}

function renderDashboard(data) {
  const screen = ui.screens.dashboard;
  const proximas = data.juntas.slice(0, 3);
  const pendientes = data.juntas.filter((item) => !data.transcripciones.some((t) => t.junta_id === item.id)).length;
  const conActa = data.actas.length;

  screen.innerHTML = `
    <div class="swipe-hint">
      <div class="swipe-dot active"></div><div class="swipe-dot"></div><div class="swipe-dot"></div>
    </div>
    <div class="stats-grid">
      <div class="stat-card" onclick="showScreen('comunidades')"><div class="stat-number blue">${data.comunidades.length}</div><div class="stat-label">Comunidades</div></div>
      <div class="stat-card" onclick="showScreen('juntas')"><div class="stat-number green">${data.juntas.length}</div><div class="stat-label">Juntas</div></div>
      <div class="stat-card" onclick="showScreen('historico')"><div class="stat-number orange">${conActa}</div><div class="stat-label">Actas generadas</div></div>
      <div class="stat-card" onclick="showScreen('historico')"><div class="stat-number red">${pendientes}</div><div class="stat-label">Pendientes</div></div>
    </div>
    <div class="section-header"><span class="section-title">Próximas juntas</span><button class="section-action" onclick="showScreen('juntas')">Ver todas →</button></div>
    ${proximas.length ? proximas.map((junta) => {
      const comunidad = withComunidad(data.comunidades, junta.comunidad_id);
      return `<div class="card" onclick="openJunta('${junta.id}')"><div class="card-header"><span class="card-title">${escapeHtml(comunidad?.nombre || 'Comunidad')}</span><span class="card-badge ${junta.estado === 'celebrada' ? 'badge-success' : 'badge-warning'}">${escapeHtml(junta.estado || 'pendiente')}</span></div><div class="card-meta"><span class="card-meta-item meta-date">📅 ${formatShortDate(junta.fecha)}</span><span class="card-meta-item meta-time">🕐 ${escapeHtml(junta.hora_segunda || '--:--')}</span><span class="card-meta-item meta-people">📝 ${parseOrderItems(junta.orden_dia).length} puntos</span></div></div>`;
    }).join('') : stateCard({ tone: 'empty', title: 'Sin juntas todavía', body: 'Empieza creando una comunidad y después una junta para recorrer el flujo completo.', actionLabel: 'Crear comunidad', action: "showScreen('comunidad-nueva')" })}
    <div class="section-header" style="margin-top:20px"><span class="section-title">Actividad reciente</span></div>
    ${data.transcripciones.slice(0, 3).map((item) => {
      const junta = withJunta(data.juntas, item.junta_id);
      const comunidad = withComunidad(data.comunidades, junta?.comunidad_id);
      return `<div class="card" onclick="openTranscripcion('${item.id}')"><div class="card-header"><span class="card-title">📝 ${escapeHtml(comunidad?.nombre || 'Sin comunidad')}</span><span class="card-badge ${item.estado === 'completada' ? 'badge-success' : item.estado === 'error' ? 'badge-danger' : 'badge-warning'}">${escapeHtml(item.estado)}</span></div><div class="card-meta"><span class="card-meta-item meta-date">📅 ${formatShortDate(junta?.fecha)}</span><span class="card-meta-item meta-type">🎙️ ${formatDuration(item.duracion_segundos)}</span></div></div>`;
    }).join('') || stateCard({ tone: 'empty', title: 'Sin transcripciones', body: 'Cuando guardes una grabación aparecerá aquí la actividad reciente.' })}
  `;
}

function renderComunidades(data) {
  const screen = ui.screens.comunidades;
  screen.innerHTML = `
    <div class="sub-header"><button class="back-btn" onclick="goBack()">←</button><span class="sub-title">Comunidades</span><button class="section-action" style="margin-left:auto" onclick="showScreen('comunidad-nueva')">+ Nueva</button></div>
    <div class="search-bar"><span>🔍</span><input type="text" placeholder="Buscar comunidad..." id="communitySearch"></div>
    <div id="comunidadesListArea"></div>
  `;
  const container = $('#comunidadesListArea', screen);
  const renderList = (term = '') => {
    const filtered = data.comunidades.filter((item) => item.nombre.toLowerCase().includes(term.toLowerCase()));
    container.innerHTML = filtered.length ? filtered.map((item) => {
      const juntas = data.juntas.filter((junta) => junta.comunidad_id === item.id).length;
      return `<div class="card" onclick="openComunidad('${item.id}')"><div class="card-header"><span class="card-title">🏢 ${escapeHtml(item.nombre)}</span><span class="card-badge badge-accent">${juntas} juntas</span></div><div class="card-meta"><span class="card-meta-item meta-location">📍 ${escapeHtml(item.localidad || 'Sin localidad')}</span><span class="card-meta-item meta-type">🏛️ ${escapeHtml(item.cif || 'Sin CIF')}</span></div></div>`;
    }).join('') : stateCard({ tone: 'empty', title: 'No hay comunidades', body: 'Crea la primera comunidad para desbloquear juntas, grabaciones y actas.', actionLabel: 'Nueva comunidad', action: "showScreen('comunidad-nueva')" });
  };
  $('#communitySearch', screen)?.addEventListener('input', (event) => renderList(event.target.value || ''));
  renderList();
}

function renderComunidadNueva() {
  const screen = ui.screens['comunidad-nueva'];
  screen.innerHTML = `
    <div class="sub-header"><button class="back-btn" onclick="goBack()">←</button><span class="sub-title">Nueva comunidad</span></div>
    <form id="comunidadForm">
      <div class="form-group"><label class="form-label">Nombre</label><input class="form-input" name="nombre" required placeholder="Ej: Edificio Las Palmeras"></div>
      <div class="form-group"><label class="form-label">Localidad</label><input class="form-input" name="localidad" placeholder="Ej: Lugones"></div>
      <div class="form-group"><label class="form-label">Dirección</label><input class="form-input" name="direccion" placeholder="Ej: Calle Real 10"></div>
      <div class="form-group"><label class="form-label">CIF</label><input class="form-input" name="cif" placeholder="Ej: H12345678"></div>
      <div class="form-group"><label class="form-label">Administrador</label><input class="form-input" name="administrador" placeholder="Ej: Carigan Servicios Integrados S.L."></div>
      <button class="btn btn-primary" type="submit">💾 Guardar comunidad</button>
    </form>
  `;
  $('#comunidadForm', screen)?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const timestamp = nowIso();
    const comunidad = {
      id: generateId('comunidad'),
      nombre: String(form.get('nombre') || '').trim(),
      localidad: String(form.get('localidad') || '').trim(),
      direccion: String(form.get('direccion') || '').trim(),
      cif: String(form.get('cif') || '').trim(),
      administrador: String(form.get('administrador') || '').trim(),
      created_at: timestamp,
      updated_at: timestamp,
    };
    await idbPut('comunidades', comunidad);
    setState({ selectedComunidadId: comunidad.id, currentScreen: 'comunidad-detail' }, { silent: true });
    syncHash('comunidad-detail');
    renderApp();
  });
}

function renderComunidadDetail(data) {
  const screen = ui.screens['comunidad-detail'];
  const comunidad = withComunidad(data.comunidades, state.selectedComunidadId);
  if (!comunidad) {
    screen.innerHTML = `<div class="sub-header"><button class="back-btn" onclick="goBack()">←</button><span class="sub-title">Comunidad</span></div>${stateCard({ tone: 'error', title: 'Comunidad no encontrada', body: 'La comunidad seleccionada ya no existe o se perdió el contexto tras la recarga.', actionLabel: 'Ir a comunidades', action: "showScreen('comunidades')" })}`;
    return;
  }
  const juntas = data.juntas.filter((item) => item.comunidad_id === comunidad.id);
  screen.innerHTML = `
    <div class="sub-header"><button class="back-btn" onclick="goBack()">←</button><span class="sub-title">${escapeHtml(comunidad.nombre)}</span></div>
    <div class="card" style="cursor:default">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><div style="width:48px;height:48px;background:var(--accent-glow);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px">🏢</div><div><div style="font-size:16px;font-weight:600">${escapeHtml(comunidad.nombre)}</div><div style="font-size:14px;color:var(--text-location)">${escapeHtml(comunidad.localidad || 'Sin localidad')}</div></div></div>
      <div style="font-size:14px;display:flex;flex-wrap:wrap;gap:12px"><span style="color:var(--text-muted)">🏛️ CIF: ${escapeHtml(comunidad.cif || 'Sin CIF')}</span><span style="color:var(--text-detail)">👤 Adm: ${escapeHtml(comunidad.administrador || 'Sin asignar')}</span><span style="color:var(--text-info)">📋 ${juntas.length} juntas</span></div>
    </div>
    <div class="section-header"><span class="section-title">Historial de juntas</span><button class="section-action" onclick="showScreen('junta-nueva')">+ Nueva junta</button></div>
    ${juntas.length ? juntas.map((junta) => `<div class="card" onclick="openJunta('${junta.id}')"><div class="card-header"><span class="card-title">${escapeHtml(junta.tipo)}</span><span class="card-badge ${junta.estado === 'celebrada' ? 'badge-success' : 'badge-warning'}">${escapeHtml(junta.estado)}</span></div><div class="card-meta"><span class="card-meta-item meta-date">📅 ${formatShortDate(junta.fecha)}</span><span class="card-meta-item meta-time">🕐 ${escapeHtml(junta.hora_segunda || '--:--')}</span></div></div>`).join('') : stateCard({ tone: 'empty', title: 'Aún no hay juntas', body: 'Desde aquí puedes pasar al siguiente tramo del flujo y crear la primera junta.', actionLabel: 'Crear junta', action: "showScreen('junta-nueva')" })}
  `;
}

function renderJuntas(data) {
  const screen = ui.screens.juntas;
  screen.innerHTML = `
    <div class="sub-header"><button class="back-btn" onclick="goBack()">←</button><span class="sub-title">Juntas</span><button class="section-action" style="margin-left:auto" onclick="showScreen('junta-nueva')">+ Nueva</button></div>
    <div class="tabs"><button class="tab active">Todas</button><button class="tab" disabled>En curso</button><button class="tab" disabled>Finalizadas</button></div>
    <div id="juntasListArea"></div>
  `;
  const area = $('#juntasListArea', screen);
  area.innerHTML = data.juntas.length ? data.juntas.map((junta) => {
    const comunidad = withComunidad(data.comunidades, junta.comunidad_id);
    const transcripcion = data.transcripciones.find((item) => item.junta_id === junta.id && item.estado === 'completada');
    return `<div class="card" onclick="openJunta('${junta.id}')"><div class="card-header"><span class="card-title">${escapeHtml(comunidad?.nombre || 'Comunidad eliminada')}</span><span class="card-badge ${transcripcion ? 'badge-success' : 'badge-warning'}">${transcripcion ? 'con transcripción' : 'pendiente'}</span></div><div class="card-meta"><span class="card-meta-item meta-date">📅 ${formatShortDate(junta.fecha)}</span><span class="card-meta-item meta-time">🕐 ${escapeHtml(junta.hora_segunda || '--:--')}</span><span class="card-meta-item meta-type">${escapeHtml(junta.tipo)}</span></div></div>`;
  }).join('') : stateCard({ tone: 'empty', title: 'No hay juntas', body: 'Sin juntas no hay recorrido productivo. Crea una y sigue el flujo grabación → transcripción → acta.', actionLabel: 'Crear junta', action: "showScreen('junta-nueva')" });
}

function renderJuntaNueva(data) {
  const screen = ui.screens['junta-nueva'];
  screen.innerHTML = `
    <div class="sub-header"><button class="back-btn" onclick="goBack()">←</button><span class="sub-title">Nueva junta</span></div>
    <form id="juntaForm">
      <div class="form-group"><label class="form-label">Comunidad</label><select class="form-select" name="comunidad_id" required>${data.comunidades.length ? data.comunidades.map((item) => `<option value="${item.id}" ${item.id === state.selectedComunidadId ? 'selected' : ''}>${escapeHtml(item.nombre)}</option>`).join('') : '<option value="">No hay comunidades</option>'}</select></div>
      <div class="form-group"><label class="form-label">Tipo</label><select class="form-select" name="tipo"><option>Ordinaria</option><option>Extraordinaria</option></select></div>
      <div class="form-group"><label class="form-label">Fecha</label><input class="form-input" type="date" name="fecha" required value="${new Date().toISOString().slice(0, 10)}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="form-group"><label class="form-label">1.ª convocatoria</label><input class="form-input" type="time" name="hora_primera" value="18:00"></div><div class="form-group"><label class="form-label">2.ª convocatoria</label><input class="form-input" type="time" name="hora_segunda" value="18:30"></div></div>
      <div class="form-group"><label class="form-label">Lugar</label><input class="form-input" name="lugar" placeholder="Portal del edificio"></div>
      <div class="form-group"><label class="form-label">Orden del día</label><textarea class="form-textarea" name="orden_dia" rows="4" placeholder="1. Aprobación de cuentas\n2. Renovación de cargos"></textarea></div>
      <button class="btn btn-primary" type="submit">✅ Crear junta</button>
    </form>
    ${!data.comunidades.length ? stateCard({ tone: 'warning', title: 'Primero necesitas una comunidad', body: 'No se puede crear una junta real sin comunidad asociada.', actionLabel: 'Crear comunidad', action: "showScreen('comunidad-nueva')" }) : ''}
  `;
  $('#juntaForm', screen)?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const timestamp = nowIso();
    const junta = {
      id: generateId('junta'),
      comunidad_id: String(form.get('comunidad_id') || ''),
      tipo: String(form.get('tipo') || 'Ordinaria'),
      fecha: String(form.get('fecha') || ''),
      hora_primera: String(form.get('hora_primera') || ''),
      hora_segunda: String(form.get('hora_segunda') || ''),
      lugar: String(form.get('lugar') || '').trim(),
      orden_dia: String(form.get('orden_dia') || '').trim(),
      estado: 'preparada',
      created_at: timestamp,
      updated_at: timestamp,
    };
    await idbPut('juntas', junta);
    setState({ selectedComunidadId: junta.comunidad_id, selectedJuntaId: junta.id, currentScreen: 'junta-detail' }, { silent: true });
    syncHash('junta-detail');
    renderApp();
  });
}

function renderJuntaDetail(data) {
  const screen = ui.screens['junta-detail'];
  const junta = withJunta(data.juntas, state.selectedJuntaId);
  const comunidad = junta ? withComunidad(data.comunidades, junta.comunidad_id) : null;
  if (!junta || !comunidad) {
    screen.innerHTML = `<div class="sub-header"><button class="back-btn" onclick="goBack()">←</button><span class="sub-title">Detalle de junta</span></div>${stateCard({ tone: 'error', title: 'Junta no encontrada', body: 'No hay una junta activa válida para reconstruir esta vista tras la recarga.', actionLabel: 'Ir a juntas', action: "showScreen('juntas')" })}`;
    return;
  }
  const orden = parseOrderItems(junta.orden_dia);
  const grabaciones = data.grabaciones.filter((item) => item.junta_id === junta.id);
  const transcripciones = data.transcripciones.filter((item) => item.junta_id === junta.id);
  const acta = data.actas.find((item) => item.junta_id === junta.id);
  screen.innerHTML = `
    <div class="sub-header"><button class="back-btn" onclick="goBack()">←</button><span class="sub-title">Junta — ${escapeHtml(comunidad.nombre)}</span></div>
    <div class="progress-steps"><div class="step-dot done">1</div><div class="step-line ${grabaciones.length ? 'done' : ''}"></div><div class="step-dot ${grabaciones.length ? 'done' : 'current'}">2</div><div class="step-line ${transcripciones.length ? 'done' : ''}"></div><div class="step-dot ${transcripciones.length ? 'done' : ''}">3</div><div class="step-line ${acta ? 'done' : ''}"></div><div class="step-dot ${acta ? 'current' : ''}">4</div></div>
    <div class="card" style="cursor:default"><div style="display:flex;justify-content:space-between;margin-bottom:10px"><span style="font-weight:600">${escapeHtml(junta.tipo)}</span><span class="card-badge badge-warning">${escapeHtml(junta.estado)}</span></div><div style="font-size:14px;display:flex;flex-direction:column;gap:6px"><span style="color:var(--text-date)">📅 ${formatLongDate(junta.fecha)}</span><span style="color:var(--text-detail)">🕐 ${escapeHtml(junta.hora_segunda || '--:--')} · 2.ª convocatoria</span><span style="color:var(--text-location)">📍 ${escapeHtml(junta.lugar || 'Sin lugar')}</span><span style="color:var(--text-info)">🎙️ ${grabaciones.length} grabaciones</span><span style="color:var(--text-muted)">📝 ${transcripciones.length} transcripciones · ${acta ? 'acta disponible' : 'sin acta'}</span></div></div>
    <div class="section-header"><span class="section-title">Orden del día</span></div>
    ${orden.length ? orden.map((item, index) => `<div class="orden-item"><div class="orden-num">${index + 1}</div><div class="orden-text">${escapeHtml(item)}</div></div>`).join('') : stateCard({ tone: 'warning', title: 'Sin orden del día', body: 'La junta existe, pero este dato está vacío. Puedes seguir, aunque el acta saldrá menos completa.' })}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px"><button class="btn btn-secondary" onclick="showScreen('grabacion')">🎙️ Grabar</button><button class="btn btn-primary" onclick="showScreen('transcripcion')">📝 Transcribir</button></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px"><button class="btn btn-secondary" onclick="showScreen('generar-acta')">🤖 Generar acta</button><button class="btn btn-secondary" onclick="showScreen('historico')">📚 Ver histórico</button></div>
  `;
}

function renderGrabacion(data) {
  const screen = ui.screens.grabacion;
  const junta = withJunta(data.juntas, state.selectedJuntaId);
  const comunidad = junta ? withComunidad(data.comunidades, junta.comunidad_id) : null;
  const items = junta ? data.grabaciones.filter((item) => item.junta_id === junta.id) : [];
  screen.innerHTML = `
    <div class="sub-header"><button class="back-btn" onclick="goBack()">←</button><span class="sub-title">Grabación</span></div>
    <div style="text-align:center;margin-bottom:6px"><span class="card-badge badge-warning" style="font-size:13px">${junta ? `${escapeHtml(comunidad?.nombre || 'Comunidad')} — ${formatShortDate(junta.fecha)}` : 'Sin junta seleccionada'}</span></div>
    <div id="grabacionStorageBanner"></div>
    ${!junta ? stateCard({ tone: 'warning', title: 'Selecciona una junta primero', body: 'La grabación productiva siempre debe quedar asociada a una junta real.', actionLabel: 'Ir a juntas', action: "showScreen('juntas')" }) : `
      <div class="recorder-container">
        <div class="rec-time" id="recTime">${formatDuration(Math.floor(recordingElapsedMs / 1000))}</div>
        <div class="waveform" id="waveform">${Array.from({ length: 24 }, (_, i) => `<div class="wave-bar ${isRecording && !isPaused ? 'active' : ''}" style="height:${10 + ((i % 5) * 8)}px"></div>`).join('')}</div>
        <div class="rec-controls">
          <button class="rec-btn rec-btn-sec" onclick="addMarker()" ${!isRecording ? 'disabled' : ''}>🔖</button>
          <button class="rec-btn rec-btn-main ${isRecording && !isPaused ? 'recording' : ''}" onclick="toggleRecording()">${isRecording ? '⏹' : '⏺'}</button>
          <button class="rec-btn rec-btn-sec" onclick="togglePauseRecording()" ${!isRecording ? 'disabled' : ''}>${isPaused ? '▶️' : '⏸'}</button>
        </div>
        <div style="margin-top:14px;font-size:13px;color:var(--text-muted)">${pendingBlob ? 'Grabación capturada y lista.' : isRecording ? 'Grabación en curso.' : 'Pulsa grabar para pedir permiso de micrófono.'}</div>
      </div>
      <div class="section-header" style="margin-top:16px"><span class="section-title">Marcadores manuales</span></div>
      <div>${markers.length ? markers.map((marker) => `<div class="marker-item"><span class="marker-time">${formatDuration(marker.seconds)}</span><span>${escapeHtml(marker.label)}</span></div>`).join('') : '<div class="card" style="cursor:default">Sin marcadores en la grabación actual.</div>'}</div>
    `}
    <div class="section-header" style="margin-top:16px"><span class="section-title">Grabaciones guardadas</span></div>
    <div>${items.length ? items.map((item) => `<div class="card" style="cursor:default"><div class="card-header"><span class="card-title">🎙️ ${escapeHtml(item.nombre)}</span><span class="card-badge badge-accent">${formatDuration(item.duracion_segundos)}</span></div><div class="card-meta"><span class="card-meta-item meta-date">💾 ${Math.round((item.tamano_bytes || 0) / 1024)} KB</span><span class="card-meta-item meta-time">🗓️ ${formatDateTime(item.created_at)}</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px"><button class="btn btn-secondary" onclick="playGrabacion('${item.id}')">▶️ Reproducir</button><button class="btn btn-danger" onclick="deleteGrabacion('${item.id}')">🗑️ Eliminar</button></div></div>`).join('') : stateCard({ tone: 'empty', title: 'Sin grabaciones guardadas', body: 'Cuando termines una grabación aparecerá aquí y quedará lista para transcribir.' })}</div>
    <button class="btn btn-primary" style="margin-top:16px" onclick="showScreen('transcripcion')">Ir a transcripción →</button>
  `;
  renderStorageBanner();
  if (pendingBlob && junta) savePendingRecording(junta).catch((error) => alert(error.message || 'No se ha podido guardar la grabación.'));
}

async function renderStorageBanner() {
  const target = $('#grabacionStorageBanner');
  if (!target) return;
  const usage = await getRecordingUsage();
  const limitLabel = `${(usage.limitBytes / (1024 * 1024)).toFixed(1)} MB`;
  const usedLabel = `${(usage.usedBytes / (1024 * 1024)).toFixed(1)} MB`;
  const messages = {
    ok: 'Capacidad local en rango correcto.',
    warning: 'Queda poco espacio local para audio. Conviene limpiar grabaciones antiguas.',
    danger: 'No hay espacio local suficiente para guardar con seguridad nuevas grabaciones.',
  };
  target.innerHTML = `<div class="storage-banner ${usage.status}"><div><strong>Audio local:</strong> ${usedLabel} / ${limitLabel}</div><div>${messages[usage.status]}</div></div>`;
}

function renderTranscripcion(data) {
  const screen = ui.screens.transcripcion;
  const junta = withJunta(data.juntas, state.selectedJuntaId);
  const comunidad = junta ? withComunidad(data.comunidades, junta.comunidad_id) : null;
  const recordings = junta ? data.grabaciones.filter((item) => item.junta_id === junta.id) : [];
  const selectedRecording = recordings.find((item) => item.id === state.selectedGrabacionId) || recordings[0] || null;
  const selectedTranscripcion = data.transcripciones.find((item) => item.id === state.selectedTranscripcionId)
    || data.transcripciones.find((item) => item.grabacion_id === selectedRecording?.id)
    || null;
  const chunkPlan = selectedRecording ? splitAudioBlobMeta(selectedRecording.audio_blob, selectedRecording.duracion_segundos) : [];
  screen.innerHTML = `
    <div class="sub-header"><button class="back-btn" onclick="goBack()">←</button><span class="sub-title">Transcripción</span></div>
    <div style="text-align:center;margin-bottom:6px"><span class="card-badge badge-warning" style="font-size:13px">${junta ? `${escapeHtml(comunidad?.nombre || 'Comunidad')} — ${formatShortDate(junta.fecha)}` : 'Sin junta seleccionada'}</span></div>
    ${!junta ? stateCard({ tone: 'warning', title: 'Sin junta activa', body: 'La transcripción necesita una junta y una grabación asociada.', actionLabel: 'Ir a juntas', action: "showScreen('juntas')" }) : `
      <div class="form-group"><label class="form-label">Grabación</label><select class="form-select" id="transcripcionGrabacionSelect">${recordings.length ? recordings.map((item) => `<option value="${item.id}" ${item.id === selectedRecording?.id ? 'selected' : ''}>${escapeHtml(item.nombre)} · ${formatDuration(item.duracion_segundos)}</option>`).join('') : '<option value="">No hay grabaciones</option>'}</select></div>
      <div class="section-header"><span class="section-title">Método de transcripción</span></div>
      <div class="transcript-options"><div class="option-card ${state.selectedTranscriptionMethod === 'whisper_api' ? 'selected' : ''}" onclick="selectTranscriptionMethod('whisper_api')"><div class="option-icon">☁️</div><div class="option-title">Whisper</div><div class="option-desc">OpenAI · mejor precisión</div><div class="option-price">~0,36 €/hora</div></div><div class="option-card ${state.selectedTranscriptionMethod === 'web_speech' ? 'selected' : ''}" onclick="selectTranscriptionMethod('web_speech')"><div class="option-icon">📱</div><div class="option-title">Web Speech</div><div class="option-desc">Modo económico asistido</div><div class="option-price" style="color:var(--success)">~0,03 €/acta</div></div></div>
      <div class="storage-banner ok">${state.selectedTranscriptionMethod === 'web_speech' ? 'Web Speech API: depende del navegador y de permisos de reproducción/micrófono.' : `Whisper API: coste estimado ${formatEuro(((selectedRecording?.duracion_segundos || 0) / 3600) * 0.36)}. ${chunkPlan.length > 1 ? `Se dividirá en ${chunkPlan.length} fragmentos automáticos.` : 'No necesita división de audio.'}`}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px"><button class="btn btn-primary" onclick="startTranscription()" ${!selectedRecording ? 'disabled' : ''}>🚀 Iniciar transcripción</button><button class="btn btn-secondary" onclick="showScreen('junta-detail')">↩️ Volver a junta</button></div>
      <div class="card" style="cursor:default"><div style="font-size:13px;color:var(--text-muted);margin-bottom:10px">${selectedTranscripcion ? `Método: ${selectedTranscripcion.metodo} · Coste estimado: ${formatEuro(selectedTranscripcion.coste_estimado)} · Duración: ${formatDuration(selectedTranscripcion.duracion_segundos)}` : 'Sin transcripción cargada.'}</div><textarea class="form-textarea transcript-editor" id="transcripcionEditor" rows="12" placeholder="Aquí aparecerá la transcripción.">${escapeHtml(getActiveText(selectedTranscripcion))}</textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px"><button class="btn btn-secondary" onclick="saveTranscriptionEdits()" ${!selectedTranscripcion ? 'disabled' : ''}>💾 Guardar correcciones</button><button class="btn btn-secondary" onclick="resetTranscriptionEdits()" ${!selectedTranscripcion ? 'disabled' : ''}>↩️ Restaurar original</button></div>
      <button class="btn btn-primary" style="margin-top:10px" onclick="showScreen('generar-acta')">Generar acta →</button>
      <div class="section-header" style="margin-top:20px"><span class="section-title">Historial de transcripciones</span></div>
      <div>${data.transcripciones.filter((item) => item.junta_id === junta.id).map((item) => `<div class="card" onclick="openTranscripcion('${item.id}')"><div class="card-header"><span class="card-title">📝 ${item.metodo === 'web_speech' ? 'Web Speech' : 'Whisper'}</span><span class="card-badge ${item.estado === 'completada' ? 'badge-success' : item.estado === 'error' ? 'badge-danger' : 'badge-warning'}">${escapeHtml(item.estado)}</span></div><div class="card-meta"><span class="card-meta-item meta-date">⏱️ ${formatDuration(item.duracion_segundos)}</span><span class="card-meta-item meta-type">💶 ${formatEuro(item.coste_estimado)}</span><span class="card-meta-item meta-time">🧩 ${(item.fragmentos || []).length || 1} fragmentos</span></div></div>`).join('') || stateCard({ tone: 'empty', title: 'Sin historial', body: 'Todavía no hay transcripciones guardadas para esta junta.' })}</div>
    `}
  `;
  $('#transcripcionGrabacionSelect', screen)?.addEventListener('change', (event) => {
    setState({ selectedGrabacionId: event.target.value || null, selectedTranscripcionId: null });
  });
}

function buildActaText(junta, comunidad, transcripcion) {
  const puntos = parseOrderItems(junta?.orden_dia);
  const cuerpo = getActiveText(transcripcion) || 'Sin transcripción disponible todavía.';
  return `ACTA DE JUNTA DE PROPIETARIOS\n\nComunidad: ${comunidad?.nombre || 'Sin comunidad'}\nFecha: ${formatLongDate(junta?.fecha)}\nHora: ${junta?.hora_segunda || '--:--'}\nLugar: ${junta?.lugar || 'Sin lugar'}\nTipo: ${junta?.tipo || 'Sin tipo'}\n\nORDEN DEL DÍA\n${puntos.map((item, index) => `${index + 1}. ${item}`).join('\n') || 'Sin puntos'}\n\nDESARROLLO\n${cuerpo}\n\nCIERRE\nSe redacta este borrador a partir de la transcripción disponible y queda pendiente de revisión final.`;
}

function renderGenerarActa(data) {
  const screen = ui.screens['generar-acta'];
  const junta = withJunta(data.juntas, state.selectedJuntaId);
  const comunidad = junta ? withComunidad(data.comunidades, junta.comunidad_id) : null;
  const transcripcion = data.transcripciones.find((item) => item.id === state.selectedTranscripcionId)
    || data.transcripciones.find((item) => item.junta_id === junta?.id && item.estado === 'completada');
  screen.innerHTML = `
    <div class="sub-header"><button class="back-btn" onclick="goBack()">←</button><span class="sub-title">Generar acta</span></div>
    ${!junta ? stateCard({ tone: 'warning', title: 'Sin junta activa', body: 'No se puede generar un acta sin junta seleccionada.', actionLabel: 'Ir a juntas', action: "showScreen('juntas')" }) : `
      <div class="progress-steps"><div class="step-dot done">✓</div><div class="step-line done"></div><div class="step-dot done">✓</div><div class="step-line ${transcripcion ? 'done' : ''}"></div><div class="step-dot ${transcripcion ? 'done' : 'current'}">3</div><div class="step-line"></div><div class="step-dot ${transcripcion ? 'current' : ''}">4</div></div>
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px;text-align:center"><div style="font-size:32px;margin-bottom:8px">🤖</div><div style="font-size:15px;font-weight:600;margin-bottom:4px">Generación integrada del acta</div><div style="font-size:14px;color:var(--text-muted);line-height:1.6">Bloque 7 conecta esta pantalla con la junta y la transcripción reales, evitando una vista demo aislada.</div><div style="font-size:13px;color:var(--text-detail);margin-top:8px">Coste estimado mostrado: ~0,03 €</div></div>
      <div class="section-header"><span class="section-title">Datos incluidos</span></div>
      <div style="font-size:14px;display:flex;flex-direction:column;gap:6px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:14px"><span style="color:var(--text-location)">✅ Comunidad: ${escapeHtml(comunidad?.nombre || 'Sin comunidad')}</span><span style="color:var(--text-date)">✅ Fecha: ${formatShortDate(junta.fecha)} · ${escapeHtml(junta.hora_segunda || '--:--')}</span><span style="color:var(--text-info)">✅ Orden del día: ${parseOrderItems(junta.orden_dia).length} puntos</span><span style="color:var(--text-detail)">✅ Transcripción: ${transcripcion ? formatDuration(transcripcion.duracion_segundos) : 'pendiente'}</span></div>
      <button class="btn btn-primary" style="margin-top:16px" onclick="generateActa()" ${!transcripcion ? 'disabled' : ''}>🤖 Generar acta</button>
      ${!transcripcion ? stateCard({ tone: 'warning', title: 'Falta transcripción', body: 'El flujo canónico exige transcripción antes de generar el acta.' }) : ''}
    `}
  `;
}

function renderActaPreview(data) {
  const screen = ui.screens['acta-preview'];
  const acta = data.actas.find((item) => item.id === state.selectedActaId)
    || data.actas.find((item) => item.junta_id === state.selectedJuntaId)
    || null;
  const junta = acta ? withJunta(data.juntas, acta.junta_id) : null;
  const comunidad = junta ? withComunidad(data.comunidades, junta.comunidad_id) : null;
  screen.innerHTML = `
    <div class="sub-header"><button class="back-btn" onclick="goBack()">←</button><span class="sub-title">Acta generada</span></div>
    ${!acta ? stateCard({ tone: 'warning', title: 'No hay acta disponible', body: 'Genera antes un acta desde una transcripción real.', actionLabel: 'Ir a generar acta', action: "showScreen('generar-acta')" }) : `
      <div class="acta-preview"><h2>Acta de la Junta de Propietarios<br>${escapeHtml(comunidad?.nombre || '')}</h2>${nl2br(acta.texto)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px"><button class="btn btn-secondary" onclick="editActa()">✏️ Editar acta</button><button class="btn btn-primary" onclick="exportActaDoc('${acta.id}')">📥 Exportar .docx</button></div>
      <button class="btn btn-secondary" style="margin-top:8px" onclick="exportActaTxt('${acta.id}')">📄 Exportar .txt</button>
    `}
  `;
}

function renderHistorico(data) {
  const screen = ui.screens.historico;
  screen.innerHTML = `
    <div class="sub-header"><button class="back-btn" onclick="goBack()">←</button><span class="sub-title">Histórico</span></div>
    <div class="search-bar"><span>🔍</span><input type="text" placeholder="Buscar en actas y transcripciones..." id="historySearch"></div>
    <div id="historyList"></div>
  `;
  const list = $('#historyList', screen);
  const renderList = (term = '') => {
    const normalized = term.toLowerCase();
    const items = data.juntas.filter((junta) => {
      const comunidad = withComunidad(data.comunidades, junta.comunidad_id);
      const acta = data.actas.find((item) => item.junta_id === junta.id);
      const hayTexto = [comunidad?.nombre, junta.tipo, acta?.texto].join(' ').toLowerCase();
      return hayTexto.includes(normalized);
    });
    list.innerHTML = items.length ? items.map((junta) => {
      const comunidad = withComunidad(data.comunidades, junta.comunidad_id);
      const transcripcion = data.transcripciones.find((item) => item.junta_id === junta.id);
      const acta = data.actas.find((item) => item.junta_id === junta.id);
      return `<div class="card" onclick="openJunta('${junta.id}')"><div class="card-header"><span class="card-title">${escapeHtml(comunidad?.nombre || 'Sin comunidad')}</span><span class="card-badge ${acta ? 'badge-success' : 'badge-warning'}">${acta ? 'Acta ✓' : 'Pendiente'}</span></div><div class="card-meta"><span class="card-meta-item meta-date">📅 ${formatShortDate(junta.fecha)}</span><span class="card-meta-item" style="color:var(--text-detail)">🎙️ ${transcripcion ? formatDuration(transcripcion.duracion_segundos) : '00:00:00'}</span><span class="card-meta-item meta-type">📝 ${escapeHtml(junta.tipo)}</span></div></div>`;
    }).join('') : stateCard({ tone: 'empty', title: 'Sin resultados', body: 'No hay elementos que coincidan con la búsqueda o todavía no existe histórico.' });
  };
  $('#historySearch', screen)?.addEventListener('input', (event) => renderList(event.target.value || ''));
  renderList();
}

function renderConfig() {
  const screen = ui.screens.config;
  const openAi = localStorage.getItem('gestactas_openai_api_key') || '';
  const claude = localStorage.getItem('gestactas_claude_api_key') || '';
  const mask = (value) => value ? `${value.slice(0, 6)}••••${value.slice(-4)}` : 'No configurada';
  screen.innerHTML = `
    <div class="sub-header"><button class="back-btn" onclick="goBack()">←</button><span class="sub-title">Configuración</span></div>
    <div class="section-header"><span class="section-title">Claves API</span></div>
    <div class="config-item"><div class="config-left"><span class="config-icon">☁️</span><div><div class="config-label">OpenAI (Whisper)</div><div class="config-desc api-key-display">${escapeHtml(mask(openAi))}</div></div></div></div>
    <div class="config-item"><div class="config-left"><span class="config-icon">🤖</span><div><div class="config-label">Anthropic (Claude)</div><div class="config-desc api-key-display">${escapeHtml(mask(claude))}</div></div></div></div>
    <div class="section-header" style="margin-top:20px"><span class="section-title">Estado de la app</span></div>
    <div class="config-item"><div class="config-left"><span class="config-icon">🧭</span><div><div class="config-label">Post-refresh</div><div class="config-desc">La pantalla activa se reconstruye desde hash + estado persistido.</div></div></div></div>
    <div class="config-item"><div class="config-left"><span class="config-icon">💾</span><div><div class="config-label">Persistencia</div><div class="config-desc">Comunidades, juntas, grabaciones, transcripciones y actas en IndexedDB.</div></div></div></div>
  `;
}

async function renderApp() {
  const data = await loadData();
  const screenId = state.currentScreen || 'dashboard';
  activateScreen(screenId);
  renderDashboard(data);
  renderComunidades(data);
  renderComunidadNueva();
  renderComunidadDetail(data);
  renderJuntas(data);
  renderJuntaNueva(data);
  renderJuntaDetail(data);
  renderGrabacion(data);
  renderTranscripcion(data);
  renderGenerarActa(data);
  renderActaPreview(data);
  renderHistorico(data);
  renderConfig();
}

function splitAudioBlobMeta(blob, durationSeconds = 0) {
  if (!blob) return [];
  if (blob.size <= WHISPER_MAX_BYTES) return [{ sizeBytes: blob.size, durationSeconds }];
  const chunks = [];
  let offset = 0;
  while (offset < blob.size) {
    const end = Math.min(offset + WHISPER_SAFE_CHUNK_BYTES, blob.size);
    const sizeBytes = end - offset;
    chunks.push({ sizeBytes, durationSeconds: durationSeconds ? Number(((sizeBytes / blob.size) * durationSeconds).toFixed(2)) : 0 });
    offset = end;
  }
  return chunks;
}

async function transcribeWithWhisper(blob, durationSeconds) {
  const apiKey = localStorage.getItem('gestactas_openai_api_key') || '';
  if (!apiKey) throw new Error('No hay clave de OpenAI configurada para Whisper.');
  const chunks = splitAudioBlobMeta(blob, durationSeconds);
  const parts = [];
  let offset = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    const meta = chunks[index];
    const chunkBlob = blob.size > WHISPER_MAX_BYTES ? blob.slice(offset, offset + meta.sizeBytes, blob.type || 'audio/webm') : blob;
    offset += meta.sizeBytes;
    const form = new FormData();
    form.append('file', new File([chunkBlob], `gestactas-${index + 1}.webm`, { type: blob.type || 'audio/webm' }));
    form.append('model', 'whisper-1');
    form.append('language', 'es');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form });
    if (!response.ok) throw new Error(`Whisper API devolvió ${response.status}.`);
    const payload = await response.json();
    parts.push({ index, text: payload.text || '', sizeBytes: meta.sizeBytes, durationSeconds: meta.durationSeconds });
  }
  return {
    text: parts.map((part) => part.text.trim()).filter(Boolean).join('\n\n'),
    fragments: parts,
  };
}

async function transcribeWithWebSpeech(blob) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) throw new Error('Web Speech API no está disponible en este navegador.');
  return new Promise((resolve, reject) => {
    const recognition = new Recognition();
    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(blob);
    let finalText = '';
    let interimText = '';
    recognition.onresult = (event) => {
      interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        if (result.isFinal) finalText += `${text} `;
        else interimText += text;
      }
      const editor = $('#transcripcionEditor');
      if (editor) editor.value = `${finalText} ${interimText}`.trim();
    };
    recognition.onerror = (event) => {
      URL.revokeObjectURL(url);
      reject(new Error(`Web Speech API ha fallado: ${event.error || 'error desconocido'}`));
    };
    recognition.onend = () => {
      URL.revokeObjectURL(url);
      const text = `${finalText} ${interimText}`.trim();
      if (!text) reject(new Error('Web Speech API no ha devuelto texto utilizable.'));
      else resolve({ text, fragments: [] });
    };
    audio.src = url;
    audio.onended = () => recognition.stop();
    audio.play().catch(() => {});
    try { recognition.start(); } catch (error) { reject(error); }
  });
}

async function savePendingRecording(junta) {
  if (!pendingBlob || !junta) return;
  const usage = await getRecordingUsage();
  if (usage.usedBytes + pendingBlob.size > usage.limitBytes || usage.usedBytes + pendingBlob.size > STORAGE_LIMIT_BYTES) {
    pendingBlob = null;
    throw new Error('No hay espacio local suficiente para guardar la grabación.');
  }
  const recording = {
    id: generateId('grabacion'),
    junta_id: junta.id,
    nombre: `Grabación ${withComunidad(await idbGetAll('comunidades'), junta.comunidad_id)?.nombre || ''} ${formatShortDate(junta.fecha)}`.trim(),
    audio_blob: pendingBlob,
    duracion_segundos: Math.round(recordingElapsedMs / 1000),
    tamano_bytes: pendingBlob.size,
    marcador_count: markers.length,
    marcadores: markers,
    estado: 'guardada',
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await idbPut('grabaciones', recording);
  pendingBlob = null;
  markers = [];
  recordingElapsedMs = 0;
  setState({ selectedGrabacionId: recording.id });
}

function stopTimer() {
  if (recordingTimer) clearInterval(recordingTimer);
  recordingTimer = null;
}

function startTimer() {
  stopTimer();
  recordingTimer = setInterval(() => {
    if (!isRecording || isPaused) return;
    recordingElapsedMs = Date.now() - recordingStartedAt;
    const node = $('#recTime');
    if (node) node.textContent = formatDuration(Math.floor(recordingElapsedMs / 1000));
  }, 250);
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no soporta grabación de audio.');
  const usage = await getRecordingUsage();
  if (usage.status === 'danger') throw new Error('No hay espacio local suficiente para guardar la grabación.');
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(mediaStream);
  recordingChunks = [];
  markers = [];
  recordingElapsedMs = 0;
  recordingStartedAt = Date.now();
  mediaRecorder.ondataavailable = (event) => {
    if (event.data?.size) recordingChunks.push(event.data);
  };
  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordingChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
    pendingBlob = blob;
    mediaStream?.getTracks().forEach((track) => track.stop());
    mediaStream = null;
    mediaRecorder = null;
    isRecording = false;
    isPaused = false;
    stopTimer();
    await renderApp();
  };
  mediaRecorder.start();
  isRecording = true;
  isPaused = false;
  startTimer();
  renderApp();
}

window.toggleRecording = async function toggleRecording() {
  try {
    if (!isRecording) await startRecording();
    else mediaRecorder?.stop();
  } catch (error) {
    alert(error.message || 'No se ha podido iniciar la grabación.');
  }
};

window.togglePauseRecording = function togglePauseRecording() {
  if (!mediaRecorder) return;
  if (isPaused) {
    mediaRecorder.resume();
    recordingStartedAt = Date.now() - recordingElapsedMs;
    isPaused = false;
    startTimer();
  } else {
    mediaRecorder.pause();
    recordingElapsedMs = Date.now() - recordingStartedAt;
    isPaused = true;
  }
  renderApp();
};

window.addMarker = function addMarker() {
  if (!isRecording) return;
  const seconds = Math.floor((Date.now() - recordingStartedAt) / 1000);
  markers.push({ seconds, label: `Marcador ${markers.length + 1}` });
  renderApp();
};

window.playGrabacion = async function playGrabacion(id) {
  const item = await idbGet('grabaciones', id);
  if (!item?.audio_blob) return;
  const audio = new Audio(URL.createObjectURL(item.audio_blob));
  audio.play();
};

window.deleteGrabacion = async function deleteGrabacion(id) {
  await idbDelete('grabaciones', id);
  if (state.selectedGrabacionId === id) state.selectedGrabacionId = null;
  renderApp();
};

window.selectTranscriptionMethod = function selectTranscriptionMethod(method) {
  setState({ selectedTranscriptionMethod: method });
};

window.startTranscription = async function startTranscription() {
  const recordingId = state.selectedGrabacionId;
  if (!recordingId) {
    alert('Selecciona primero una grabación.');
    return;
  }
  const recording = await idbGet('grabaciones', recordingId);
  if (!recording?.audio_blob) {
    alert('No hay audio disponible para transcribir.');
    return;
  }
  try {
    const result = state.selectedTranscriptionMethod === 'web_speech'
      ? await transcribeWithWebSpeech(recording.audio_blob)
      : await transcribeWithWhisper(recording.audio_blob, recording.duracion_segundos || 0);
    const transcripcion = {
      id: generateId('transcripcion'),
      junta_id: recording.junta_id,
      grabacion_id: recording.id,
      metodo: state.selectedTranscriptionMethod,
      estado: 'completada',
      texto: result.text,
      texto_editado: '',
      usar_texto_editado: false,
      fragmentos: result.fragments || [],
      duracion_segundos: recording.duracion_segundos || 0,
      tamano_audio_bytes: recording.tamano_bytes || 0,
      coste_estimado: state.selectedTranscriptionMethod === 'web_speech' ? 0.03 : Number((((recording.duracion_segundos || 0) / 3600) * 0.36).toFixed(2)),
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await idbPut('transcripciones', transcripcion);
    setState({ selectedTranscripcionId: transcripcion.id, currentScreen: 'transcripcion' });
  } catch (error) {
    alert(error.message || 'No se ha podido completar la transcripción.');
  }
};

window.saveTranscriptionEdits = async function saveTranscriptionEdits() {
  const transcripcion = await idbGet('transcripciones', state.selectedTranscripcionId);
  const editor = $('#transcripcionEditor');
  if (!transcripcion || !editor) return;
  transcripcion.texto_editado = editor.value;
  transcripcion.usar_texto_editado = true;
  transcripcion.updated_at = nowIso();
  await idbPut('transcripciones', transcripcion);
  renderApp();
};

window.resetTranscriptionEdits = async function resetTranscriptionEdits() {
  const transcripcion = await idbGet('transcripciones', state.selectedTranscripcionId);
  if (!transcripcion) return;
  transcripcion.texto_editado = '';
  transcripcion.usar_texto_editado = false;
  transcripcion.updated_at = nowIso();
  await idbPut('transcripciones', transcripcion);
  renderApp();
};

window.generateActa = async function generateActa() {
  const junta = await idbGet('juntas', state.selectedJuntaId);
  const comunidad = junta ? await idbGet('comunidades', junta.comunidad_id) : null;
  const transcripcion = await idbGet('transcripciones', state.selectedTranscripcionId) || (await idbGetAll('transcripciones')).find((item) => item.junta_id === junta?.id && item.estado === 'completada');
  if (!junta || !transcripcion) {
    alert('Hace falta una junta válida y una transcripción completada.');
    return;
  }
  const acta = {
    id: generateId('acta'),
    junta_id: junta.id,
    transcripcion_id: transcripcion.id,
    estado: 'borrador',
    texto: buildActaText(junta, comunidad, transcripcion),
    version: 1,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  await idbPut('actas', acta);
  setState({ selectedActaId: acta.id, currentScreen: 'acta-preview' }, { silent: true });
  syncHash('acta-preview');
  renderApp();
};

window.editActa = async function editActa() {
  const acta = await idbGet('actas', state.selectedActaId);
  if (!acta) return;
  const next = prompt('Editar acta', acta.texto);
  if (typeof next !== 'string') return;
  acta.texto = next;
  acta.version += 1;
  acta.updated_at = nowIso();
  await idbPut('actas', acta);
  renderApp();
};

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

window.exportActaTxt = async function exportActaTxt(id) {
  const acta = await idbGet('actas', id);
  if (!acta) return;
  downloadBlob(new Blob([acta.texto], { type: 'text/plain;charset=utf-8' }), `acta-${id}.txt`);
};

window.exportActaDoc = async function exportActaDoc(id) {
  const acta = await idbGet('actas', id);
  if (!acta) return;
  const html = `<html><head><meta charset="utf-8"></head><body><pre>${escapeHtml(acta.texto)}</pre></body></html>`;
  downloadBlob(new Blob([html], { type: 'application/msword' }), `acta-${id}.doc`);
};

window.openComunidad = function openComunidad(id) {
  setState({ selectedComunidadId: id, currentScreen: 'comunidad-detail' }, { silent: true });
  syncHash('comunidad-detail');
  renderApp();
};

window.openJunta = function openJunta(id) {
  setState({ selectedJuntaId: id, currentScreen: 'junta-detail' }, { silent: true });
  syncHash('junta-detail');
  renderApp();
};

window.openTranscripcion = async function openTranscripcion(id) {
  const transcripcion = await idbGet('transcripciones', id);
  if (!transcripcion) return;
  setState({ selectedJuntaId: transcripcion.junta_id, selectedGrabacionId: transcripcion.grabacion_id, selectedTranscripcionId: transcripcion.id, currentScreen: 'transcripcion' }, { silent: true });
  syncHash('transcripcion');
  renderApp();
};

window.showScreen = function showScreen(screenId) {
  setState({ currentScreen: screenId }, { silent: true });
  syncHash(screenId);
  renderApp();
};

window.goBack = function goBack() {
  window.history.back();
};

window.addEventListener('hashchange', () => {
  const screenId = getCurrentHashScreen();
  state.currentScreen = screenId;
  persistUiState();
  renderApp();
});

async function initialize() {
  restoreUiState();
  ui.screens = Object.fromEntries($all('.screen').map((node) => [node.id.replace('screen-', ''), node]));
  ui.bottomNav = $all('.nav-item');
  const screenFromHash = getCurrentHashScreen();
  state.currentScreen = screenFromHash;
  persistUiState();
  await renderApp();
}

initialize();
