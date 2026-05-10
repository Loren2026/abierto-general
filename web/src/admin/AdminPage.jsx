import { useEffect, useMemo, useState } from 'react'
import useAuthStore from '../store/useAuthStore'
import '../pages/Dashboard.css'
import AdminLayout from '../components/layout/AdminLayout'

function formatDate(value) {
  if (!value) return 'No publicado'

  try {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch (error) {
    return value
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

  const handleLogout = async () => {
    await logout()
  }

  useEffect(() => {
    async function loadProjects() {
      if (!session?.accessToken) {
        setProjects([])
        setIsLoadingProjects(false)
        return
      }

      setIsLoadingProjects(true)
      setProjectsError('')

      try {
        const response = await fetch('/api/admin/projects', {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data.error || 'No se pudieron cargar los proyectos')
        }

        setProjects(data.projects || [])
      } catch (error) {
        setProjectsError(error.message)
      } finally {
        setIsLoadingProjects(false)
      }
    }

    loadProjects()
  }, [session?.accessToken])

  useEffect(() => {
    async function loadProjectAccesses() {
      if (!selectedProjectId || !session?.accessToken) {
        setProjectAccesses([])
        setAccessesError('')
        setIsLoadingAccesses(false)
        return
      }

      setIsLoadingAccesses(true)
      setAccessesError('')

      try {
        const response = await fetch(`/api/admin/projects/${selectedProjectId}/accesses`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        })

        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(data.error || 'No se pudieron cargar los accesos del proyecto')
        }

        setProjectAccesses(data.accesses || [])
      } catch (error) {
        setAccessesError(error.message)
      } finally {
        setIsLoadingAccesses(false)
      }
    }

    loadProjectAccesses()
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

  return (
    <AdminLayout title="Panel Loren" onLogout={handleLogout}>
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="security-banner">
            <div className="security-icon">🔒</div>
            <div className="security-text">
              <h3>Panel conectado a datos reales</h3>
              <p>Sesión activa, proyectos leídos desde API admin y accesos cargados por proyecto.</p>
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
                      <div className="project-card__meta">Publicado: {formatDate(project.published_at)}</div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="next-steps-card">
            <h2>Accesos por proyecto</h2>
            {!selectedProject ? (
              <div className="steps-message">Selecciona un proyecto para ver sus accesos reales.</div>
            ) : (
              <>
                <div className="selected-project-banner">
                  <strong>{selectedProject.name}</strong>
                  <span>{selectedProject.slug}</span>
                </div>

                {accessesError ? <div className="error-message">{accessesError}</div> : null}

                {isLoadingAccesses ? (
                  <div className="steps-message">Cargando accesos…</div>
                ) : projectAccesses.length === 0 ? (
                  <div className="steps-message">Este proyecto no tiene accesos registrados todavía.</div>
                ) : (
                  <div className="access-list">
                    {projectAccesses.map((access) => (
                      <div key={access.id} className="access-card">
                        <div className="access-card__header">
                          <strong>{access.personName}</strong>
                          <span className={`project-status project-status--${access.status}`}>{access.status}</span>
                        </div>
                        <div className="project-card__meta">Creado: {formatDate(access.createdAt)}</div>
                        <div className="project-card__meta">Última contraseña: {formatDate(access.passwordLastGeneratedAt)}</div>
                        <div className="project-card__meta">Revocado: {formatDate(access.revokedAt)}</div>
                        <div className="project-card__meta">Notas: {access.notes || 'Sin notas'}</div>
                      </div>
                    ))}
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
