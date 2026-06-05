import { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../components/layout/AdminLayout'
import useAuthStore from '../store/useAuthStore'
import { adminApiFetch } from '../services/adminApi'
import '../pages/Dashboard.css'

const statusLabels = {
  requested: 'Solicitada',
  reviewing: 'En revisión',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  code_generated: 'Código generado',
  code_sent: 'Código enviado',
  cancelled: 'Cancelada',
}

function formatDate(value, fallback = '—') {
  if (!value) return fallback
  try {
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch (error) {
    return value
  }
}

function buildQuery(filters) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const query = params.toString()
  return query ? `?${query}` : ''
}

export default function InvitationInboxPage() {
  const { session, logout } = useAuthStore()
  const [projects, setProjects] = useState([])
  const [items, setItems] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [filters, setFilters] = useState({ projectId: '', status: '', dateFrom: '', dateTo: '' })
  const [isLoading, setIsLoading] = useState(true)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [revealedCodes, setRevealedCodes] = useState({})

  async function apiFetch(path, options) {
    return adminApiFetch(session, path, options)
  }

  async function loadProjects() {
    const data = await apiFetch('/api/admin/projects')
    setProjects(data.projects || [])
  }

  async function loadLifecycle() {
    setIsLoading(true)
    setMessage({ type: '', text: '' })
    try {
      const data = await apiFetch(`/api/admin/invitation-lifecycle${buildQuery(filters)}`)
      setItems(data.items || [])
      setSelectedItem((current) => {
        if (!current) return (data.items || [])[0] || null
        return (data.items || []).find((item) => item.accessRequest.id === current.accessRequest.id) || (data.items || [])[0] || null
      })
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!session?.accessToken) return
    loadProjects().catch((error) => setMessage({ type: 'error', text: error.message }))
  }, [session?.accessToken])

  useEffect(() => {
    if (!session?.accessToken) return
    loadLifecycle()
  }, [session?.accessToken, filters.projectId, filters.status, filters.dateFrom, filters.dateTo])

  const metrics = useMemo(() => ({
    total: items.length,
    pending: items.filter((item) => ['requested', 'reviewing'].includes(item.accessRequest.status)).length,
    generated: items.filter((item) => item.access).length,
    revoked: items.filter((item) => item.access?.status === 'revoked').length,
  }), [items])

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  async function runAction(label, action) {
    setMessage({ type: '', text: '' })
    try {
      const result = await action()
      setMessage({ type: 'success', text: label })
      if (result?.generatedPassword && result?.access?.id) {
        setRevealedCodes((current) => ({ ...current, [result.access.id]: result.generatedPassword }))
      }
      await loadLifecycle()
    } catch (error) {
      setMessage({ type: 'error', text: error.message })
    }
  }

  function requireReason(promptText) {
    return window.prompt(promptText)?.trim() || ''
  }

  const currentCode = selectedItem?.access?.id ? revealedCodes[selectedItem.access.id] : null

  return (
    <AdminLayout title="Bandeja de invitaciones" onLogout={logout}>
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="security-banner">
            <div className="security-icon">📨</div>
            <div className="security-text">
              <h3>Bandeja / historial de invitaciones</h3>
              <p>Solicitudes, códigos, dispositivos, descargas y revocaciones en una vista multi-proyecto.</p>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card"><div className="stat-value">{metrics.total}</div><div className="stat-label">Solicitudes</div></div>
            <div className="stat-card"><div className="stat-value">{metrics.pending}</div><div className="stat-label">Pendientes</div></div>
            <div className="stat-card"><div className="stat-value">{metrics.generated}</div><div className="stat-label">Con código</div></div>
            <div className="stat-card"><div className="stat-value">{metrics.revoked}</div><div className="stat-label">Revocadas</div></div>
          </div>

          <div className="next-steps-card">
            <div className="panel-header-row"><h2>Filtros</h2></div>
            <form className="admin-inline-form">
              <label><span>Proyecto</span><select value={filters.projectId} onChange={(event) => updateFilter('projectId', event.target.value)}><option value="">Todos</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
              <label><span>Estado</span><select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">Todos</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Desde</span><input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} /></label>
              <label><span>Hasta</span><input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} /></label>
            </form>
          </div>

          {message.text ? <div className={`admin-notice admin-notice--${message.type || 'info'}`}>{message.text}</div> : null}

          <div className="next-steps-card">
            <div className="panel-header-row"><h2>Solicitudes entrantes</h2><button className="cta-admin-button cta-admin-button--blue" type="button" onClick={loadLifecycle}>Actualizar</button></div>
            {isLoading ? <div className="steps-message">Cargando bandeja…</div> : items.length === 0 ? <div className="steps-message">No hay solicitudes con estos filtros.</div> : (
              <div className="project-list">
                {items.map((item) => (
                  <button key={item.accessRequest.id} className={`project-card ${selectedItem?.accessRequest.id === item.accessRequest.id ? 'project-card--active' : ''}`} type="button" onClick={() => setSelectedItem(item)}>
                    <div className="project-card__header"><strong>{item.accessRequest.fullName}</strong><span className={`project-status project-status--${item.accessRequest.status}`}>{statusLabels[item.accessRequest.status] || item.accessRequest.status}</span></div>
                    <div className="project-card__meta">Proyecto: {item.accessRequest.project?.name || item.accessRequest.projectId}</div>
                    <div className="project-card__meta">Email: {item.accessRequest.email}</div>
                    <div className="project-card__meta">Fecha: {formatDate(item.accessRequest.createdAt)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedItem ? (
            <div className="next-steps-card">
              <div className="panel-header-row"><h2>Detalle y ciclo de vida</h2><span className="panel-header-pill">{selectedItem.accessRequest.project?.slug}</span></div>
              <div className="access-meta-table">
                <div className="access-meta-row"><div className="access-meta-label">Persona</div><div className="access-meta-value">{selectedItem.accessRequest.fullName}</div></div>
                <div className="access-meta-row"><div className="access-meta-label">Email</div><div className="access-meta-value">{selectedItem.accessRequest.email}</div></div>
                <div className="access-meta-row"><div className="access-meta-label">Teléfono</div><div className="access-meta-value">{selectedItem.accessRequest.phone || '—'}</div></div>
                <div className="access-meta-row"><div className="access-meta-label">Mensaje</div><div className="access-meta-value">{selectedItem.accessRequest.message || '—'}</div></div>
                <div className="access-meta-row"><div className="access-meta-label">Código</div><div className="access-meta-value">{selectedItem.access ? `${selectedItem.access.status} · ${selectedItem.access.id}` : 'Sin generar'}</div></div>
              </div>

              {currentCode ? <div className="code-reveal-card"><span className="code-reveal-card__label">Código visible una sola vez</span><code>{currentCode}</code></div> : null}

              <div className="access-actions">
                <button className="cta-admin-button cta-admin-button--blue" type="button" onClick={() => runAction('Solicitud aprobada.', () => apiFetch(`/api/admin/access-requests/${selectedItem.accessRequest.id}/approve`, { method: 'POST', body: JSON.stringify({}) }))}>Aprobar</button>
                <button className="cta-admin-button cta-admin-button--green" type="button" onClick={() => runAction('Código generado.', () => apiFetch(`/api/admin/access-requests/${selectedItem.accessRequest.id}/generate-access`, { method: 'POST', body: JSON.stringify({}) }))} disabled={Boolean(selectedItem.access)}>Generar código</button>
                <button className="cta-admin-button cta-admin-button--orange" type="button" onClick={() => runAction('Código marcado como enviado.', () => apiFetch(`/api/admin/access-requests/${selectedItem.accessRequest.id}/mark-sent`, { method: 'POST', body: JSON.stringify({}) }))} disabled={!selectedItem.access}>Marcar enviado</button>
                <button className="cta-admin-button cta-admin-button--red" type="button" onClick={() => { const reason = requireReason('Motivo del rechazo'); if (reason) runAction('Solicitud rechazada.', () => apiFetch(`/api/admin/access-requests/${selectedItem.accessRequest.id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) })) }}>Rechazar</button>
                <button className="cta-admin-button cta-admin-button--red" type="button" onClick={() => { const reason = requireReason('Motivo obligatorio de revocación'); if (reason) runAction('Acceso revocado.', () => apiFetch(`/api/admin/access-requests/${selectedItem.accessRequest.id}/revoke-access`, { method: 'POST', body: JSON.stringify({ reason }) })) }} disabled={!selectedItem.access || selectedItem.access.status === 'revoked'}>Revocar</button>
              </div>

              <div className="access-list">
                {(selectedItem.timeline || []).map((event, index) => (
                  <div className="access-card" key={`${event.type}-${event.at}-${index}`}>
                    <div className="access-card__header"><strong>{event.label}</strong><span>{formatDate(event.at)}</span></div>
                    {event.notes ? <div className="project-card__meta">Motivo/notas: {event.notes}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </AdminLayout>
  )
}
