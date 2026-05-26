import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/layout/AdminLayout'
import useAuthStore from '../store/useAuthStore'
import {
  createThread,
  createThreadConsultation,
  createThreadMessage,
  listThreadConsultations,
  listThreadMessages,
  listThreads,
  respondConsultation,
} from '../services/coordinationApi'
import ThreadList from '../components/coordination/ThreadList'
import ThreadDetail from '../components/coordination/ThreadDetail'
import ThreadComposer from '../components/coordination/ThreadComposer'
import ConsultationComposer from '../components/coordination/ConsultationComposer'
import '../pages/Dashboard.css'

const documentSeeds = [
  {
    id: 'gestactas-juntas',
    name: 'acta-borrador.html',
    type: 'HTML',
    project: 'GestActas',
    context: 'Bloque juntas',
    recency: 'Hace 2 h',
    primaryContext: 'Proyecto',
  },
  {
    id: 'mercado-valoracion',
    name: 'borrador-valoracion.html',
    type: 'HTML',
    project: 'Análisis mercado',
    context: 'Valoración',
    recency: 'Ayer',
    primaryContext: 'Proyecto',
  },
  {
    id: 'workspace-docs',
    name: 'planning-v2-1-final.html',
    type: 'HTML',
    project: 'Home móvil',
    context: 'Documento maestro',
    recency: 'Hoy',
    primaryContext: 'General',
  },
]

export default function WorkspacePage() {
  const { session, logout } = useAuthStore()
  const [threads, setThreads] = useState([])
  const [selectedThreadId, setSelectedThreadId] = useState(null)
  const [messages, setMessages] = useState([])
  const [consultations, setConsultations] = useState([])
  const [threadsError, setThreadsError] = useState('')
  const [messagesError, setMessagesError] = useState('')
  const [consultationsError, setConsultationsError] = useState('')
  const [actionMessage, setActionMessage] = useState({ type: '', message: '' })
  const [isLoadingThreads, setIsLoadingThreads] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isLoadingConsultations, setIsLoadingConsultations] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [filters, setFilters] = useState({ search: '', status: '', priority: '' })
  const [mobileView, setMobileView] = useState('home')

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId],
  )

  const metrics = useMemo(() => ({
    totalThreads: threads.length,
    openThreads: threads.filter((thread) => thread.status === 'open').length,
    blockedThreads: threads.filter((thread) => thread.status === 'blocked').length,
    pendingConsultations: consultations.filter((consultation) => consultation.status === 'pending').length,
  }), [threads, consultations])

  const activeProjects = useMemo(() => (
    threads.slice(0, 3).map((thread, index) => ({
      id: thread.id,
      title: thread.title,
      status: thread.status,
      summary: thread.summary || 'Sin resumen todavía.',
      next: thread.lastMessageAt ? 'Retomar conversación' : 'Abrir hilo',
      primaryDocument: documentSeeds[index] || documentSeeds[0],
    }))
  ), [threads])

  const selectedProject = useMemo(() => activeProjects.find((project) => project.id === selectedThreadId) || null, [activeProjects, selectedThreadId])

  const handleLogout = async () => {
    await logout()
  }

  async function loadThreads() {
    if (!session?.accessToken) return

    setIsLoadingThreads(true)
    setThreadsError('')

    try {
      const data = await listThreads(session, {
        search: filters.search,
        status: filters.status,
        priority: filters.priority,
        limit: 50,
        offset: 0,
      })
      const nextThreads = data.threads || []
      setThreads(nextThreads)

      if (!selectedThreadId && nextThreads.length) {
        setSelectedThreadId(nextThreads[0].id)
      }

      if (selectedThreadId && !nextThreads.some((thread) => thread.id === selectedThreadId)) {
        setSelectedThreadId(nextThreads[0]?.id || null)
      }
    } catch (error) {
      setThreadsError(error.message)
    } finally {
      setIsLoadingThreads(false)
    }
  }

  async function loadThreadMessages(threadId) {
    if (!threadId || !session?.accessToken) {
      setMessages([])
      return
    }

    setIsLoadingMessages(true)
    setMessagesError('')

    try {
      const data = await listThreadMessages(session, threadId, { limit: 200, offset: 0 })
      setMessages(data.messages || [])
    } catch (error) {
      setMessagesError(error.message)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  async function loadThreadConsultations(threadId) {
    if (!threadId || !session?.accessToken) {
      setConsultations([])
      return
    }

    setIsLoadingConsultations(true)
    setConsultationsError('')

    try {
      const data = await listThreadConsultations(session, threadId, { limit: 100, offset: 0 })
      setConsultations(data.consultations || [])
    } catch (error) {
      setConsultationsError(error.message)
    } finally {
      setIsLoadingConsultations(false)
    }
  }

  useEffect(() => {
    loadThreads()
  }, [session?.accessToken, filters.search, filters.status, filters.priority])

  useEffect(() => {
    loadThreadMessages(selectedThreadId)
    loadThreadConsultations(selectedThreadId)
  }, [selectedThreadId, session?.accessToken])

  async function handleCreateThread(payload) {
    setIsSaving(true)
    setActionMessage({ type: '', message: '' })

    try {
      const data = await createThread(session, payload)
      setActionMessage({ type: 'success', message: 'Conversación creada correctamente.' })
      await loadThreads()
      setSelectedThreadId(data.thread.id)
      setMobileView('chat')
      return { success: true }
    } catch (error) {
      setActionMessage({ type: 'error', message: error.message })
      return { success: false }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateMessage(payload) {
    if (!selectedThreadId) return { success: false }

    setIsSaving(true)
    setActionMessage({ type: '', message: '' })

    try {
      await createThreadMessage(session, selectedThreadId, payload)
      setActionMessage({ type: 'success', message: 'Mensaje enviado.' })
      await Promise.all([loadThreads(), loadThreadMessages(selectedThreadId)])
      return { success: true }
    } catch (error) {
      setActionMessage({ type: 'error', message: error.message })
      return { success: false }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreateConsultation(payload) {
    if (!selectedThreadId) return { success: false }

    setIsSaving(true)
    setActionMessage({ type: '', message: '' })

    try {
      await createThreadConsultation(session, selectedThreadId, payload)
      setActionMessage({ type: 'success', message: 'Recordatorio guardado.' })
      await loadThreadConsultations(selectedThreadId)
      return { success: true }
    } catch (error) {
      setActionMessage({ type: 'error', message: error.message })
      return { success: false }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRespondConsultation(consultationId, payload) {
    setIsSaving(true)
    setActionMessage({ type: '', message: '' })

    try {
      await respondConsultation(session, consultationId, payload)
      setActionMessage({ type: 'success', message: 'Recordatorio actualizado.' })
      await loadThreadConsultations(selectedThreadId)
      return { success: true }
    } catch (error) {
      setActionMessage({ type: 'error', message: error.message })
      return { success: false }
    } finally {
      setIsSaving(false)
    }
  }

  function handleFilterChange(field, value) {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function openThread(threadId) {
    setSelectedThreadId(threadId)
    setMobileView('chat')
  }

  function openProject(threadId) {
    setSelectedThreadId(threadId)
    setMobileView('project')
  }

  return (
    <AdminLayout title="Workspace privado" onLogout={handleLogout}>
      <div className="dashboard-container workspace-page workspace-page--mobile-first">
        <div className="dashboard-content workspace-content--mobile-first">
          {actionMessage.message ? (
            <div className={`admin-notice admin-notice--${actionMessage.type === 'success' ? 'success' : 'error'}`}>
              {actionMessage.message}
            </div>
          ) : null}

          {mobileView === 'home' ? (
            <section className="workspace-mobile-home">
              <header className="workspace-mobile-header">
                <div>
                  <strong>Workspace Turín</strong>
                  <p>Retoma donde lo dejaste</p>
                </div>
                <Link className="workspace-mobile-header__link" to="/admin">Panel</Link>
              </header>

              <article className="workspace-mobile-hero-card">
                <div>
                  <span className="workspace-mobile-eyebrow">Continuidad</span>
                  <h1>Hablar con Turín</h1>
                  <p>
                    {selectedThread
                      ? `Retoma la conversación sobre ${selectedThread.title}`
                      : 'Entra al chat y continúa el trabajo donde lo dejaste.'}
                  </p>
                </div>
                <div className="workspace-mobile-hero-card__actions">
                  <button className="cta-admin-button cta-admin-button--blue" type="button" onClick={() => setMobileView('chat')}>
                    Continuar
                  </button>
                  <button className="workspace-mobile-link" type="button" onClick={() => setMobileView('threads')}>
                    Ver conversaciones
                  </button>
                </div>
              </article>

              <section className="workspace-mobile-block">
                <div className="workspace-mobile-block__header">
                  <h2>Proyectos activos</h2>
                  <span>{activeProjects.length || 0}</span>
                </div>
                <div className="workspace-mobile-projects">
                  {activeProjects.map((project) => (
                    <button key={project.id} type="button" className="workspace-mobile-project-card" onClick={() => openProject(project.id)}>
                      <div className="workspace-mobile-project-card__top">
                        <strong>{project.title}</strong>
                        <span className={`project-status project-status--${project.status}`}>{project.status}</span>
                      </div>
                      <p>{project.summary}</p>
                      <small>{project.next}</small>
                    </button>
                  ))}
                  {!activeProjects.length && !isLoadingThreads ? (
                    <div className="admin-notice">No hay proyectos activos todavía.</div>
                  ) : null}
                </div>
              </section>

              <section className="workspace-mobile-status-card">
                <div>
                  <strong>Estado ahora</strong>
                  <p>{metrics.openThreads} conversaciones abiertas, {metrics.pendingConsultations} recordatorios pendientes y material disponible cuando lo necesites.</p>
                </div>
                <button className="workspace-mobile-link" type="button" onClick={() => setMobileView('material')}>
                  Ver material
                </button>
              </section>
            </section>
          ) : null}

          {mobileView === 'threads' ? (
            <section className="workspace-mobile-screen">
              <header className="workspace-mobile-screen__header">
                <button type="button" className="workspace-mobile-back" onClick={() => setMobileView('home')}>←</button>
                <div>
                  <strong>Conversaciones</strong>
                  <p>Tus temas abiertos dentro del workspace.</p>
                </div>
              </header>
              <ThreadList
                threads={threads}
                selectedThreadId={selectedThreadId}
                isLoading={isLoadingThreads}
                error={threadsError}
                filters={filters}
                onFilterChange={handleFilterChange}
                onSelectThread={openThread}
              />
            </section>
          ) : null}

          {mobileView === 'project' ? (
            <section className="workspace-mobile-screen">
              <header className="workspace-mobile-screen__header">
                <button type="button" className="workspace-mobile-back" onClick={() => setMobileView('home')}>←</button>
                <div>
                  <strong>{selectedProject?.title || 'Proyecto'}</strong>
                  <p>{selectedProject ? 'Contexto rápido del frente' : 'Sin proyecto seleccionado'}</p>
                </div>
              </header>

              <article className="workspace-mobile-project-focus">
                <div>
                  <span className="workspace-mobile-eyebrow">Proyecto</span>
                  <h2>{selectedProject?.title || 'Proyecto general'}</h2>
                  <p>{selectedProject?.summary || 'Sin resumen todavía.'}</p>
                </div>
                <button className="cta-admin-button cta-admin-button--blue" type="button" onClick={() => setMobileView('chat')}>
                  Hablar sobre este proyecto
                </button>
              </article>

              <section className="workspace-mobile-status-card">
                <div>
                  <strong>Estado breve</strong>
                  <p>{selectedProject?.status || 'open'} · {selectedProject?.next || 'Retomar conversación'}.</p>
                </div>
                <button className="workspace-mobile-link" type="button" onClick={() => setMobileView('material')}>
                  Ver material
                </button>
              </section>
            </section>
          ) : null}

          {mobileView === 'chat' ? (
            <section className="workspace-mobile-screen workspace-mobile-screen--chat">
              <header className="workspace-mobile-screen__header">
                <button type="button" className="workspace-mobile-back" onClick={() => setMobileView('home')}>←</button>
                <div>
                  <strong>{selectedThread?.title || 'Chat con Turín'}</strong>
                  <p>{selectedThread ? 'Retomando conversación reciente' : 'Conversación general'}</p>
                </div>
              </header>

              <div className="workspace-mobile-chat-context">
                <span>Proyecto: {selectedThread?.title || 'General'}</span>
                <small>{selectedThread?.summary || 'Continúa el trabajo desde aquí.'}</small>
              </div>

              <ThreadDetail
                thread={selectedThread}
                messages={messages}
                consultations={consultations}
                isLoadingMessages={isLoadingMessages}
                isLoadingConsultations={isLoadingConsultations}
                messagesError={messagesError}
                consultationsError={consultationsError}
                onRespondConsultation={handleRespondConsultation}
                isSaving={isSaving}
              />

              <div className="workspace-mobile-composer-stack">
                <ThreadComposer
                  selectedThread={selectedThread}
                  onCreateThread={handleCreateThread}
                  onCreateMessage={handleCreateMessage}
                  isSaving={isSaving}
                />
              </div>

              <details className="workspace-mobile-secondary-panel">
                <summary>Recordatorios y seguimiento</summary>
                <ConsultationComposer
                  selectedThread={selectedThread}
                  onCreateConsultation={handleCreateConsultation}
                  isSaving={isSaving}
                />
              </details>
            </section>
          ) : null}

          {mobileView === 'material' ? (
            <section className="workspace-mobile-screen">
              <header className="workspace-mobile-screen__header">
                <button type="button" className="workspace-mobile-back" onClick={() => setMobileView('home')}>←</button>
                <div>
                  <strong>Material</strong>
                  <p>Lo último que estás usando en el workspace.</p>
                </div>
              </header>
              <div className="workspace-mobile-material-list workspace-mobile-material-list--full">
                {documentSeeds.map((document) => (
                  <article key={document.id} className="workspace-mobile-material-item workspace-mobile-material-item--full">
                    <div>
                      <strong>{document.name}</strong>
                      <p>{document.type} · Vive en {document.project}</p>
                      <small>{document.primaryContext} · Usado en: {document.context}</small>
                    </div>
                    <span>{document.recency}</span>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <nav className="workspace-mobile-nav">
            <button type="button" className={mobileView === 'home' ? 'workspace-mobile-nav__item workspace-mobile-nav__item--active' : 'workspace-mobile-nav__item'} onClick={() => setMobileView('home')}>Inicio</button>
            <button type="button" className={mobileView === 'chat' || mobileView === 'threads' || mobileView === 'project' ? 'workspace-mobile-nav__item workspace-mobile-nav__item--active' : 'workspace-mobile-nav__item'} onClick={() => setMobileView('chat')}>Chat</button>
            <button type="button" className={mobileView === 'material' ? 'workspace-mobile-nav__item workspace-mobile-nav__item--active' : 'workspace-mobile-nav__item'} onClick={() => setMobileView('material')}>Material</button>
          </nav>
        </div>
      </div>
    </AdminLayout>
  )
}
