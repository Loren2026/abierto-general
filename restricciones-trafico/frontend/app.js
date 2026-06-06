const form = document.querySelector('#route-form')
const statusBox = document.querySelector('#status')
const results = document.querySelector('#results')
const button = document.querySelector('#submit-button')
const confidenceCard = document.querySelector('#confidence-card')
const confidenceText = document.querySelector('#confidence-text')
const confidenceWarning = document.querySelector('#confidence-warning')
const restrictionsList = document.querySelector('#restrictions-list')
const roadsList = document.querySelector('#roads-list')
let map
let routeLayer
let restrictionLayer

function today() { return new Date().toISOString().slice(0, 10) }
document.querySelector('#fecha_salida').value = today()
document.querySelector('#fecha_llegada').value = today()

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(() => {})
}

function setStatus(message, type = 'info') {
  statusBox.hidden = !message
  statusBox.textContent = message || ''
  statusBox.className = `status ${type}`
}

function ensureMap() {
  if (map) return map
  map = L.map('map', { scrollWheelZoom: false }).setView([40.4, -3.7], 6)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)
  return map
}

function refreshMapSize() {
  if (!map) return
  requestAnimationFrame(() => {
    map.invalidateSize()
    setTimeout(() => map.invalidateSize(), 100)
  })
}

function drawMap(data) {
  const m = ensureMap()
  refreshMapSize()
  if (routeLayer) routeLayer.remove()
  if (restrictionLayer) restrictionLayer.remove()
  const coords = data.geometry?.coordinates || []
  if (coords.length) {
    const latlngs = coords.map(([lon, lat]) => [lat, lon])
    routeLayer = L.polyline(latlngs, { color: '#38bdf8', weight: 5, opacity: .9 }).addTo(m)
    m.fitBounds(routeLayer.getBounds(), { padding: [22, 22] })
  }
  restrictionLayer = L.layerGroup().addTo(m)
  for (const item of data.restricciones || []) {
    if (!coords.length) continue
    const idx = Math.floor(coords.length / 2)
    const [lon, lat] = coords[idx]
    L.circleMarker([lat, lon], { radius: 8, color: '#ef4444', fillColor: '#ef4444', fillOpacity: .85 })
      .bindPopup(`<strong>${item.via || 'Restricción'}</strong><br>${item.source_scope || ''}<br>${item.id}`)
      .addTo(restrictionLayer)
  }
}

function renderConfidence(data) {
  const confidence = data.route_confidence || 'baja'
  confidenceCard.className = `card confidence-card confidence-${confidence}`
  confidenceText.textContent = confidence
  const unsafe = confidence !== 'alta' || data.summary?.no_declarar_via_libre
  confidenceWarning.textContent = unsafe
    ? 'No se puede garantizar vía libre, revisar manualmente.'
    : 'Detección de vías suficiente. Revisa igualmente el detalle antes de salir.'
}

function renderRoads(roads = []) {
  roadsList.innerHTML = ''
  if (!roads.length) {
    roadsList.innerHTML = '<p class="empty">No se detectaron vías suficientes. Revisión manual obligatoria.</p>'
    return
  }
  for (const road of roads) {
    const span = document.createElement('span')
    span.className = 'chip'
    span.textContent = road
    roadsList.appendChild(span)
  }
}

function formatDays(days = []) { return days.length ? days.join(', ') : 'Sin días concretos' }
function formatTimeWindows(windows = []) {
  if (!windows.length) return 'Horario no detallado'
  return windows.map((window) => {
    if (window.start && window.end) return `${window.start}-${window.end}`
    return window.raw || 'Horario no detallado'
  }).join(', ')
}
function formatDateRule(item = {}) { return item.regla_fechas || item.date_rule?.raw || 'Regla de fechas no detallada' }
function formatPk(pk = {}) {
  const parts = []
  if (pk.start !== null && pk.start !== undefined) parts.push(`PK ${pk.start}`)
  if (pk.end !== null && pk.end !== undefined) parts.push(`→ ${pk.end}`)
  return parts.join(' ') || 'PK no detallado'
}

function renderRestrictions(items = []) {
  restrictionsList.innerHTML = ''
  if (!items.length) {
    restrictionsList.innerHTML = '<p class="empty">No hay restricciones cruzadas, pero solo es fiable si la confianza de vías es alta.</p>'
    return
  }
  for (const item of items) {
    const div = document.createElement('article')
    div.className = 'restriction-item'
    div.innerHTML = `
      <div class="restriction-head">
        <span class="road">${item.via || 'Genérica'}</span>
        <span class="badge">${item.confidence || 'baja'}</span>
      </div>
      <div class="meta"><strong>Ámbito:</strong> ${item.source_scope || '—'} · <strong>ID:</strong> ${item.id}</div>
      <div class="meta"><strong>Fechas afectadas:</strong> ${formatDays(item.dias_afecta)}</div>
      <div class="meta"><strong>Regla fechas:</strong> ${formatDateRule(item)}</div>
      <div class="meta"><strong>Horario:</strong> ${formatTimeWindows(item.franja_horaria)}</div>
      <div class="meta"><strong>Tramo:</strong> ${item.tramo?.inicio || '—'} → ${item.tramo?.fin || '—'} · ${formatPk(item.pk)}</div>
      <div class="meta"><strong>Sentido:</strong> ${item.sentido || 'No detallado'} · <strong>Tipo:</strong> ${item.restriction_type || '—'}</div>
    `
    restrictionsList.appendChild(div)
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const payload = Object.fromEntries(new FormData(form).entries())
  button.disabled = true
  results.hidden = true
  setStatus('Calculando ruta y consultando restricciones. Puede tardar por OSRM/Overpass…')
  try {
    const response = await fetch('/api/ruta/analizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.detail || data.error || `Error HTTP ${response.status}`)
    results.hidden = false
    renderConfidence(data)
    renderRoads(data.vias_detectadas)
    renderRestrictions(data.restricciones)
    drawMap(data)
    refreshMapSize()
    setStatus(data.warnings?.length ? `Avisos: ${data.warnings.join(' · ')}` : '')
  } catch (error) {
    setStatus(`No se pudo analizar la ruta: ${error.message}`, 'error')
  } finally {
    button.disabled = false
  }
})
