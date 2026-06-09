import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'
import '../pages/Dashboard.css'
import AdminLayout from '../components/layout/AdminLayout'

const initialAccessForm = {
  personName: '',
  notes: '',
  isTrial: false,
  trialDays: '',
}

const initialProjectForm = {
  slug: '',
  name: '',
  description: '',
  sourceType: 'webapp',
  redirectUrl: '',
  sourceFileId: '',
  version: '1.0.0',
  updateMessage: '',
}

function formatDate(value, fallback = 'No disponible') {
  if (!value) return fallback

  try {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch (error) {
    return value
  }
}

async function readJson(response) {
  return response.json().catch(() => ({}))
}

function getAccessTrialState(access) {
  if (!Number.isInteger(access?.trialDays) || access.trialDays <= 0) {
    return { type: 'normal', label: 'Normal', status: 'Sin caducidad' }
  }

  if (!access.activatedAt) {
    return { type: 'trial', label: `Prueba: ${access.trialDays} días`, status: 'Sin activar' }
  }

  const activatedAt = new Date(access.activatedAt)
  const expiresAt = new Date(activatedAt.getTime() + access.trialDays * 24 * 60 * 60 * 1000)
  const isExpired = Date.now() > expiresAt.getTime()

  return {
    type: 'trial',
    label: `Prueba: ${access.trialDays} días`,
    status: isExpired ? 'Caducada' : `Activa desde ${formatDate(access.activatedAt, 'fecha no disponible')}`,
  }
}

function AdminPage() {
  const { user, session, logout } = useAuthStore()
  const [projects, setProjects] = useState([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [projectsError, setProjectsError] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(null)
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

  const handleLogout = async () => {
    await logout()
  }

  async function apiFetch(path, options = {}) {
    const headers = {
      Authorization: `Bearer ${session?.accessToken}`,
      ...(options.headers || {}),
    }

    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(path, {
      ...options,
      headers,
    })

    const data = await readJson(response)
    if (!response.ok) {
      throw new Error(data.error || 'Error en administración')
    }

    return data
  }

  async function loadProjects() {
    if (!session?.accessToken) {
      setProjects([])
      setIsLoadingProjects(false)
      return
    }

    setIsLoadingProjects(true)
    setProjectsError('')

    try {
      const data = await apiFetch('/api/admin/projects')
      setProjects(data.projects || [])
    } catch (error) {
      setProjectsError(error.message)
    } finally {
      setIsLoadingProjects(false)
    }
  }

  async function loadProjectAccesses(projectId) {
    if (!projectId || !session?.accessToken) {
      setProjectAccesses([])
      setAccessesError('')
      setIsLoadingAccesses(false)
      return
    }

    setIsLoadingAccesses(true)
    setAccessesError('')
    setActiveDevicesByAccessId({})

    try {
      const data = await apiFetch(`/api/admin/projects/${projectId}/accesses`)
      const accesses = data.accesses || []
      setProjectAccesses(accesses)

      const deviceResults = await Promise.all(
        accesses.map(async (access) => {
          try {
            const deviceData = await apiFetch(`/api/admin/accesses/${access.id}/device`)
            return [access.id, deviceData.device]
          } catch (error) {
            return [access.id, null]
          }
        }),
      )

      setActiveDevicesByAccessId(Object.fromEntries(deviceResults))
    } catch (error) {
      setAccessesError(error.message)
    } finally {
      setIsLoadingAccesses(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [session?.accessToken])

  useEffect(() => {
    loadProjectAccesses(selectedProjectId)
  }, [selectedProjectId, session?.accessToken])

  const metrics = useMemo(() => {
    const total = projects.length
    const publicCount = projects.filter((project) => project.status === 'public').length
    const privateCount = projects.filter((project) => project.status !== 'public').length
    const publishedCount = projects.filter((project) => project.published_at).length

    return { total, publicCount, privateCount, publishedCount }
  }, [projects])

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  )

  function updateAccessForm(field, value) {
    setAccessForm((current) => ({ ...current, [field]: value }))
  }

  function updateProjectForm(field, value) {
    setProjectForm((current) => ({ ...current, [field]: value }))
  }

  async function handleCreateProject(event) {
    event?.preventDefault()
    setIsCreatingProject(true)
    setProjectActionMessage({ type: '', message: '' })
    setProjectGeneratedCode('')

    try {
      const payload = {
        slug: projectForm.slug,
        name: projectForm.name,
        description: projectForm.description || undefined,
        sourceType: projectForm.sourceType,
        redirectUrl: projectForm.redirectUrl || undefined,
        sourceFileId: projectForm.sourceFileId || undefined,
        version: projectForm.version || undefined,
        updateMessage: projectForm.updateMessage || undefined,
      }
      const data = await apiFetch('/api/admin/projects', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setCreatedProject(data.project)
      setSelectedProjectId(data.project.id)
      setProjectActionMessage({ type: 'success', message: `Proyecto creado: ${data.project.name}.` })
      setProjectForm(initialProjectForm)
      await loadProjects()
    } catch (error) {
      setProjectActionMessage({ type: 'error', message: error.message })
    } finally {
      setIsCreatingProject(false)
    }
  }

  async function handlePublishCreatedProject() {
    if (!createdProject?.id) return
    setIsPublishingProject(true)
    setProjectActionMessage({ type: '', message: '' })
    try {
      const data = await apiFetch(`/api/admin/projects/${createdProject.id}/publish`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      setCreatedProject(data.project)
      setProjectActionMessage({ type: 'success', message: `Proyecto publicado: ${data.project.name}.` })
      await loadProjects()
    } catch (error) {
      setProjectActionMessage({ type: 'error', message: error.message })
    } finally {
      setIsPublishingProject(false)
    }
  }

  async function handleCreateAccessForCreatedProject() {
    if (!createdProject?.id) return
    setIsCreatingProjectAccess(true)
    setProjectActionMessage({ type: '', message: '' })
    try {
      const data = await apiFetch(`/api/admin/projects/${createdProject.id}/accesses`, {
        method: 'POST',
        body: JSON.stringify({
          personName: `${createdProject.name} prueba`,
          notes: `Código de prueba para ${createdProject.slug}`,
        }),
      })
      setProjectGeneratedCode(data.generatedPassword)
      setProjectActionMessage({ type: 'success', message: `Código generado para ${createdProject.name}.` })
      setRevealedCodes((current) => ({ ...current, [data.access.id]: data.generatedPassword }))
      setSelectedProjectId(createdProject.id)
      await loadProjectAccesses(createdProject.id)
    } catch (error) {
      setProjectActionMessage({ type: 'error', message: error.message })
    } finally {
      setIsCreatingProjectAccess(false)
    }
  }

  async function handleCreateAccess(event) {
    event?.preventDefault()

    if (!selectedProjectId) return

    if (accessForm.isTrial) {
      const trialDays = Number(accessForm.trialDays)
      if (!Number.isInteger(trialDays) || trialDays <= 0) {
        setAccessActionMessage({ type: 'error', message: 'Los días de prueba deben ser un entero positivo.' })
        return
      }
    }

    setIsCreatingAccess(true)
    setAccessActionMessage({ type: '', message: '' })

    try {
      const data = await apiFetch(`/api/admin/projects/${selectedProjectId}/accesses`, {
        method: 'POST',
        body: JSON.stringify({
          personName: accessForm.personName,
          notes: accessForm.notes,
          trialDays: accessForm.isTrial ? Number(accessForm.trialDays) : null,
        }),
      })

      setRevealedCodes((current) => ({
        ...current,
        [data.access.id]: data.generatedPassword,
      }))
      setAccessActionMessage({ type: 'success', message: `Código creado para ${data.access.personName}.` })
      setAccessForm(initialAccessForm)
      await loadProjectAccesses(selectedProjectId)
    } catch (error) {
      setAccessActionMessage({ type: 'error', message: error.message })
    } finally {
      setIsCreatingAccess(false)
    }
  }

  async function copyCode(accessId) {
    const code = revealedCodes[accessId]
    if (!code) return

    try {
      await navigator.clipboard.writeText(code)
      setAccessActionMessage({ type: 'success', message: 'Código copiado al portapapeles.' })
    } catch (error) {
      setAccessActionMessage({ type: 'error', message: 'No se pudo copiar el código automáticamente.' })
    }
  }

  async function handleRegenerateAccess(access) {
    setAccessActionMessage({ type: '', message: '' })

    try {
      const data = await apiFetch(`/api/admin/accesses/${access.id}/regenerate-password`, {
        method: 'POST',
        body: JSON.stringify({}),
      })

      setRevealedCodes((current) => ({
        ...current,
        [access.id]: data.generatedPassword,
      }))
      setProjectAccesses((current) => current.map((item) => (item.id === access.id ? data.access : item)))
      setAccessActionMessage({ type: 'success', message: `Código regenerado para ${access.personName}.` })
    } catch (error) {
      setAccessActionMessage({ type: 'error', message: error.message })
    }
  }

  async function handleRevokeAccess(access) {
    setAccessActionMessage({ type: '', message: '' })

    try {
      const data = await apiFetch(`/api/admin/accesses/${access.id}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ notes: access.notes || null }),
      })

      setProjectAccesses((current) => current.map((item) => (item.id === access.id ? data.access : item)))
      setActiveDevicesByAccessId((current) => ({ ...current, [access.id]: null }))
      setAccessActionMessage({ type: 'success', message: `Código revocado para ${access.personName}.` })
    } catch (error) {
      setAccessActionMessage({ type: 'error', message: error.message })
    }
  }

  return (
    <AdminLayout title="Panel Loren" onLogout={handleLogout}>
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="security-banner">
            <div className="security-icon">🔒</div>
            <div className="security-text">
              <h3>Panel conectado a datos reales</h3>
              <p>Sesión activa, proyectos, códigos de invitación y dispositivos leídos desde la API admin.</p>
            </div>
          </div>

          <div className="info-card">
            <h2>Información del usuario</h2>
            <div className="user-info">
              <div className="info-item">
                <label>ID:</label>
                <span>{user?.id}</span>
              </div>
              <div className="info-item">
                <label>Email:</label>
                <span>{user?.email}</span>
              </div>
            </div>
          </div>

          <div className="info-card">
            <h2>Workspace</h2>
            <p className="coordination-panel-copy" style={{ marginBottom: 16 }}>
              Nuevo espacio interno para chat, documentos, habilidades, proyectos y seguimiento operativo.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link className="cta-admin-button cta-admin-button--blue" to="/admin/workspace">Abrir workspace</Link>
              <Link className="cta-admin-button cta-admin-button--green" to="/admin/agentes">Canal de coordinación actual</Link>
              <Link className="cta-admin-button cta-admin-button--orange" to="/admin/invitaciones">Bandeja de invitaciones</Link>
            </div>
          </div>

          {projectsError ? <div className="error-message">{projectsError}</div> : null}

          <div className="next-steps-card">
            <div className="panel-header-row">
              <h2>Crear proyecto</h2>
              <span className="panel-header-pill">Admin</span>
            </div>
            <p className="coordination-panel-copy" style={{ marginBottom: 16 }}>
              Alta reutilizable para descargas OneDrive y webapps públicas con código de invitación.
            </p>
            <form className="admin-project-form" onSubmit={handleCreateProject}>
              <label>
                <span>Slug</span>
                <input type="text" value={projectForm.slug} onChange={(event) => updateProjectForm('slug', event.target.value)} placeholder="restricciones-trafico" required />
              </label>
              <label>
                <span>Nombre</span>
                <input type="text" value={projectForm.name} onChange={(event) => updateProjectForm('name', event.target.value)} placeholder="Restricciones Tráfico" required />
              </label>
              <label className="admin-project-form__wide">
                <span>Descripción</span>
                <textarea value={projectForm.description} onChange={(event) => updateProjectForm('description', event.target.value)} placeholder="Descripción visible del proyecto" rows={3} />
              </label>
              <label>
                <span>Tipo de origen</span>
                <select value={projectForm.sourceType} onChange={(event) => updateProjectForm('sourceType', event.target.value)}>
                  <option value="webapp">webapp</option>
                  <option value="onedrive">onedrive</option>
                </select>
              </label>
              <label>
                <span>Redirect URL {projectForm.sourceType === 'webapp' ? '(obligatorio)' : '(opcional)'}</span>
                <input type="url" value={projectForm.redirectUrl} onChange={(event) => updateProjectForm('redirectUrl', event.target.value)} placeholder="https://restricciones.inteligencialoren.com" required={projectForm.sourceType === 'webapp'} />
              </label>
              <label>
                <span>Source File ID {projectForm.sourceType === 'onedrive' ? '(obligatorio)' : '(no usado)'}</span>
                <input type="text" value={projectForm.sourceFileId} onChange={(event) => updateProjectForm('sourceFileId', event.target.value)} placeholder="ID de OneDrive" required={projectForm.sourceType === 'onedrive'} disabled={projectForm.sourceType !== 'onedrive'} />
              </label>
              <label>
                <span>Versión</span>
                <input type="text" value={projectForm.version} onChange={(event) => updateProjectForm('version', event.target.value)} placeholder="1.0.0" />
              </label>
              <label className="admin-project-form__wide">
                <span>Mensaje de actualización</span>
                <input type="text" value={projectForm.updateMessage} onChange={(event) => updateProjectForm('updateMessage', event.target.value)} placeholder="Alta inicial" />
              </label>
              <button className="cta-admin-button cta-admin-button--blue" type="submit" disabled={isCreatingProject}>
                {isCreatingProject ? 'Creando…' : 'Crear proyecto'}
              </button>
            </form>

            {projectActionMessage.message ? <div className={`admin-notice admin-notice--${projectActionMessage.type || 'info'}`}>{projectActionMessage.message}</div> : null}

            {createdProject ? (
              <div className="created-project-panel">
                <div className="access-meta-table">
                  <div className="access-meta-row"><div className="access-meta-label">Project ID</div><div className="access-meta-value">{createdProject.id}</div></div>
                  <div className="access-meta-row"><div className="access-meta-label">Slug</div><div className="access-meta-value">{createdProject.slug}</div></div>
                  <div className="access-meta-row"><div className="access-meta-label">Estado</div><div className="access-meta-value">{createdProject.status}</div></div>
                </div>
                <div className="access-actions">
                  <button className="cta-admin-button cta-admin-button--green" type="button" onClick={handlePublishCreatedProject} disabled={isPublishingProject || createdProject.status === 'public'}>
                    {isPublishingProject ? 'Publicando…' : 'Publicar'}
                  </button>
                  <button className="cta-admin-button cta-admin-button--orange" type="button" onClick={handleCreateAccessForCreatedProject} disabled={isCreatingProjectAccess}>
                    {isCreatingProjectAccess ? 'Generando…' : 'Generar código de acceso'}
                  </button>
                </div>
                {projectGeneratedCode ? (
                  <div className="code-reveal-card">
                    <span className="code-reveal-card__label">Código generado</span>
                    <code>{projectGeneratedCode}</code>
                    <button className="cta-admin-button cta-admin-button--blue" type="button" onClick={() => navigator.clipboard.writeText(projectGeneratedCode)}>
                      Copiar código
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{isLoadingProjects ? '…' : metrics.total}</div>
              <div className="stat-label">Proyectos totales</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{isLoadingProjects ? '…' : metrics.publicCount}</div>
              <div className="stat-label">Proyectos públicos</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{isLoadingProjects ? '…' : metrics.privateCount}</div>
              <div className="stat-label">Proyectos privados</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{isLoadingProjects ? '…' : metrics.publishedCount}</div>
              <div className="stat-label">Publicados</div>
            </div>
          </div>

          <div className="next-steps-card">
            <h2>Proyectos reales</h2>
            {isLoadingProjects ? (
              <div className="steps-message">Cargando proyectos…</div>
            ) : projects.length === 0 ? (
              <div className="steps-message">Todavía no hay proyectos cargados en el panel.</div>
            ) : (
              <div className="project-list">
                {projects.map((project) => {
                  const isSelected = project.id === selectedProjectId

                  return (
                    <button
                      key={project.id}
                      type="button"
                      className={`project-card ${isSelected ? 'project-card--active' : ''}`}
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      <div className="project-card__header">
                        <strong>{project.name}</strong>
                        <span className={`project-status project-status--${project.status}`}>{project.status}</span>
                      </div>
                      <div className="project-card__meta">Slug: {project.slug}</div>
                      <div className="project-card__meta">Versión: {project.version || 'Sin versión'}</div>
                      <div className="project-card__meta">Publicado: {formatDate(project.published_at, 'No publicado')}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="next-steps-card">
            <div className="panel-header-row">
              <h2>Códigos de invitación por proyecto</h2>
              {selectedProject ? <span className="panel-header-pill">{selectedProject.slug}</span> : null}
            </div>
            {!selectedProject ? (
              <div className="steps-message">Selecciona un proyecto para gestionar sus códigos de invitación.</div>
            ) : (
              <>
                <div className="selected-project-banner">
                  <strong>{selectedProject.name}</strong>
                  <span>{selectedProject.slug}</span>
                </div>

                <form className="admin-inline-form" onSubmit={handleCreateAccess}>
                  <label>
                    <span>Nombre de la persona</span>
                    <input
                      type="text"
                      value={accessForm.personName}
                      onChange={(event) => updateAccessForm('personName', event.target.value)}
                      placeholder="Ej. Ana Pérez"
                      required
                    />
                  </label>
                  <label>
                    <span>Notas</span>
                    <input
                      type="text"
                      value={accessForm.notes}
                      onChange={(event) => updateAccessForm('notes', event.target.value)}
                      placeholder="Opcional"
                    />
                  </label>
                  <label>
                    <span>Código de prueba temporal</span>
                    <select
                      value={accessForm.isTrial ? 'yes' : 'no'}
                      onChange={(event) => updateAccessForm('isTrial', event.target.value === 'yes')}
                    >
                      <option value="no">No, código normal</option>
                      <option value="yes">Sí, prueba temporal</option>
                    </select>
                  </label>
                  <label>
                    <span>Días de prueba</span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={accessForm.trialDays}
                      onChange={(event) => updateAccessForm('trialDays', event.target.value)}
                      placeholder="Ej. 7"
                      required={accessForm.isTrial}
                      disabled={!accessForm.isTrial}
                    />
                  </label>
                </form>

                <button
                  className="cta-admin-button cta-admin-button--green"
                  type="button"
                  onClick={handleCreateAccess}
                  disabled={isCreatingAccess}
                >
                  {isCreatingAccess ? 'Creando…' : 'Generar código'}
                </button>

                {accessActionMessage.message ? (
                  <div className={`admin-notice admin-notice--${accessActionMessage.type || 'info'}`}>
                    {accessActionMessage.message}
                  </div>
                ) : null}

                {accessesError ? <div className="error-message">{accessesError}</div> : null}

                {isLoadingAccesses ? (
                  <div className="steps-message">Cargando accesos…</div>
                ) : projectAccesses.length === 0 ? (
                  <div className="steps-message">Este proyecto no tiene códigos registrados todavía.</div>
                ) : (
                  <div className="access-list">
                    {projectAccesses.map((access) => {
                      const activeDevice = activeDevicesByAccessId[access.id]
                      const revealedCode = revealedCodes[access.id]
                      const trialState = getAccessTrialState(access)

                      return (
                        <div key={access.id} className="access-card access-card--detailed">
                          <div className="access-card__header">
                            <strong>{access.personName}</strong>
                            <div className="access-card__status-group">
                              <span className="device-status-row">
                                <span className={`device-status-dot ${access.status === 'revoked' ? 'device-status-dot--inactive' : 'device-status-dot--active'}`} />
                                <span className="device-status-text">{access.status === 'revoked' ? 'Revocado' : 'Activo'}</span>
                              </span>
                            </div>
                          </div>

                          <div className="access-stack-layout">
                            <div className="device-panel-simple">
                              <p className="device-panel-simple__summary">
                                {activeDevice ? 'Dispositivo vinculado' : 'Sin dispositivo vinculado'}
                              </p>
                              {activeDevice ? (
                                <div className="access-meta-table access-meta-table--compact">
                                  <div className="access-meta-row">
                                    <div className="access-meta-label">Nombre</div>
                                    <div className="access-meta-value">{activeDevice.deviceName}</div>
                                  </div>
                                  <div className="access-meta-row">
                                    <div className="access-meta-label">ID</div>
                                    <div className="access-meta-value">{activeDevice.deviceId}</div>
                                  </div>
                                  <div className="access-meta-row">
                                    <div className="access-meta-label">Plataforma</div>
                                    <div className="access-meta-value">{activeDevice.platform || 'No indicada'}</div>
                                  </div>
                                  <div className="access-meta-row">
                                    <div className="access-meta-label">Activado</div>
                                    <div className="access-meta-value access-meta-value--nowrap">{formatDate(activeDevice.activatedAt)}</div>
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            <div className="access-meta-table">
                              <div className="access-meta-row">
                                <div className="access-meta-label">Creado</div>
                                <div className="access-meta-value access-meta-value--nowrap">{formatDate(access.createdAt)}</div>
                              </div>
                              <div className="access-meta-row">
                                <div className="access-meta-label">Tipo</div>
                                <div className="access-meta-value">{trialState.label}</div>
                              </div>
                              <div className="access-meta-row">
                                <div className="access-meta-label">Estado prueba</div>
                                <div className="access-meta-value">{trialState.status}</div>
                              </div>
                              <div className="access-meta-row">
                                <div className="access-meta-label">Último código</div>
                                <div className="access-meta-value access-meta-value--nowrap">{formatDate(access.passwordLastGeneratedAt, 'Solo el inicial')}</div>
                              </div>
                              <div className="access-meta-row">
                                <div className="access-meta-label">Revocado</div>
                                <div className="access-meta-value access-meta-value--nowrap">{formatDate(access.revokedAt, 'Activo')}</div>
                              </div>
                              <div className="access-meta-row">
                                <div className="access-meta-label">Notas</div>
                                <div className="access-meta-value">{access.notes || 'Sin notas'}</div>
                              </div>
                            </div>
                          </div>

                          {revealedCode ? (
                            <div className="code-reveal-card">
                              <span className="code-reveal-card__label">Código visible una sola vez</span>
                              <code>{revealedCode}</code>
                              <button className="cta-admin-button cta-admin-button--blue" type="button" onClick={() => copyCode(access.id)}>
                                Copiar código
                              </button>
                            </div>
                          ) : null}

                          <div className="access-actions">
                            <button
                              className="cta-admin-button cta-admin-button--orange"
                              type="button"
                              onClick={() => handleRegenerateAccess(access)}
                            >
                              Regenerar código
                            </button>
                            <button
                              className="cta-admin-button cta-admin-button--red"
                              type="button"
                              onClick={() => handleRevokeAccess(access)}
                              disabled={access.status === 'revoked'}
                            >
                              Revocar código
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminPage
