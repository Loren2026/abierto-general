import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'
import '../pages/Dashboard.css'
import AdminLayout from '../components/layout/AdminLayout'

const initialAccessForm = { personName: '', notes: '', isTrial: false, trialDays: '' }
const initialProjectForm = { slug: '', name: '', description: '', sourceType: 'webapp', redirectUrl: '', sourceFileId: '', version: '1.0.0', updateMessage: '' }

function formatDate(value, fallback = 'No disponible') {
  if (!value) return fallback
  try { return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) } catch { return value }
}
async function readJson(response) { return response.json().catch(() => ({})) }
function getAccessTrialState(access) {
  if (!Number.isInteger(access?.trialDays) || access.trialDays <= 0) return { label: 'Normal', status: 'Sin caducidad' }
  if (!access.activatedAt) return { label: `Prueba: ${access.trialDays} días`, status: 'Sin activar' }
  const expiresAt = new Date(new Date(access.activatedAt).getTime() + access.trialDays * 86400000)
  return { label: `Prueba: ${access.trialDays} días`, status: Date.now() > expiresAt.getTime() ? 'Caducada' : `Activa desde ${formatDate(access.activatedAt)}` }
}
function splitDescription(description) {
  const text = description || 'Proyecto privado gestionado desde el panel de Inteligencia Loren.'
  return text.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 2).join(' ')
}

function AdminPage() {
  const { session, logout } = useAuthStore()
  const [projects, setProjects] = useState([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [projectsError, setProjectsError] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [expandedMetric, setExpandedMetric] = useState(null)
  const [expandedAccessId, setExpandedAccessId] = useState(null)
  const [projectAccesses, setProjectAccesses] = useState([])
  const [isLoadingAccesses, setIsLoadingAccesses] = useState(false)
  const [accessesError, setAccessesError] = useState('')
  const [isCreatingAccess, setIsCreatingAccess] = useState(false)
  const [accessForm, setAccessForm] = useState(initialAccessForm)
  const [accessActionMessage, setAccessActionMessage] = useState({ type: '', message: '' })
  const [revealedCodes, setRevealedCodes] = useState({})
  const [activeDevicesByAccessId, setActiveDevicesByAccessId] = useState({})
  const [projectForm, setProjectForm] = useState(initialProjectForm)
  const [createdProject, setCreatedProject] = useState(null)
  const [projectActionMessage, setProjectActionMessage] = useState({ type: '', message: '' })
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isPublishingProject, setIsPublishingProject] = useState(false)
  const [isCreatingProjectAccess, setIsCreatingProjectAccess] = useState(false)
  const [projectGeneratedCode, setProjectGeneratedCode] = useState('')
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false)
  const [editingAccesses, setEditingAccesses] = useState({})
  const [savingAccessId, setSavingAccessId] = useState(null)

  const handleLogout = async () => { await logout() }
  async function apiFetch(path, options = {}) {
    const headers = { Authorization: `Bearer ${session?.accessToken}`, ...(options.headers || {}) }
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
    const response = await fetch(path, { ...options, headers })
    const data = await readJson(response)
    if (!response.ok) throw new Error(data.error || 'Error en administración')
    return data
  }
  async function loadProjects() {
    if (!session?.accessToken) { setProjects([]); setIsLoadingProjects(false); return }
    setIsLoadingProjects(true); setProjectsError('')
    try { const data = await apiFetch('/api/admin/projects'); setProjects(data.projects || []) } catch (e) { setProjectsError(e.message) } finally { setIsLoadingProjects(false) }
  }
  async function loadProjectAccesses(projectId) {
    if (!projectId || !session?.accessToken) { setProjectAccesses([]); setAccessesError(''); setIsLoadingAccesses(false); return }
    setIsLoadingAccesses(true); setAccessesError(''); setActiveDevicesByAccessId({})
    try {
      const data = await apiFetch(`/api/admin/projects/${projectId}/accesses`)
      const accesses = data.accesses || []
      setProjectAccesses(accesses)
      setEditingAccesses(Object.fromEntries(accesses.map((a) => [a.id, { maxDevices: String(a.maxDevices || 1), status: a.status || 'active', trialDays: a.trialDays ? String(a.trialDays) : '' }])))
      const deviceResults = await Promise.all(accesses.map(async (access) => { try { const d = await apiFetch(`/api/admin/accesses/${access.id}/device`); return [access.id, d.device] } catch { return [access.id, null] } }))
      setActiveDevicesByAccessId(Object.fromEntries(deviceResults))
    } catch (e) { setAccessesError(e.message) } finally { setIsLoadingAccesses(false) }
  }
  useEffect(() => { loadProjects() }, [session?.accessToken])
  useEffect(() => { loadProjectAccesses(selectedProjectId) }, [selectedProjectId, session?.accessToken])

  const projectBuckets = useMemo(() => ({
    total: projects,
    public: projects.filter((p) => p.status === 'public'),
    private: projects.filter((p) => p.status !== 'public'),
    published: projects.filter((p) => p.published_at),
  }), [projects])
  const metricCards = [
    ['total', 'Proyectos totales'], ['public', 'Proyectos públicos'], ['private', 'Proyectos privados'], ['published', 'Publicados'],
  ]
  const selectedProject = useMemo(() => projects.find((p) => p.id === selectedProjectId) || null, [projects, selectedProjectId])
  const expandedMetricLabel = metricCards.find(([key]) => key === expandedMetric)?.[1] || 'Proyectos'
  const expandedMetricProjects = expandedMetric ? projectBuckets[expandedMetric] || [] : []

  function updateAccessForm(field, value) { setAccessForm((c) => ({ ...c, [field]: value })) }
  function updateProjectForm(field, value) { setProjectForm((c) => ({ ...c, [field]: value })) }
  async function handleCreateProject(event) {
    event?.preventDefault(); setIsCreatingProject(true); setProjectActionMessage({ type: '', message: '' }); setProjectGeneratedCode('')
    try {
      const payload = { slug: projectForm.slug, name: projectForm.name, description: projectForm.description || undefined, sourceType: projectForm.sourceType, redirectUrl: projectForm.redirectUrl || undefined, sourceFileId: projectForm.sourceFileId || undefined, version: projectForm.version || undefined, updateMessage: projectForm.updateMessage || undefined }
      const data = await apiFetch('/api/admin/projects', { method: 'POST', body: JSON.stringify(payload) })
      setCreatedProject(data.project); setSelectedProjectId(data.project.id); setProjectActionMessage({ type: 'success', message: `Proyecto creado: ${data.project.name}.` }); setProjectForm(initialProjectForm); await loadProjects()
    } catch (e) { setProjectActionMessage({ type: 'error', message: e.message }) } finally { setIsCreatingProject(false) }
  }
  async function handlePublishCreatedProject() { if (!createdProject?.id) return; setIsPublishingProject(true); try { const data = await apiFetch(`/api/admin/projects/${createdProject.id}/publish`, { method: 'POST', body: JSON.stringify({}) }); setCreatedProject(data.project); await loadProjects() } finally { setIsPublishingProject(false) } }
  async function handleCreateAccessForCreatedProject() { if (!createdProject?.id) return; setIsCreatingProjectAccess(true); try { const data = await apiFetch(`/api/admin/projects/${createdProject.id}/accesses`, { method: 'POST', body: JSON.stringify({ personName: `${createdProject.name} prueba`, notes: `Código de prueba para ${createdProject.slug}` }) }); setProjectGeneratedCode(data.generatedPassword); setRevealedCodes((c) => ({ ...c, [data.access.id]: data.generatedPassword })); setSelectedProjectId(createdProject.id); await loadProjectAccesses(createdProject.id) } finally { setIsCreatingProjectAccess(false) } }
  async function handleCreateAccess(event) {
    event?.preventDefault(); if (!selectedProjectId) return
    if (accessForm.isTrial) { const days = Number(accessForm.trialDays); if (!Number.isInteger(days) || days <= 0) { setAccessActionMessage({ type: 'error', message: 'Los días de prueba deben ser un entero positivo.' }); return } }
    setIsCreatingAccess(true); setAccessActionMessage({ type: '', message: '' })
    try { const data = await apiFetch(`/api/admin/projects/${selectedProjectId}/accesses`, { method: 'POST', body: JSON.stringify({ personName: accessForm.personName, notes: accessForm.notes, trialDays: accessForm.isTrial ? Number(accessForm.trialDays) : null }) }); setRevealedCodes((c) => ({ ...c, [data.access.id]: data.generatedPassword })); setAccessActionMessage({ type: 'success', message: `Código creado para ${data.access.personName}.` }); setAccessForm(initialAccessForm); await loadProjectAccesses(selectedProjectId) } catch (e) { setAccessActionMessage({ type: 'error', message: e.message }) } finally { setIsCreatingAccess(false) }
  }
  async function saveAccess(access) {
    const edit = editingAccesses[access.id]; if (!edit) return
    setSavingAccessId(access.id); setAccessActionMessage({ type: '', message: '' })
    try {
      const data = await apiFetch(`/api/admin/accesses/${access.id}/update`, { method: 'POST', body: JSON.stringify({ maxDevices: Number(edit.maxDevices), status: edit.status, trialDays: edit.trialDays === '' ? null : Number(edit.trialDays) }) })
      setProjectAccesses((items) => items.map((item) => (item.id === access.id ? data.access : item)))
      setAccessActionMessage({ type: 'success', message: `Código actualizado para ${data.access.personName}.` })
    } catch (e) { setAccessActionMessage({ type: 'error', message: e.message }) } finally { setSavingAccessId(null) }
  }
  function updateEditingAccess(id, field, value) { setEditingAccesses((c) => ({ ...c, [id]: { ...(c[id] || {}), [field]: value } })) }
  async function copyCode(id) { const code = revealedCodes[id]; if (code) await navigator.clipboard.writeText(code) }

  return (
    <AdminLayout title="Panel Loren" onLogout={handleLogout}>
      <div className="dashboard-container"><div className="dashboard-content">
        <div className="info-card"><h2>Workspace</h2><p className="coordination-panel-copy" style={{ marginBottom: 16 }}>Espacio interno para chat, documentos, habilidades, proyectos y seguimiento operativo.</p><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><Link className="cta-admin-button cta-admin-button--blue" to="/admin/workspace">Abrir workspace</Link><Link className="cta-admin-button cta-admin-button--green" to="/admin/agentes">Canal de coordinación actual</Link><Link className="cta-admin-button cta-admin-button--orange" to="/admin/invitaciones">Bandeja de invitaciones</Link></div></div>
        {projectsError ? <div className="error-message">{projectsError}</div> : null}

        <div className="next-steps-card"><button type="button" className="panel-header-row admin-accordion-toggle" onClick={() => setIsCreateProjectOpen((v) => !v)} aria-expanded={isCreateProjectOpen}><h2>Crear nuevo proyecto</h2><span className="panel-header-pill">{isCreateProjectOpen ? 'Cerrar' : 'Abrir'}</span></button>{isCreateProjectOpen ? <><p className="coordination-panel-copy" style={{ marginBottom: 16 }}>Alta reutilizable para descargas OneDrive y webapps públicas con código de invitación.</p><form className="admin-project-form" onSubmit={handleCreateProject}><label><span>Slug</span><input type="text" value={projectForm.slug} onChange={(e) => updateProjectForm('slug', e.target.value)} placeholder="restricciones-trafico" required /></label><label><span>Nombre</span><input type="text" value={projectForm.name} onChange={(e) => updateProjectForm('name', e.target.value)} placeholder="Restricciones Tráfico" required /></label><label className="admin-project-form__wide"><span>Descripción</span><textarea value={projectForm.description} onChange={(e) => updateProjectForm('description', e.target.value)} rows={3} /></label><label><span>Tipo de origen</span><select value={projectForm.sourceType} onChange={(e) => updateProjectForm('sourceType', e.target.value)}><option value="webapp">webapp</option><option value="onedrive">onedrive</option></select></label><label><span>Redirect URL</span><input type="url" value={projectForm.redirectUrl} onChange={(e) => updateProjectForm('redirectUrl', e.target.value)} required={projectForm.sourceType === 'webapp'} /></label><label><span>Source File ID</span><input type="text" value={projectForm.sourceFileId} onChange={(e) => updateProjectForm('sourceFileId', e.target.value)} disabled={projectForm.sourceType !== 'onedrive'} required={projectForm.sourceType === 'onedrive'} /></label><label><span>Versión</span><input type="text" value={projectForm.version} onChange={(e) => updateProjectForm('version', e.target.value)} /></label><label className="admin-project-form__wide"><span>Mensaje de actualización</span><input type="text" value={projectForm.updateMessage} onChange={(e) => updateProjectForm('updateMessage', e.target.value)} /></label><button className="cta-admin-button cta-admin-button--blue" disabled={isCreatingProject}>{isCreatingProject ? 'Creando…' : 'Crear proyecto'}</button></form></> : null}{projectActionMessage.message ? <div className={`admin-notice admin-notice--${projectActionMessage.type || 'info'}`}>{projectActionMessage.message}</div> : null}{createdProject ? <div className="created-project-panel"><div className="access-meta-table"><div className="access-meta-row"><div className="access-meta-label">Project ID</div><div className="access-meta-value">{createdProject.id}</div></div><div className="access-meta-row"><div className="access-meta-label">Slug</div><div className="access-meta-value">{createdProject.slug}</div></div></div><div className="access-actions"><button className="cta-admin-button cta-admin-button--green" type="button" onClick={handlePublishCreatedProject} disabled={isPublishingProject || createdProject.status === 'public'}>Publicar</button><button className="cta-admin-button cta-admin-button--orange" type="button" onClick={handleCreateAccessForCreatedProject} disabled={isCreatingProjectAccess}>Generar código de acceso</button></div>{projectGeneratedCode ? <div className="code-reveal-card"><code>{projectGeneratedCode}</code></div> : null}</div> : null}</div>

        <section className="admin-projects-section">
          <div className="content-card content-card--wide admin-section-label-card">
            <span className="content-card__eyebrow">Panel admin</span>
            <h2>Proyectos</h2>
          </div>
          <div className="stats-grid stats-grid--drilldown">{metricCards.map(([key, label]) => (
            <div className="stat-drilldown" key={key}>
              <button type="button" className={`stat-card stat-card--button ${expandedMetric === key ? 'project-card--active' : ''}`} onClick={() => { setExpandedMetric(expandedMetric === key ? null : key); setSelectedProjectId(null) }}>
                <div className="stat-value">{isLoadingProjects ? '…' : projectBuckets[key].length}</div><div className="stat-label">{label}</div>
              </button>
              {expandedMetric === key ? <div className="next-steps-card stat-drilldown__panel"><h2>{label}</h2>{projectBuckets[key].length === 0 ? <div className="steps-message">Sin proyectos en esta categoría.</div> : <div className="project-list">{projectBuckets[key].map((project) => <button key={project.id} type="button" className={`project-card ${selectedProjectId === project.id ? 'project-card--active' : ''}`} onClick={() => setSelectedProjectId(selectedProjectId === project.id ? null : project.id)}><strong>{project.name}</strong></button>)}</div>}</div> : null}
            </div>
          ))}</div>
          {expandedMetric ? <p className="coordination-muted admin-drilldown-summary">{expandedMetricLabel}: {expandedMetricProjects.length} proyecto{expandedMetricProjects.length === 1 ? '' : 's'}.</p> : null}
        </section>

        {selectedProject ? <div className="next-steps-card admin-project-detail-card"><div className="panel-header-row"><h2>{selectedProject.name}</h2><span className="panel-header-pill">Ficha</span></div><p>{splitDescription(selectedProject.description)}</p><div className="access-meta-table"><div className="access-meta-row"><div className="access-meta-label">Creación</div><div className="access-meta-value">{formatDate(selectedProject.created_at)}</div></div><div className="access-meta-row"><div className="access-meta-label">Publicación</div><div className="access-meta-value">{formatDate(selectedProject.published_at, 'No publicado')}</div></div><div className="access-meta-row"><div className="access-meta-label">Personas con acceso</div><div className="access-meta-value">{projectAccesses.filter((a) => a.status !== 'revoked').length}</div></div></div>
          <h3>Códigos del proyecto</h3><form className="admin-inline-form" onSubmit={handleCreateAccess}><label><span>Nombre de la persona</span><input type="text" value={accessForm.personName} onChange={(e) => updateAccessForm('personName', e.target.value)} required /></label><label><span>Notas</span><input type="text" value={accessForm.notes} onChange={(e) => updateAccessForm('notes', e.target.value)} /></label><label><span>Código de prueba temporal</span><select value={accessForm.isTrial ? 'yes' : 'no'} onChange={(e) => updateAccessForm('isTrial', e.target.value === 'yes')}><option value="no">No, código normal</option><option value="yes">Sí, prueba temporal</option></select></label><label><span>Días de prueba</span><input type="number" min="1" value={accessForm.trialDays} onChange={(e) => updateAccessForm('trialDays', e.target.value)} disabled={!accessForm.isTrial} required={accessForm.isTrial} /></label><button className="cta-admin-button cta-admin-button--green" disabled={isCreatingAccess}>{isCreatingAccess ? 'Creando…' : 'Generar código'}</button></form>{accessActionMessage.message ? <div className={`admin-notice admin-notice--${accessActionMessage.type || 'info'}`}>{accessActionMessage.message}</div> : null}{accessesError ? <div className="error-message">{accessesError}</div> : null}{isLoadingAccesses ? <div className="steps-message">Cargando accesos…</div> : projectAccesses.length === 0 ? <div className="steps-message">Este proyecto no tiene códigos registrados todavía.</div> : <div className="access-list">{projectAccesses.map((access) => { const device = activeDevicesByAccessId[access.id]; const trial = getAccessTrialState(access); const edit = editingAccesses[access.id] || {}; return <div key={access.id} className="access-card access-card--detailed"><button type="button" className="access-card__header admin-accordion-toggle" onClick={() => setExpandedAccessId(expandedAccessId === access.id ? null : access.id)}><strong>{access.personName}</strong><span>{access.status === 'revoked' ? 'Revocado' : 'Activo'}</span></button>{expandedAccessId === access.id ? <div className="access-stack-layout"><div className="access-meta-table"><div className="access-meta-row"><div className="access-meta-label">Persona</div><div className="access-meta-value">{access.personName}</div></div><div className="access-meta-row"><div className="access-meta-label">Estado</div><div className="access-meta-value">{access.status}</div></div><div className="access-meta-row"><div className="access-meta-label">Dispositivos</div><div className="access-meta-value">{device ? `${device.deviceName} · ${device.platform || 'sin plataforma'}` : 'Sin dispositivo vinculado'}</div></div><div className="access-meta-row"><div className="access-meta-label">Fechas</div><div className="access-meta-value">Creado: {formatDate(access.createdAt)} · Activado: {formatDate(access.activatedAt, 'No activado')} · Revocado: {formatDate(access.revokedAt, 'No')}</div></div><div className="access-meta-row"><div className="access-meta-label">Trial</div><div className="access-meta-value">{trial.label} · {trial.status}</div></div><div className="access-meta-row"><div className="access-meta-label">Notas</div><div className="access-meta-value">{access.notes || 'Sin notas'}</div></div></div><div className="admin-inline-form"><label><span>max_devices</span><input type="number" min="1" value={edit.maxDevices || ''} onChange={(e) => updateEditingAccess(access.id, 'maxDevices', e.target.value)} /></label><label><span>status</span><select value={edit.status || 'active'} onChange={(e) => updateEditingAccess(access.id, 'status', e.target.value)}><option value="active">active</option><option value="revoked">revoked</option></select></label><label><span>trial_days</span><input type="number" min="1" value={edit.trialDays || ''} onChange={(e) => updateEditingAccess(access.id, 'trialDays', e.target.value)} placeholder="Vacío = sin trial" /></label><button type="button" className="cta-admin-button cta-admin-button--blue" onClick={() => saveAccess(access)} disabled={savingAccessId === access.id}>{savingAccessId === access.id ? 'Guardando…' : 'Guardar cambios'}</button>{revealedCodes[access.id] ? <button type="button" className="cta-admin-button cta-admin-button--orange" onClick={() => copyCode(access.id)}>Copiar código</button> : null}</div></div> : null}</div> })}</div>}</div> : null}
      </div></div>
    </AdminLayout>
  )
}
export default AdminPage
