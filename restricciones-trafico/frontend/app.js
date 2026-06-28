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
const zoomInMapButton = document.querySelector('#zoom-in-map')
const zoomOutMapButton = document.querySelector('#zoom-out-map')
const mapDetail = document.querySelector('#map-detail')
const cargoType = document.querySelector('#cargo_type')
const adrWarning = document.querySelector('#adr-warning')
let map
let routeLayer
let alternativeLayer
let restrictionLayer
let lowConfidenceLayer
let highlightLayer
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


const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
function formatDistanceKm(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '— km'
  return `${Number(value).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
}
function formatDuration(minutes) {
  if (!Number.isFinite(Number(minutes))) return '—'
  const total = Math.round(Number(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  return h ? `${h} h ${m} min` : `${m} min`
}
function formatArrival(iso) {
  if (!iso) return 'Llegada: —'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Llegada: —'
  return `Llegada: ${WEEKDAYS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} a las ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function routeMetric(label, route) {
  return `<div class="metric"><span>${label}</span><strong>${formatDistanceKm(route.distance_km)}</strong><small>${formatDuration(route.eta_minutes)} · ${formatArrival(route.eta_at)}</small></div>`
}
function roadType(road = '') {
  const value = String(road).toUpperCase().trim()
  if (/^AP-/.test(value)) return 'autopista'
  if (/^A-/.test(value)) return 'autovía'
  if (/^N-/.test(value)) return 'nacional'
  return 'otras'
}

function setStatus(message, type = 'info') {
  statusBox.hidden = !message
  statusBox.textContent = message || ''
  statusBox.className = `status ${type}`
}

function ensureMap() {
  if (map) return map
  const container = document.querySelector('#map')
  container.style.width = '100%'
  map = L.map(container, { scrollWheelZoom: false, touchZoom: true, zoomControl: false, maxZoom: 19 }).setView([40.4, -3.7], 6)
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

function squaredDistance(a, b) {
  const dLat = Number(a?.[0]) - Number(b?.[0])
  const dLng = Number(a?.[1]) - Number(b?.[1])
  return dLat * dLat + dLng * dLng
}

function closestRouteIndex(point, routeLatLngs) {
  let bestIndex = 0
  let bestDistance = Infinity
  routeLatLngs.forEach((candidate, index) => {
    const distance = squaredDistance(point, candidate)
    if (distance < bestDistance) {
      bestDistance = distance
      bestIndex = index
    }
  })
  return bestIndex
}

function restrictionHasRealGeometry(item) {
  return item?.has_geometry === true && (item.restriction_geometry?.coordinates || []).length > 1
}

function restrictionSegmentOnRoute(item, routeLatLngs) {
  if (!routeLatLngs.length || !restrictionHasRealGeometry(item)) return []
  const restrictionCoords = item.restriction_geometry.coordinates
  const restrictionLatLngs = restrictionCoords.map(([lon, lat]) => [lat, lon])
  const indexes = restrictionLatLngs.map((point) => closestRouteIndex(point, routeLatLngs))
  const from = Math.max(0, Math.min(...indexes) - 1)
  const to = Math.min(routeLatLngs.length - 1, Math.max(...indexes) + 1)
  if (to > from) return routeLatLngs.slice(from, to + 1)
  return []
}

function showMapDetail(html) {
  mapDetail.innerHTML = html
  mapDetail.hidden = false
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
}

function segmentPopup(segment) {
  const restriction = (segment.restrictions || [])[0]
  const restrictionText = restriction ? `<br><strong>Restricción:</strong> ${escapeHtml(restriction.id || restriction.via || 'restricción')}` : ''
  return `<strong>${escapeHtml(segment.road || 'Vía')}</strong><br>${formatDistanceKm(segment.distance_km)} · ${escapeHtml(segment.type || roadType(segment.road))}${restrictionText}`
}

function highlightRoadSegment(segment) {
  const m = ensureMap()
  const coords = segment?.geometry?.coordinates || []
  if (highlightLayer) highlightLayer.remove()
  if (!coords.length) return
  const latlngs = coords.map(([lon, lat]) => [lat, lon])
  if (routeLayer) routeLayer.setStyle({ opacity: .2 })
  if (alternativeLayer) alternativeLayer.setStyle({ opacity: .2 })
  highlightLayer = L.polyline(latlngs, { color: '#facc15', weight: 11, opacity: 1, smoothFactor: 0, noClip: true, lineJoin: 'round', lineCap: 'round' }).addTo(m)
  const html = segmentPopup(segment)
  highlightLayer.bindPopup(html).openPopup()
  showMapDetail(html)
  refreshMapSize(highlightLayer.getBounds(), { maxZoom: 13 })
  document.getElementById('map')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function showCompleteRoute() {
  if (highlightLayer) {
    highlightLayer.remove()
    highlightLayer = null
  }
  if (routeLayer) routeLayer.setStyle({ opacity: .95 })
  if (alternativeLayer) alternativeLayer.setStyle({ opacity: .95 })
  mapDetail.hidden = true
  refreshMapSize(lastBounds)
  document.getElementById('map')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
  if (highlightLayer) highlightLayer.remove()
  highlightLayer = null
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
    const routeLatLngs = coords.map(([lon, lat]) => [lat, lon])
    if (!routeLatLngs.length) continue
    const segment = restrictionSegmentOnRoute(item, routeLatLngs)
    if (segment.length > 1) {
      bindDetail(L.polyline(segment, { color: item.confidence === 'baja' ? '#f59e0b' : '#ef4444', weight: 9, opacity: .95 }), `<strong>${item.via || 'Restricción'}</strong><br>${item.source_scope || ''}<br>${item.id}`).addTo(item.confidence === 'baja' ? lowConfidenceLayer : restrictionLayer)
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
    cards.push(routeMetric('Original', original))
  }
  if (alternative) {
    cards.push(routeMetric('Alternativa', alternative))
  }
  if (!cards.length && data.distance_km !== undefined) cards.push(routeMetric('Ruta clásica', data))
  if (data.alternative_status && data.alternative_status.found === false) cards.push(`<div class="metric"><span>Alternativas</span><strong>No he encontrado rutas alternativas</strong><small>${data.alternative_status.reason || 'Sin motivo detallado'}</small></div>`)
  if (data.summary) cards.push(`<div class="metric"><span>Vías</span><strong>${data.summary?.total_vias ?? '—'}</strong><small>Restricciones: ${data.summary?.total_restricciones ?? '—'}</small></div>`)
  routeSummary.innerHTML = cards.join('')
}


function renderConfidence(data) {
  const confidence = data.route_confidence || 'baja'
  confidenceCard.className = `card confidence-card confidence-${confidence}`
  confidenceText.textContent = confidence
  const unsafe = confidence !== 'alta' || data.summary?.no_declarar_via_libre
  confidenceWarning.textContent = unsafe
    ? 'Revisar manualmente.'
    : 'Vías detectadas.'
}

function roadCardTypeClass(type = '') {
  const normalized = String(type).toLowerCase()
  if (normalized.includes('autopista') || normalized.includes('autovia')) return 'road-type-blue'
  if (normalized.includes('nacional')) return 'road-type-red'
  if (normalized.includes('comarcal')) return 'road-type-orange'
  if (normalized.includes('local')) return 'road-type-gray'
  return 'road-type-green'
}

function roadSegmentButton(segment, fallbackRoad = '') {
  const button = document.createElement('button')
  button.type = 'button'
  const type = segment.type || roadType(segment.road || fallbackRoad)
  button.className = `road-segment ${segment.restricted ? 'road-segment-restricted-card' : roadCardTypeClass(type)}`
  const restriction = (segment.restrictions || [])[0]
  button.innerHTML = `
    <span class="road-segment-name">${escapeHtml(segment.road || fallbackRoad || 'Vía')}</span>
    <span class="road-segment-meta">${formatDistanceKm(segment.distance_km)} · ${escapeHtml(type)}</span>
    ${segment.restricted && restriction ? `<span class="road-segment-alert">TRAMO RESTRINGIDO · ${escapeHtml(restriction.id || restriction.via || 'afecta')}</span>` : ''}
  `
  if (segment.restricted) button.setAttribute('aria-label', `TRAMO RESTRINGIDO · ${restriction?.id || restriction?.via || segment.road || fallbackRoad || 'restricción'}`)
  if (segment.geometry?.coordinates?.length) button.addEventListener('click', () => highlightRoadSegment(segment))
  else button.disabled = true
  return button
}

function renderRoadGroup(title, segments, fallbackRoads = [], emptyText = 'Sin vías en esta categoría.') {
  const section = document.createElement('section')
  section.className = 'road-group'
  section.innerHTML = `<h3>${title}</h3>`
  const list = document.createElement('div')
  list.className = 'road-segment-list'
  if (segments.length) {
    for (const segment of segments) list.appendChild(roadSegmentButton(segment))
  } else if (fallbackRoads.length) {
    for (const road of fallbackRoads) list.appendChild(roadSegmentButton({ road, type: roadType(road), distance_km: null, geometry: null }))
  } else {
    list.innerHTML = `<p class="empty">${emptyText}</p>`
  }
  section.appendChild(list)
  return section
}

function renderRoads(roads = [], data = {}) {
  roadsList.innerHTML = ''
  const originalSegments = (data.road_segments?.original || []).filter((segment) => Number(segment.distance_km || 0) >= 1)
  const alternativeSegments = (data.road_segments?.alternative || []).filter((segment) => Number(segment.distance_km || 0) >= 1)
  const restrictedRoads = new Set((data.restricciones || data.crossed_restrictions || []).map((item) => item.via).filter(Boolean))
  const fallbackFreeRoads = originalSegments.length ? [] : roads.filter((road) => !restrictedRoads.has(road))
  const fallbackRestrictedRoads = originalSegments.length ? [] : roads.filter((road) => restrictedRoads.has(road))

  if (!roads.length && !originalSegments.length && !alternativeSegments.length) {
    roadsList.innerHTML = '<p class="empty">No se detectaron vías suficientes. Puede deberse a que el proveedor no devolvió nombres de vía o a fallo de enriquecimiento Overpass.</p>'
    return
  }
  if (originalSegments.length) {
    roadsList.appendChild(renderRoadGroup('Ruta original: origen → destino', originalSegments, [], 'No hay vías en la ruta original.'))
  } else {
    roadsList.appendChild(renderRoadGroup('Vías detectadas libres', [], fallbackFreeRoads, 'No hay vías libres identificadas.'))
    roadsList.appendChild(renderRoadGroup('Vías detectadas restringidas', [], fallbackRestrictedRoads, 'No hay vías restringidas confirmadas.'))
  }
  roadsList.appendChild(renderRoadGroup('Vías alternativas', alternativeSegments, data.alternative_route?.roads || [], 'No hay ruta alternativa calculada.'))
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

function renderRestrictions(items = [], data = {}) {
  restrictionsList.innerHTML = ''
  if (!items.length) {
    const crossedStatus = data.crossed_status
    if (crossedStatus && crossedStatus.checked === false) {
      restrictionsList.innerHTML = `<p class="empty">No se pudo comprobar el cruce real de restricciones: ${crossedStatus.reason || 'motivo no detallado'}.</p>`
    } else {
      const count = crossedStatus?.geometry_count ?? 'las'
      restrictionsList.innerHTML = `<p class="empty">Comprobado contra ${count} geometrías cargadas de restricciones: ningún tramo restringido cruzado en esa cobertura parcial y fecha/hora indicadas.</p>`
    }
    if ((data.warnings || []).some((w) => String(w).includes('ADR') || String(w).includes('Anexo'))) {
      const div = document.createElement('article')
      div.className = 'restriction-item'
      div.innerHTML = `<div class="restriction-head"><span class="road">Aviso ADR calendario</span><span class="badge">informativo</span></div><div class="meta">${(data.warnings || []).filter((w) => String(w).includes('ADR') || String(w).includes('Anexo')).join('<br>')}</div><div class="meta">Referencia: BOE-A-2026-1255, anexos ADR.</div>`
      restrictionsList.appendChild(div)
    }
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
      <div class="meta restriction-active">RESTRICCIÓN ACTIVA EN ESTE VIAJE</div>
      <div class="meta"><span class="meta-label">Tramo:</span> <span class="meta-value">pk ${item.pk?.start ?? '—'} a pk ${item.pk?.end ?? '—'} · ${item.tramo?.inicio || '—'} → ${item.tramo?.fin || '—'}</span></div>
      <div class="meta"><span class="meta-label">Días:</span> <span class="meta-value">${formatDateRule(item)} · ${formatDays(item.dias_afecta)}</span></div>
      <div class="meta"><span class="meta-label">Horario:</span> <span class="meta-value">${formatTimeWindows(item.franja_horaria)}</span></div>
      <div class="meta"><span class="meta-label">Fuente:</span> <span class="meta-value">${item.source_scope || '—'} · ${item.source_annex || '—'}</span></div>
      ${item.has_geometry === false ? `<div class="meta geometry-warning"><span class="meta-label">Geometría:</span> <span class="meta-value">${escapeHtml(item.geometry_warning || 'Tramo sin geometría precisa: no se pinta trazo estimado.')}</span></div>` : ''}
    `
    restrictionsList.appendChild(div)
  }
}

cargoType.addEventListener('change', () => { adrWarning.hidden = cargoType.value !== 'adr' })
centerMapButton.textContent = 'Ver ruta completa'
centerMapButton.addEventListener('click', () => showCompleteRoute())
zoomInMapButton.addEventListener('click', () => { if (map) map.zoomIn() })
zoomOutMapButton.addEventListener('click', () => { if (map) map.zoomOut() })

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
      fallbackWarning = `No he encontrado rutas alternativas: proveedor de rutas no disponible o error técnico (${altError.message}); usando ruta clásica.`
      const response = await fetch('/api/ruta/analizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.detail || data.error || `Error HTTP ${response.status}`)
    }
    const analysisResponse = await fetch('/api/ruta/analizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const analysisData = await analysisResponse.json().catch(() => ({}))
    if (!analysisResponse.ok) throw new Error(analysisData.detail || analysisData.error || `Error HTTP ${analysisResponse.status}`)
    data.restricciones = analysisData.restricciones || []
    data.road_segments = analysisData.road_segments || data.road_segments
    data.geometry = analysisData.geometry || data.geometry
    data.vias_detectadas = analysisData.vias_detectadas || data.vias_detectadas
    data.route_confidence = analysisData.route_confidence || data.route_confidence
    data.summary = analysisData.summary || data.summary
    results.hidden = false
    renderConfidence(data)
    renderRoads(data.vias_detectadas, data)
    renderRestrictions(data.restricciones, data)
    renderRouteSummary(data)
    drawMap(data)
    refreshMapSize()
    const warnings = [...(fallbackWarning ? [fallbackWarning] : []), ...(data.warnings || [])]
    setStatus(warnings.length ? `Avisos: ${warnings.slice(0, 3).map((w) => String(w).split(':')[0]).join(' · ')}` : '')
  } catch (error) {
    setStatus(`No se pudo analizar la ruta: ${error.message}`, 'error')
  } finally {
    button.disabled = false
  }
})
