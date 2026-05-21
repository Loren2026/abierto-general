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

const roadmap = [
  {
    title: 'Bloque 1, Workspace privado',
    status: 'en curso',
    items: [
      'Chat limpio y natural dentro del panel privado',
      'Acceso directo móvil y entrada rápida',
      'Centro documental base para dejar de depender de Telegram',
      'Índice rápido por proyectos y carpetas',
    ],
  },
  {
    title: 'Bloque 2, Habilidades y proyectos',
    status: 'pendiente',
    items: [
      'Catálogo de habilidades con estado y descripción',
      'Fichas de proyecto con prioridad, bloqueo y siguiente paso',
      'Navegación por carpetas y dominios de trabajo',
    ],
  },
  {
    title: 'Bloque 3, Automatización operativa',
    status: 'pendiente',
    items: [
      'Actualización diaria desde memoria y proyectos activos',
      'Panel de estado vivo con prioridades y bloqueos',
      'Sincronización con planning y decisiones',
    ],
  },
]

const quickAccessItems = [
  {
    title: 'Abrir chat contigo',
    description: 'Entrar directo en la conversación interna del workspace para continuar cualquier frente.',
    badge: 'Prioridad alta',
  },
  {
    title: 'Ver documentos recientes',
    description: 'Acceso rápido a entregables, borradores y materiales compartidos desde el panel privado.',
    badge: 'Siguiente bloque',
  },
  {
    title: 'Revisar proyectos activos',
    description: 'Entrar por carpetas y frentes de trabajo sin perderte en una sola conversación.',
    badge: 'Próximo',
  },
]

const documentSeeds = [
  {
    id: 'gestactas-juntas',
    name: 'GestActas, cierre bloque juntas',
    type: 'HTML',
    project: 'GestActas',
    status: 'Pendiente de adjunto real',
    description: 'Este hueco queda preparado para colgar pruebas, actas, borradores y entregables del bloque juntas.',
  },
  {
    id: 'mercado-valoracion',
    name: 'Análisis mercado, borrador valoración',
    type: 'HTML',
    project: 'Inteligencia Loren',
    status: 'Preparado',
    description: 'Base para ir colgando borradores de análisis y versiones revisables desde web.',
  },
  {
    id: 'workspace-docs',
    name: 'Workspace privado, documentación viva',
    type: 'PDF / DOC / IMG',
    project: 'Workspace',
    status: 'Base inicial',
    description: 'Espacio destinado a entregables, capturas, PDFs y materiales que Telegram no deja consumir bien.',
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

  return (
    <AdminLayout title="Workspace privado" onLogout={handleLogout}>
      <div className="dashboard-container workspace-page">
        <div className="dashboard-content">
          <div className="security-banner workspace-hero">
            <div className="security-icon">🧩</div>
            <div className="security-text">
              <h3>Workspace privado de Inteligencia Loren</h3>
              <p>Tu espacio central para hablar conmigo, abrir materiales y entrar por proyectos sin perderte entre chats.</p>
            </div>
          </div>

          {actionMessage.message ? (
            <div className={`admin-notice admin-notice--${actionMessage.type === 'success' ? 'success' : 'error'}`}>
              {actionMessage.message}
            </div>
          ) : null}

          <section className="workspace-section workspace-section--compact">
            <div className="workspace-section__header">
              <div>
                <h2>Lo que queda dentro de este primer bloque</h2>
                <p className="coordination-panel-copy">He dejado resueltos los tres pasos base para que el workspace ya tenga forma real.</p>
              </div>
              <Link className="cta-admin-button cta-admin-button--blue" to="/admin">Volver al panel principal</Link>
            </div>

            <div className="project-list">
              {roadmap.map((block) => (
                <article key={block.title} className="project-card" style={{ cursor: 'default' }}>
                  <div className="project-card__header">
                    <h3>{block.title}</h3>
                    <span className={`project-status project-status--${block.status === 'en curso' ? 'public' : 'draft'}`}>{block.status}</span>
                  </div>
                  <ul className="next-steps-list">
                    {block.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="workspace-section">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{isLoadingThreads ? '…' : metrics.totalThreads}</div>
                <div className="stat-label">Conversaciones</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{isLoadingThreads ? '…' : metrics.openThreads}</div>
                <div className="stat-label">Abiertas</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{isLoadingThreads ? '…' : metrics.blockedThreads}</div>
                <div className="stat-label">Bloqueadas</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{selectedThreadId ? metrics.pendingConsultations : '—'}</div>
                <div className="stat-label">Recordatorios pendientes</div>
              </div>
            </div>
          </section>

          <section className="workspace-section workspace-section--chat">
            <div className="workspace-section__header">
              <div>
                <h2>Chat del workspace</h2>
                <p className="coordination-panel-copy">Pensado para sentirse como una conversación real contigo, no como una consola interna.</p>
              </div>
            </div>

            <div className="workspace-chat-intro">
              <div className="workspace-chat-intro__card">
                <strong>Cómo usarlo ahora</strong>
                <p>Abre una conversación por proyecto o por tema, escríbeme dentro y deja también decisiones o recordatorios para no perder contexto.</p>
              </div>
              <div className="workspace-chat-intro__card">
                <strong>Para qué sirve mejor</strong>
                <p>GestActas, análisis, entregables, revisiones y cualquier frente donde quieras separar mejor los temas.</p>
              </div>
            </div>

            <div className="coordination-layout workspace-chat-layout">
              <ThreadList
                threads={threads}
                selectedThreadId={selectedThreadId}
                isLoading={isLoadingThreads}
                error={threadsError}
                filters={filters}
                onFilterChange={handleFilterChange}
                onSelectThread={setSelectedThreadId}
              />

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
            </div>

            <ThreadComposer
              selectedThread={selectedThread}
              onCreateThread={handleCreateThread}
              onCreateMessage={handleCreateMessage}
              isSaving={isSaving}
            />

            <ConsultationComposer
              selectedThread={selectedThread}
              onCreateConsultation={handleCreateConsultation}
              isSaving={isSaving}
            />
          </section>

          <section className="workspace-section">
            <div className="workspace-section__header">
              <div>
                <h2>Acceso directo</h2>
                <p className="coordination-panel-copy">Base pensada para entrar rápido desde móvil y abrir justo lo importante.</p>
              </div>
            </div>

            <div className="workspace-quick-grid">
              {quickAccessItems.map((item) => (
                <article key={item.title} className="workspace-quick-card">
                  <div className="workspace-quick-card__header">
                    <h3>{item.title}</h3>
                    <span className="panel-header-pill">{item.badge}</span>
                  </div>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>

            <div className="workspace-shortcut-banner">
              <div>
                <strong>URL privada a fijar en pantalla de inicio</strong>
                <p>Cuando terminemos de pulir el flujo, este workspace puede funcionar como entrada directa diaria desde el móvil.</p>
              </div>
              <span className="panel-header-pill">/admin/workspace</span>
            </div>
          </section>

          <section className="workspace-section">
            <div className="workspace-section__header">
              <div>
                <h2>Módulo documental</h2>
                <p className="coordination-panel-copy">Base visible para empezar a centralizar archivos, entregables y materiales fuera de Telegram.</p>
              </div>
            </div>

            <div className="workspace-doc-toolbar">
              <div className="workspace-doc-toolbar__item">
                <strong>Tipos previstos</strong>
                <span>PDF, HTML, imágenes, Word, Excel, PowerPoint y otros adjuntos</span>
              </div>
              <div className="workspace-doc-toolbar__item">
                <strong>Primer objetivo</strong>
                <span>Listar, abrir y relacionar documentos con proyecto y conversación</span>
              </div>
            </div>

            <div className="workspace-doc-grid">
              {documentSeeds.map((document) => (
                <article key={document.id} className="workspace-doc-card">
                  <div className="workspace-doc-card__header">
                    <div>
                      <h3>{document.name}</h3>
                      <p>{document.project}</p>
                    </div>
                    <span className="panel-header-pill">{document.type}</span>
                  </div>
                  <p className="workspace-doc-card__description">{document.description}</p>
                  <div className="workspace-doc-card__footer">
                    <span>{document.status}</span>
                    <button type="button" className="cta-admin-button cta-admin-button--green" disabled>
                      Próximo, conectar visor
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AdminLayout>
  )
}
