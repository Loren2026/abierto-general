import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/layout/AdminLayout'
import useAuthStore from '../store/useAuthStore'
import {
  createWorkspaceDocumentSignedUrl,
  listWorkspaceDocuments,
} from '../services/workspaceDocumentsApi'
import {
  createThread,
  deleteThreadMessage,
  getGatewayBridgeStatus,
  listThreadMessages,
  listThreads,
  listWorkspaceProjects,
  sendThreadMessageToTurin,
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
const GENERAL_CHAT_THREAD_KEY = 'workspace-general:pendientes-inmediatos'
const GENERAL_CHAT = {
  id: GENERAL_CHAT_ID,
  title: 'Chat libre/general',
  status: 'general',
  summary: 'Pendientes inmediatos del Workspace Turín.',
  threadKey: GENERAL_CHAT_THREAD_KEY,
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

function normalizeProject(project, thread = null) {
  return {
    id: thread ? `thread:${thread.id}` : `project:${project.id}`,
    syntheticId: `project:${project.id}`,
    conversationType: thread ? 'thread' : 'project',
    projectId: project.id,
    threadId: thread?.id || null,
    threadKey: thread?.threadKey || null,
    title: thread?.title || project.name || project.title || project.slug || 'Proyecto sin nombre',
    status: thread?.status || project.status || 'private',
    summary: thread?.summary || project.description || 'Conversación continua del proyecto.',
    lastMessageAt: thread?.lastMessageAt || null,
    createdAt: thread?.createdAt || project.created_at || project.published_at || null,
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
  const [generalThread, setGeneralThread] = useState(null)
  const [projects, setProjects] = useState([])
  const [selectedThreadId, setSelectedThreadId] = useState(GENERAL_CHAT_ID)
  const [messages, setMessages] = useState([])
  const [messagesByThreadId, setMessagesByThreadId] = useState({})
  const [threadsError, setThreadsError] = useState('')
  const [messagesError, setMessagesError] = useState('')
  const [projectsError, setProjectsError] = useState('')
  const [copiedMessageId, setCopiedMessageId] = useState(null)
  const [deletingMessageId, setDeletingMessageId] = useState(null)
  const [actionMessage, setActionMessage] = useState({ type: '', message: '' })
  const [isLoadingThreads, setIsLoadingThreads] = useState(true)
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const [isGatewayBridgeEnabled, setIsGatewayBridgeEnabled] = useState(false)
  const [mobileView, setMobileView] = useState('home')
  const [documents, setDocuments] = useState([])
  const [documentsError, setDocumentsError] = useState('')
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false)
  const [openingDocumentPath, setOpeningDocumentPath] = useState(null)
  const [seenMessagesByThreadId, setSeenMessagesByThreadId] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem(SEEN_MESSAGES_STORAGE_KEY) || '{}')
    } catch {
      return {}
    }
  })

  const projectConversations = useMemo(() => {
    const threadsByProjectId = new Map(
      threads
        .filter((thread) => thread.projectId)
        .map((thread) => [thread.projectId, thread]),
    )

    return sortConversations(projects.map((project) => normalizeProject(project, threadsByProjectId.get(project.id))))
  }, [projects, threads])

  const threadConversations = useMemo(
    () => sortConversations(
      threads
        .filter((thread) => !thread.projectId && thread.id !== generalThread?.id && thread.threadKey !== GENERAL_CHAT_THREAD_KEY && thread.title !== GENERAL_CHAT.title && thread.title !== 'Pendientes inmediatos')
        .map((thread) => ({ ...thread, id: `thread:${thread.id}`, threadId: thread.id })),
    ),
    [threads],
  )

  const conversations = useMemo(
    () => [generalThread ? { ...GENERAL_CHAT, ...generalThread, id: `thread:${generalThread.id}`, threadId: generalThread.id } : GENERAL_CHAT, ...projectConversations, ...threadConversations],
    [generalThread, projectConversations, threadConversations],
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

  const unreadConversations = useMemo(() => conversations.filter((conversation) => {
    if (!conversation.threadId || !conversation.lastMessageAt) return false
    const seenAt = seenMessagesByThreadId[conversation.threadId]
    return !seenAt || new Date(conversation.lastMessageAt).getTime() > new Date(seenAt).getTime()
  }), [conversations, seenMessagesByThreadId])

  function getUnreadCount(conversation) {
    if (!conversation?.threadId || !conversation?.lastMessageAt) return 0
    const seenAt = seenMessagesByThreadId[conversation.threadId]
    if (seenAt && new Date(conversation.lastMessageAt).getTime() <= new Date(seenAt).getTime()) return 0

    const cachedMessages = messagesByThreadId[conversation.threadId] || []
    if (!cachedMessages.length || !seenAt) return 1

    return cachedMessages.filter((message) => (
      message.createdAt && new Date(message.createdAt).getTime() > new Date(seenAt).getTime()
    )).length || 1
  }

  const unreadMessagesCount = unreadConversations.reduce((total, conversation) => total + getUnreadCount(conversation), 0)

  function markThreadSeen(conversation) {
    if (!conversation?.threadId) return
    const seenAt = conversation.lastMessageAt || new Date().toISOString()
    setSeenMessagesByThreadId((current) => {
      if (current[conversation.threadId] === seenAt) return current
      const next = { ...current, [conversation.threadId]: seenAt }
      window.localStorage.setItem(SEEN_MESSAGES_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const handleLogout = async () => {
    await logout()
  }

  async function loadThreads() {
    if (!session?.accessToken) return

    setIsLoadingThreads(true)
    setThreadsError('')

    try {
      const data = await listThreads(session, { limit: 100, offset: 0 })
      const nextThreads = data.threads || []
      setThreads(nextThreads)
      setGeneralThread(nextThreads.find((thread) => thread.threadKey === GENERAL_CHAT_THREAD_KEY) || null)
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

  async function loadThreadMessages(conversation, options = {}) {
    if (!conversation?.threadId || !session?.accessToken) {
      setMessages([])
      return
    }

    if (!options.force && messagesByThreadId[conversation.threadId]) {
      setMessages(messagesByThreadId[conversation.threadId])
      return
    }

    setIsLoadingMessages(true)
    setMessagesError('')

    try {
      const data = await listThreadMessages(session, conversation.threadId, { limit: 200, offset: 0 })
      const nextMessages = data.messages || []
      setMessages(nextMessages)
      setMessagesByThreadId((current) => ({ ...current, [conversation.threadId]: nextMessages }))
      markThreadSeen({ ...conversation, lastMessageAt: nextMessages[nextMessages.length - 1]?.createdAt || conversation.lastMessageAt })
    } catch (error) {
      setMessagesError(error.message)
    } finally {
      setIsLoadingMessages(false)
    }
  }

  useEffect(() => {
    loadThreads()
    loadProjects()
    loadGatewayBridgeStatus()
  }, [session?.accessToken])

  useEffect(() => {
    ensureGeneralThread()
  }, [session?.accessToken, threads.length])

  useEffect(() => {
    loadThreadMessages(selectedThread)
  }, [selectedThread?.id, session?.accessToken])

  useEffect(() => {
    loadDocuments()
  }, [session?.accessToken])

  async function loadGatewayBridgeStatus() {
    if (!session?.accessToken) return

    try {
      const data = await getGatewayBridgeStatus(session)
      setIsGatewayBridgeEnabled(Boolean(data.gateway?.enabled && data.gateway?.configured))
    } catch {
      setIsGatewayBridgeEnabled(false)
    }
  }

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


  async function ensureGeneralThread() {
    if (!session?.accessToken || generalThread) return generalThread

    const existingThread = threads.find((thread) => thread.threadKey === GENERAL_CHAT_THREAD_KEY)
    if (existingThread) {
      setGeneralThread(existingThread)
      if (selectedThreadId === GENERAL_CHAT_ID) setSelectedThreadId(`thread:${existingThread.id}`)
      return existingThread
    }

    const payload = {
      threadKey: GENERAL_CHAT_THREAD_KEY,
      title: 'Pendientes inmediatos',
      summary: 'Chat libre/general para pendientes inmediatos del Workspace Turín.',
      status: 'open',
      priority: 'normal',
      origin: 'internal',
      createdByType: 'system',
      createdByLabel: 'Workspace Turín',
      metadata: { source: 'workspace-f2-general-chat' },
    }

    try {
      const data = await createThread(session, payload)
      const thread = data.thread
      setGeneralThread(thread)
      setThreads((currentThreads) => [thread, ...currentThreads.filter((currentThread) => currentThread.id !== thread.id)])
      if (selectedThreadId === GENERAL_CHAT_ID) setSelectedThreadId(`thread:${thread.id}`)
      return thread
    } catch (error) {
      if (error.message !== 'threadKey already exists' && error.message !== 'resource already exists') throw error
      const data = await listThreads(session, { search: 'Pendientes inmediatos', limit: 10, offset: 0 })
      const thread = data.threads?.find((candidate) => candidate.threadKey === GENERAL_CHAT_THREAD_KEY) || data.threads?.[0]
      if (!thread) throw error
      setGeneralThread(thread)
      setThreads((currentThreads) => [thread, ...currentThreads.filter((currentThread) => currentThread.id !== thread.id)])
      if (selectedThreadId === GENERAL_CHAT_ID) setSelectedThreadId(`thread:${thread.id}`)
      return thread
    }
  }

  async function ensureConversationThread(conversation) {
    if (conversation?.threadId) return conversation
    if (conversation?.id === GENERAL_CHAT_ID || conversation?.threadKey === GENERAL_CHAT_THREAD_KEY) return ensureGeneralThread()
    if (!conversation?.projectId) return null

    const payload = {
      projectId: conversation.projectId,
      threadKey: `workspace-project:${conversation.projectId}`,
      title: conversation.title,
      summary: conversation.summary || `Conversación continua del proyecto ${conversation.title}.`,
      status: 'open',
      priority: 'normal',
      origin: 'internal',
      createdByType: 'system',
      createdByLabel: 'Workspace Turín',
      metadata: {
        source: 'workspace-f2-auto-thread',
        syntheticConversationId: conversation.syntheticId || conversation.id,
      },
    }

    try {
      const data = await createThread(session, payload)
      const thread = data.thread
      setThreads((currentThreads) => [
        thread,
        ...currentThreads.filter((currentThread) => currentThread.id !== thread.id),
      ])
      setSelectedThreadId(`thread:${thread.id}`)
      return { ...conversation, id: `thread:${thread.id}`, threadId: thread.id, threadKey: thread.threadKey }
    } catch (error) {
      if (error.message !== 'threadKey already exists' && error.message !== 'resource already exists') throw error
      const data = await listThreads(session, { projectId: conversation.projectId, limit: 1, offset: 0 })
      const thread = data.threads?.[0]
      if (!thread) throw error
      setThreads((currentThreads) => [
        thread,
        ...currentThreads.filter((currentThread) => currentThread.id !== thread.id),
      ])
      setSelectedThreadId(`thread:${thread.id}`)
      return { ...conversation, id: `thread:${thread.id}`, threadId: thread.id, threadKey: thread.threadKey }
    }
  }

  async function handleSendMessageToTurin(body, options = {}) {
    if (!session?.accessToken) {
      setActionMessage({ type: 'error', message: 'Sesión no disponible.' })
      return false
    }

    setIsSendingMessage(true)
    setActionMessage({ type: '', message: '' })

    try {
      const conversationThread = await ensureConversationThread(selectedThread)
      if (!conversationThread?.threadId) {
        setActionMessage({ type: 'error', message: 'Esta conversación todavía no tiene hilo real.' })
        return false
      }

      const messageBody = options.replyTo ? `> ${options.replyTo.authorLabel}: ${options.replyTo.body}\n\n${body}` : body
      const data = await sendThreadMessageToTurin(session, conversationThread.threadId, { body: messageBody })
      const appendedMessages = [data.lorenMessage, data.turinMessage].filter(Boolean)
      if (appendedMessages.length) {
        setMessages((currentMessages) => {
          const knownIds = new Set(currentMessages.map((message) => message.id))
          const nextMessages = [...currentMessages, ...appendedMessages.filter((message) => !knownIds.has(message.id))]
          setMessagesByThreadId((current) => ({ ...current, [conversationThread.threadId]: nextMessages }))
          return nextMessages
        })
        const lastMessageAt = appendedMessages[appendedMessages.length - 1]?.createdAt || new Date().toISOString()
        setThreads((currentThreads) => currentThreads.map((thread) => (
          thread.id === conversationThread.threadId ? { ...thread, lastMessageAt } : thread
        )))
      } else {
        await loadThreadMessages(conversationThread, { force: true })
      }
      return true
    } catch (error) {
      setActionMessage({ type: 'error', message: error.message })
      return false
    } finally {
      setIsSendingMessage(false)
    }
  }

  async function handleDeleteMessage(message) {
    const confirmed = window.confirm('¿Eliminar este mensaje?')
    if (!confirmed) return

    setDeletingMessageId(message.id)
    setActionMessage({ type: '', message: '' })

    try {
      await deleteThreadMessage(session, message.id)
      setActionMessage({ type: 'success', message: 'Mensaje eliminado.' })
      await loadThreadMessages(selectedThread, { force: true })
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

  function openUnreadConversation(conversation) {
    setSelectedThreadId(conversation.id)
    setMobileView('chat')
  }

  function goBackFromCurrentView() {
    if (mobileView === 'material') {
      setMobileView('chat')
      return
    }

    setMobileView('home')
  }

  const shouldHideAdminHeader = mobileView === 'chat' || mobileView === 'material'

  return (
    <AdminLayout title="Workspace" onLogout={handleLogout}>
      <div className={shouldHideAdminHeader ? 'dashboard-container workspace-page workspace-page--mobile-first workspace-page--hide-admin-header' : 'dashboard-container workspace-page workspace-page--mobile-first'}>
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
                <button type="button" className="workspace-mobile-back" onClick={goBackFromCurrentView}>←</button>
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

              {unreadConversations.length ? (
                <div className="workspace-unread-list">
                  <strong>Mensajes nuevos</strong>
                  {unreadConversations.map((conversation) => (
                    <button key={conversation.id} type="button" onClick={() => openUnreadConversation(conversation)}>
                      <span>{conversation.title}</span>
                      <span className="workspace-unread-list__meta">
                        <small>{conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleString('es-ES') : 'Nuevo mensaje'}</small>
                        <b className="workspace-unread-list__badge">{getUnreadCount(conversation)}</b>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

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
                onSendMessage={handleSendMessageToTurin}
              />

              <div className="workspace-mobile-composer-stack">
                <ThreadComposer
                  selectedThread={selectedThread}
                  isBridgeEnabled={isGatewayBridgeEnabled}
                  isSending={isSendingMessage}
                  onSendMessage={handleSendMessageToTurin}
                />
              </div>
            </section>
          ) : null}

          {mobileView === 'material' ? (
            <section className="workspace-mobile-screen">
              <header className="workspace-mobile-screen__header">
                <button type="button" className="workspace-mobile-back" onClick={goBackFromCurrentView}>←</button>
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
            <button type="button" className={mobileView === 'chat' || mobileView === 'threads' || mobileView === 'project' ? 'workspace-mobile-nav__item workspace-mobile-nav__item--active' : 'workspace-mobile-nav__item'} onClick={() => setMobileView('chat')}>Chat{unreadMessagesCount ? <span className="workspace-mobile-nav__badge">{unreadMessagesCount}</span> : null}</button>
            <button type="button" className={mobileView === 'material' ? 'workspace-mobile-nav__item workspace-mobile-nav__item--active' : 'workspace-mobile-nav__item'} onClick={() => setMobileView('material')}>Material</button>
          </nav>
        </div>
      </div>
    </AdminLayout>
  )
}
