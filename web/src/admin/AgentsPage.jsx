import { useEffect, useMemo, useState } from 'react'
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

export default function AgentsPage() {
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
      setActionMessage({ type: 'success', message: 'Hilo creado correctamente.' })
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
      setActionMessage({ type: 'success', message: 'Mensaje publicado.' })
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
      setActionMessage({ type: 'success', message: 'Consulta creada.' })
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
      setActionMessage({ type: 'success', message: 'Consulta respondida.' })
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
    <AdminLayout title="Coordinación de agentes" onLogout={handleLogout}>
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="security-banner">
            <div className="security-icon">🧭</div>
            <div className="security-text">
              <h3>Canal de coordinación interno</h3>
              <p>Hilos, mensajes y consultas operativas antes de elevar propuestas finales a Loren.</p>
            </div>
          </div>

          {actionMessage.message ? (
            <div className={`admin-notice admin-notice--${actionMessage.type === 'success' ? 'success' : 'error'}`}>
              {actionMessage.message}
            </div>
          ) : null}

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{isLoadingThreads ? '…' : metrics.totalThreads}</div>
              <div className="stat-label">Hilos totales</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{isLoadingThreads ? '…' : metrics.openThreads}</div>
              <div className="stat-label">Hilos open</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{isLoadingThreads ? '…' : metrics.blockedThreads}</div>
              <div className="stat-label">Hilos blocked</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{selectedThreadId ? metrics.pendingConsultations : '—'}</div>
              <div className="stat-label">Consultas pending</div>
            </div>
          </div>

          <div className="coordination-layout">
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
        </div>
      </div>
    </AdminLayout>
  )
}
