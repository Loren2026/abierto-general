import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/layout/AdminLayout'
import useAuthStore from '../store/useAuthStore'
import {
  createWorkspaceDocumentSignedUrl,
  listWorkspaceDocuments,
} from '../services/workspaceDocumentsApi'
import {
  deleteThreadMessage,
  listThreadMessages,
  listThreads,
  listWorkspaceProjects,
} from '../services/coordinationApi'
import ThreadDetail from '../components/coordination/ThreadDetail'
import ThreadComposer from '../components/coordination/ThreadComposer'
import '../pages/Dashboard.css'

const BROWSER_PREVIEW_TYPES = new Set(['JSON', 'PDF', 'PNG', 'JPG', 'JPEG', 'GIF', 'WEBP', 'SVG', 'TXT', 'MD'])
const OFFICE_PREVIEW_TYPES = new Set(['DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX'])
const OFFICE_VIEWER_URL = 'https://view.officeapps.live.com/op/view.aspx?src='

function canPreviewInBrowser(document) {
  return BROWSER_PREVIEW_TYPES.has(document.type)
}

function canPreviewWithOffice(document) {
  return OFFICE_PREVIEW_TYPES.has(document.type)
}

const GENERAL_CHAT_ID = 'general-chat'
const GENERAL_CHAT = {
  id: GENERAL_CHAT_ID,
  title: 'Chat libre/general',
  status: 'general',
  summary: 'Conversación libre del Workspace. El envío real llegará en F2.',
  lastMessageAt: null,
  createdAt: null,
}

const PROJECT_STATUS_ORDER = {
  in_progress: 1,
  active: 1,
  construction: 1,
  open: 1,
  draft: 2,
  private: 2,
  pending_review: 3,
  blocked: 4,
  public: 5,
  closed: 6,
  archived: 7,
  finished: 7,
  completed: 7,
}

function normalizeProject(project) {
  return {
    id: `project:${project.id}`,
    projectId: project.id,
    title: project.name || project.title || project.slug || 'Proyecto sin nombre',
    status: project.status || 'private',
    summary: project.description || 'Conversación continua del proyecto.',
    lastMessageAt: null,
    createdAt: project.created_at || project.published_at || null,
  }
}

function sortConversations(conversations) {
  return [...conversations].sort((first, second) => {
    const firstOrder = PROJECT_STATUS_ORDER[first.status] ?? 3
    const secondOrder = PROJECT_STATUS_ORDER[second.status] ?? 3
    if (firstOrder !== secondOrder) return firstOrder - secondOrder
    return first.title.localeCompare(second.title, 'es')
  })
}


export default function WorkspacePage() {
  const { session, logout } = useAuthStore()
  const [threads, setThreads] = useState([])
  const [projects, setProjects] = useState([])
  const [selectedThreadId, setSelectedThreadId] = useState(GENERAL_CHAT_ID)
  const [messages, setMessages] = useState([])
  const [threadsError, setThreadsError] = useState('')
  const [messagesError, setMessagesError] = useState('')
  const [projectsError, setProjectsError] = useState('')
  const [copiedMessageId, setCopiedMessageId] = useState(null)
  const [deletingMessageId, setDeletingMessageId] = useState(null)
  const [actionMessage, setActionMessage] = useState({ type: '', message: '' })
  const [isLoadingThreads, setIsLoadingThreads] = useState(true)
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [mobileView, setMobileView] = useState('home')
  const [documents, setDocuments] = useState([])
  const [documentsError, setDocumentsError] = useState('')
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false)
  const [openingDocumentPath, setOpeningDocumentPath] = useState(null)

  const projectConversations = useMemo(
    () => sortConversations(projects.map(normalizeProject)),
    [projects],
  )

  const threadConversations = useMemo(
    () => sortConversations(threads.map((thread) => ({ ...thread, id: `thread:${thread.id}`, threadId: thread.id }))),
    [threads],
  )

  const conversations = useMemo(
    () => [GENERAL_CHAT, ...projectConversations, ...threadConversations],
    [projectConversations, threadConversations],
  )

  const selectedThread = useMemo(
    () => conversations.find((thread) => thread.id === selectedThreadId) || GENERAL_CHAT,
    [conversations, selectedThreadId],
  )

  const metrics = useMemo(() => ({
    totalThreads: conversations.length,
    openThreads: conversations.filter((thread) => ['open', 'active', 'in_progress', 'construction', 'private'].includes(thread.status)).length,
    blockedThreads: conversations.filter((thread) => thread.status === 'blocked').length,
    pendingConsultations: 0,
  }), [conversations])

  const activeProjects = useMemo(() => (
    conversations.slice(1, 4).map((thread, index) => ({
      id: thread.id,
      title: thread.title,
      status: thread.status,
      summary: thread.summary || 'Sin resumen todavía.',
      next: thread.lastMessageAt ? 'Retomar conversación' : 'Abrir conversación',
      primaryDocument: documents[index] || documents[0] || null,
    }))
  ), [conversations, documents])

  const selectedProject = useMemo(() => conversations.find((project) => project.id === selectedThreadId) || GENERAL_CHAT, [conversations, selectedThreadId])

  const handleLogout = async () => {
    await logout()
  }

  async function loadThreads() {
    if (!session?.accessToken) return

    setIsLoadingThreads(true)
    setThreadsError('')

    try {
      const data = await listThreads(session, { limit: 100, offset: 0 })
      setThreads(data.threads || [])
    } catch (error) {
      setThreadsError(error.message)
    } finally {
      setIsLoadingThreads(false)
    }
  }

  async function loadProjects() {
    if (!session?.accessToken) return

    setIsLoadingProjects(true)
    setProjectsError('')

    try {
      const data = await listWorkspaceProjects(session)
      setProjects(data.projects || [])
    } catch (error) {
      setProjectsError(error.message)
    } finally {
      setIsLoadingProjects(false)
    }
  }

  async function loadThreadMessages(conversation) {
    if (!conversation?.threadId || !session?.accessToken) {
      setMessages([])
      return
    }

    setIsLoadingMessages(true)
    setMessagesError('')

    try {
      const data = await listThreadMessages(session, conversation.threadId, { limit: 200, offset: 0 })
      setMessages(data.messages || [])
    } catch (error) {
      setMessagesError(error.message)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  useEffect(() => {
    loadThreads()
    loadProjects()
  }, [session?.accessToken])

  useEffect(() => {
    loadThreadMessages(selectedThread)
  }, [selectedThread?.id, session?.accessToken])

  useEffect(() => {
    loadDocuments()
  }, [session?.accessToken])

  async function loadDocuments() {
    if (!session?.accessToken) return

    setIsLoadingDocuments(true)
    setDocumentsError('')

    try {
      const nextDocuments = await listWorkspaceDocuments(session)
      setDocuments(nextDocuments)
    } catch (error) {
      setDocumentsError(error.message)
      setDocuments([])
    } finally {
      setIsLoadingDocuments(false)
    }
  }

  async function handleOpenDocument(document) {
    if (canPreviewWithOffice(document)) {
      await handleDownloadDocument(document)
      return
    }

    setOpeningDocumentPath(`open:${document.path}`)
    setActionMessage({ type: '', message: '' })

    try {
      const signedUrl = await createWorkspaceDocumentSignedUrl(session, document.path)
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setActionMessage({ type: 'error', message: error.message })
    } finally {
      setOpeningDocumentPath(null)
    }
  }

  async function handlePreviewOfficeDocument(document) {
    const confirmed = window.confirm('Para previsualizar este documento se enviará temporalmente a Microsoft. ¿Continuar?')

    if (!confirmed) return

    setOpeningDocumentPath(`preview:${document.path}`)
    setActionMessage({ type: '', message: '' })

    try {
      const signedUrl = await createWorkspaceDocumentSignedUrl(session, document.path)
      window.open(`${OFFICE_VIEWER_URL}${encodeURIComponent(signedUrl)}`, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setActionMessage({ type: 'error', message: error.message })
    } finally {
      setOpeningDocumentPath(null)
    }
  }

  async function handleDownloadDocument(document) {
    setOpeningDocumentPath(`download:${document.path}`)
    setActionMessage({ type: '', message: '' })

    try {
      const signedUrl = await createWorkspaceDocumentSignedUrl(session, document.path, { download: true })
      const link = window.document.createElement('a')
      link.href = signedUrl
      link.download = document.name
      link.rel = 'noopener noreferrer'
      link.target = '_blank'
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
    } catch (error) {
      setActionMessage({ type: 'error', message: error.message })
    } finally {
      setOpeningDocumentPath(null)
    }
  }

  function formatDocumentMeta(document) {
    const size = document.size ? `${Math.ceil(document.size / 1024)} KB` : 'Tamaño no disponible'
    const updated = document.updatedAt ? new Date(document.updatedAt).toLocaleDateString('es-ES') : 'Sin fecha'
    return `${document.type} · ${size} · ${updated}`
  }

  function handleCopyMessage(messageId) {
    setCopiedMessageId(messageId)
    window.setTimeout(() => setCopiedMessageId(null), 1800)
  }

  async function handleDeleteMessage(message) {
    const confirmed = window.confirm('¿Eliminar este mensaje?')
    if (!confirmed) return

    setDeletingMessageId(message.id)
    setActionMessage({ type: '', message: '' })

    try {
      await deleteThreadMessage(session, message.id)
      setActionMessage({ type: 'success', message: 'Mensaje eliminado.' })
      await loadThreadMessages(selectedThread)
    } catch (error) {
      setActionMessage({ type: 'error', message: error.message })
    } finally {
      setDeletingMessageId(null)
    }
  }

  function openThread(threadId) {
    setSelectedThreadId(threadId)
    setMobileView('chat')
  }

  function openProject(threadId) {
    setSelectedThreadId(threadId)
    setMobileView('project')
  }

  function handleConversationChange(event) {
    setSelectedThreadId(event.target.value)
    setMobileView('chat')
  }

  return (
    <AdminLayout title="Workspace" onLogout={handleLogout}>
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
                  <p>Elige el proyecto desde el desplegable del chat.</p>
                </div>
              </header>
              <div className="admin-notice">La navegación principal de F1 está en el selector superior del Chat.</div>
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

              <label className="workspace-chat-selector">
                <span>Conversación</span>
                <select value={selectedThreadId} onChange={handleConversationChange}>
                  {conversations.map((conversation) => (
                    <option key={conversation.id} value={conversation.id}>{conversation.title}</option>
                  ))}
                </select>
              </label>

              {(threadsError || projectsError) ? (
                <div className="admin-notice admin-notice--error">{threadsError || projectsError}</div>
              ) : null}

              <div className="workspace-mobile-chat-context">
                <span>Proyecto: {selectedThread?.title || 'Chat libre/general'}</span>
                <small>{selectedThread?.summary || 'Continúa el trabajo desde aquí.'}</small>
              </div>

              <ThreadDetail
                thread={selectedThread}
                messages={messages}
                isLoadingMessages={isLoadingMessages || isLoadingThreads || isLoadingProjects}
                messagesError={messagesError}
                copiedMessageId={copiedMessageId}
                deletingMessageId={deletingMessageId}
                onCopyMessage={handleCopyMessage}
                onDeleteMessage={handleDeleteMessage}
              />

              <div className="workspace-mobile-composer-stack">
                <ThreadComposer selectedThread={selectedThread} />
              </div>
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
                {isLoadingDocuments ? (
                  <div className="admin-notice">Cargando material del workspace…</div>
                ) : null}

                {documentsError ? (
                  <div className="admin-notice admin-notice--error">{documentsError}</div>
                ) : null}

                {!isLoadingDocuments && !documentsError && documents.length === 0 ? (
                  <div className="admin-notice">El bucket projects está vacío o no hay documentos visibles.</div>
                ) : null}

                {!isLoadingDocuments && !documentsError ? documents.map((document) => (
                  <article key={document.id} className="workspace-mobile-material-item workspace-mobile-material-item--full">
                    <div>
                      <strong>{document.name}</strong>
                      <p>{formatDocumentMeta(document)}</p>
                      <small>Bucket: {document.source} · Ruta: {document.path}</small>
                    </div>
                    <div className="workspace-mobile-hero-card__actions">
                      {canPreviewInBrowser(document) ? (
                        <button
                          className="workspace-mobile-link"
                          type="button"
                          onClick={() => handleOpenDocument(document)}
                          disabled={openingDocumentPath === `open:${document.path}`}
                        >
                          {openingDocumentPath === `open:${document.path}` ? 'Abriendo…' : 'Abrir'}
                        </button>
                      ) : null}

                      {canPreviewWithOffice(document) ? (
                        <button
                          className="workspace-mobile-link"
                          type="button"
                          onClick={() => handlePreviewOfficeDocument(document)}
                          disabled={openingDocumentPath === `preview:${document.path}`}
                        >
                          {openingDocumentPath === `preview:${document.path}` ? 'Preparando…' : 'Previsualizar'}
                        </button>
                      ) : null}

                      <button
                        className="workspace-mobile-link"
                        type="button"
                        onClick={() => handleDownloadDocument(document)}
                        disabled={openingDocumentPath === `download:${document.path}`}
                      >
                        {openingDocumentPath === `download:${document.path}` ? 'Descargando…' : 'Descargar'}
                      </button>
                    </div>
                  </article>
                )) : null}
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
