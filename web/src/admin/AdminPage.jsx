import { useEffect, useMemo, useState } from 'react'
import useAuthStore from '../store/useAuthStore'
import '../pages/Dashboard.css'
import AdminLayout from '../components/layout/AdminLayout'

const initialAccessForm = {
  personName: '',
  notes: '',
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

  async function handleCreateAccess(event) {
    event.preventDefault()

    if (!selectedProjectId) return

    setIsCreatingAccess(true)
    setAccessActionMessage({ type: '', message: '' })

    try {
      const data = await apiFetch(`/api/admin/projects/${selectedProjectId}/accesses`, {
        method: 'POST',
        body: JSON.stringify(accessForm),
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

          {projectsError ? <div className="error-message">{projectsError}</div> : null}

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
                  <button className="cta-admin-button cta-admin-button--green" type="submit" disabled={isCreatingAccess}>
                    {isCreatingAccess ? 'Creando…' : 'Generar código'}
                  </button>
                </form>

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

                          <div className="access-grid-simple">
                            <div className="access-meta-table">
                              <div className="access-meta-row">
                                <div className="access-meta-label">Creado</div>
                                <div className="access-meta-value access-meta-value--nowrap">{formatDate(access.createdAt)}</div>
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
                              disabled={access.status === 'revoked'}
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
