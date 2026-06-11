const ACCESS_PROJECT_SLUG = 'restricciones-trafico'
const ACCESS_API_BASE = 'https://panel.inteligencialoren.com/api'
const ACCESS_STORAGE_KEY = `restricciones_access_${ACCESS_PROJECT_SLUG}`
const DEVICE_STORAGE_KEY = `restricciones_device_${ACCESS_PROJECT_SLUG}`

const accessGate = document.querySelector('#access-gate')
const accessForm = document.querySelector('#access-form')
const accessCode = document.querySelector('#access-code')
const accessError = document.querySelector('#access-error')
const appContent = document.querySelector('#app-content')
const form = document.querySelector('#route-form')
const statusBox = document.querySelector('#status')
const results = document.querySelector('#results')
const button = document.querySelector('#submit-button')
const confidenceCard = document.querySelector('#confidence-card')
const confidenceText = document.querySelector('#confidence-text')
const confidenceWarning = document.querySelector('#confidence-warning')
const restrictionsList = document.querySelector('#restrictions-list')
const roadsList = document.querySelector('#roads-list')
const routeSummary = document.querySelector('#route-summary')
const centerMapButton = document.querySelector('#center-map')
const mapDetail = document.querySelector('#map-detail')
const cargoType = document.querySelector('#cargo_type')
const adrWarning = document.querySelector('#adr-warning')
let map
let routeLayer
let alternativeLayer
let restrictionLayer
let lowConfidenceLayer
let lastBounds
let resizeObserver

function today() { return new Date().toISOString().slice(0, 10) }
document.querySelector('#fecha_salida').value = today()
document.querySelector('#fecha_llegada').value = today()

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js').catch(() => {})
}

function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_STORAGE_KEY)
  if (!deviceId) {
    deviceId = crypto.randomUUID ? crypto.randomUUID() : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`
    localStorage.setItem(DEVICE_STORAGE_KEY, deviceId)
  }
  return deviceId
}

function deviceName() {
  return `${navigator.platform || 'web'} · ${navigator.userAgent.slice(0, 80)}`
}

function showApp() {
  accessGate.hidden = true
  appContent.hidden = false
}

function showGate(message = '') {
  accessGate.hidden = false
  appContent.hidden = true
  accessError.hidden = !message
  accessError.textContent = message
}

function hasStoredAccess() {
  try {
    const stored = JSON.parse(localStorage.getItem(ACCESS_STORAGE_KEY) || 'null')
    return stored?.ok === true && stored?.project?.slug === ACCESS_PROJECT_SLUG
  } catch (_) {
    return false
  }
}

async function validateAccessCode(code) {
  const response = await fetch(`${ACCESS_API_BASE}/projects/${ACCESS_PROJECT_SLUG}/validate-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, deviceId: getDeviceId(), deviceName: deviceName(), platform: 'web' }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.ok !== true) {
    throw new Error(data.error || 'Código inválido o no autorizado')
  }
  localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify({ ...data, validatedAt: new Date().toISOString() }))
  return data
}

accessForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  accessError.hidden = true
  const submit = accessForm.querySelector('button')
  submit.disabled = true
  try {
    await validateAccessCode(accessCode.value.trim())
    showApp()
  } catch (error) {
    localStorage.removeItem(ACCESS_STORAGE_KEY)
    showGate(error.message)
  } finally {
    submit.disabled = false
  }
})

hasStoredAccess() ? showApp() : showGate()

function setStatus(message, type = 'info') {
  statusBox.hidden = !message
  statusBox.textContent = message || ''
  statusBox.className = `status ${type}`
}

function ensureMap() {
  if (map) return map
  const container = document.querySelector('#map')
  container.style.width = '100%'
  map = L.map(container, { scrollWheelZoom: false, zoomControl: false, maxZoom: 19 }).setView([40.4, -3.7], 6)
  L.control.zoom({ position: 'topright' }).addTo(map)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    maxNativeZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)
  resizeObserver = new ResizeObserver(() => refreshMapSize())
  resizeObserver.observe(container)
  return map
}

function refreshMapSize(bounds, options = {}) {
  if (!map) return
  const apply = () => {
    map.invalidateSize()
    if (bounds?.isValid() && options.fit !== false) map.fitBounds(bounds, { padding: [28, 28], maxZoom: options.maxZoom ?? 11 })
  }
  requestAnimationFrame(() => {
    apply()
    setTimeout(apply, 120)
    setTimeout(apply, 350)
  })
}

function restrictionLatLngs(item, routeLatLngs) {
  const pk = item.pk || {}
  const start = Number(pk.start ?? pk.min)
  const end = Number(pk.end ?? pk.max)
  if (!Number.isFinite(start) || !Number.isFinite(end) || !routeLatLngs.length) return []
  const count = routeLatLngs.length
  const from = Math.max(0, Math.min(count - 1, Math.floor(count * 0.45)))
  const to = Math.max(from + 1, Math.min(count, Math.floor(count * 0.58)))
  return routeLatLngs.slice(from, to)
}

function showMapDetail(html) {
  mapDetail.innerHTML = html
  mapDetail.hidden = false
}

function bindDetail(layer, html) {
  layer.on('click', () => showMapDetail(html))
  return layer.bindPopup(html)
}

function drawMap(data) {
  const m = ensureMap()
  if (routeLayer) routeLayer.remove()
  if (alternativeLayer) alternativeLayer.remove()
  if (restrictionLayer) restrictionLayer.remove()
  if (lowConfidenceLayer) lowConfidenceLayer.remove()
  mapDetail.hidden = true
  const coords = data.geometry?.coordinates || data.original_route?.geometry?.coordinates || []
  let routeBounds
  if (coords.length) {
    const latlngs = coords.map(([lon, lat]) => [lat, lon])
    routeLayer = L.polyline(latlngs, { color: '#2563eb', weight: 6, opacity: .95, smoothFactor: 0, noClip: true, lineJoin: 'round', lineCap: 'round' }).addTo(m)
    routeBounds = routeLayer.getBounds()
  }
  const altCoords = data.alternative_route?.geometry?.coordinates || []
  if (altCoords.length) {
    const altLatLngs = altCoords.map(([lon, lat]) => [lat, lon])
    alternativeLayer = L.polyline(altLatLngs, { color: '#22c55e', weight: 6, opacity: .95, dashArray: '10 8', smoothFactor: 0, noClip: true, lineJoin: 'round', lineCap: 'round' }).addTo(m)
    routeBounds = routeBounds ? routeBounds.extend(alternativeLayer.getBounds()) : alternativeLayer.getBounds()
  }
  restrictionLayer = L.layerGroup().addTo(m)
  lowConfidenceLayer = L.layerGroup().addTo(m)
  for (const item of data.restricciones || data.crossed_restrictions || []) {
    if (!coords.length) continue
    const latlngs = coords.map(([lon, lat]) => [lat, lon])
    const segment = restrictionLatLngs(item, latlngs)
    if (segment.length > 1) {
      bindDetail(L.polyline(segment, { color: item.confidence === 'baja' ? '#f59e0b' : '#ef4444', weight: 9, opacity: .95 }), `<strong>${item.via || 'Restricción'}</strong><br>${item.source_scope || ''}<br>${item.id}`).addTo(item.confidence === 'baja' ? lowConfidenceLayer : restrictionLayer)
    } else {
      const idx = Math.floor(coords.length / 2)
      const [lon, lat] = coords[idx]
      bindDetail(L.circleMarker([lat, lon], { radius: 8, color: item.confidence === 'baja' ? '#f59e0b' : '#ef4444', fillColor: item.confidence === 'baja' ? '#f59e0b' : '#ef4444', fillOpacity: .85 }), `<strong>${item.via || 'Restricción'}</strong><br>${item.source_scope || ''}<br>${item.id}`)
        .addTo(item.confidence === 'baja' ? lowConfidenceLayer : restrictionLayer)
    }
  }
  lastBounds = routeBounds
  refreshMapSize(routeBounds)
}

function renderRouteSummary(data) {
  const original = data.original_route
  const alternative = data.alternative_route
  if (!original && !data.summary && data.distance_km === undefined) { routeSummary.innerHTML = '<p class="empty">Sin resumen de ruta.</p>'; return }
  const cards = []
  if (original) {
    cards.push(`<div class="metric"><span>Original</span><strong>${original.distance_km} km</strong><small>ETA ${original.eta_at || '—'} · ${original.eta_minutes || '—'} min</small></div>`)
  }
  if (alternative) {
    cards.push(`<div class="metric"><span>Alternativa</span><strong>${alternative.distance_km} km</strong><small>ETA ${alternative.eta_at || '—'} · ${alternative.eta_minutes || '—'} min</small></div>`)
  }
  if (!cards.length && data.distance_km !== undefined) cards.push(`<div class="metric"><span>Ruta clásica</span><strong>${data.distance_km} km</strong><small>ETA ${data.eta_at || '—'} · ${data.eta_minutes || '—'} min</small></div>`)
  if (data.summary) cards.push(`<div class="metric"><span>Vías</span><strong>${data.summary?.total_vias ?? '—'}</strong><small>Restricciones: ${data.summary?.total_restricciones ?? '—'}</small></div>`)
  routeSummary.innerHTML = cards.join('')
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
      <div class="meta"><span class="meta-label">Ámbito:</span> <span class="meta-value">${item.source_scope || '—'}</span> · <span class="meta-label">ID:</span> <span class="meta-value">${item.id}</span></div>
      <div class="meta"><span class="meta-label">Fechas afectadas:</span> <span class="meta-value">${formatDays(item.dias_afecta)}</span></div>
      <div class="meta"><span class="meta-label">Regla fechas:</span> <span class="meta-value">${formatDateRule(item)}</span></div>
      <div class="meta"><span class="meta-label">Horario:</span> <span class="meta-value">${formatTimeWindows(item.franja_horaria)}</span></div>
      <div class="meta"><span class="meta-label">Tramo:</span> <span class="meta-value">${item.tramo?.inicio || '—'} → ${item.tramo?.fin || '—'} · ${formatPk(item.pk)}</span></div>
      <div class="meta"><span class="meta-label">Sentido:</span> <span class="meta-value">${item.sentido || 'No detallado'}</span> · <span class="meta-label">Tipo:</span> <span class="meta-value">${item.restriction_type || '—'}</span></div>
    `
    restrictionsList.appendChild(div)
  }
}

cargoType.addEventListener('change', () => { adrWarning.hidden = cargoType.value !== 'adr' })
centerMapButton.addEventListener('click', () => refreshMapSize(lastBounds))

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const payload = Object.fromEntries(new FormData(form).entries())
  button.disabled = true
  results.hidden = true
  setStatus('Calculando ruta alternativa ORS. Si falla, se usará el análisis clásico OSRM/Overpass…')
  try {
    let data
    let fallbackWarning = ''
    try {
      const altResponse = await fetch('/api/ruta/alternativa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      data = await altResponse.json().catch(() => ({}))
      if (!altResponse.ok) {
        const message = data.detail || data.error || `Error HTTP ${altResponse.status}`
        if (altResponse.status === 400) throw Object.assign(new Error(message), { userFixable: true })
        throw new Error(message)
      }
    } catch (altError) {
      if (altError.userFixable) throw altError
      fallbackWarning = `Ruta alternativa no disponible (${altError.message}); usando análisis clásico.`
      const response = await fetch('/api/ruta/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.detail || data.error || `Error HTTP ${response.status}`)
    }
    results.hidden = false
    renderConfidence(data)
    renderRoads(data.vias_detectadas)
    renderRestrictions(data.restricciones || data.crossed_restrictions)
    renderRouteSummary(data)
    drawMap(data)
    refreshMapSize()
    const warnings = [...(fallbackWarning ? [fallbackWarning] : []), ...(data.warnings || [])]
    setStatus(warnings.length ? `Avisos: ${warnings.join(' · ')}` : '')
  } catch (error) {
    setStatus(`No se pudo analizar la ruta: ${error.message}`, 'error')
  } finally {
    button.disabled = false
  }
})
