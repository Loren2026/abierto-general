import MessageTimeline from './MessageTimeline'
import ConsultationList from './ConsultationList'

function formatDate(value) {
  if (!value) return 'No disponible'

  try {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

const statusLabels = {
  open: 'Abierta',
  pending_review: 'Pendiente de revisar',
  blocked: 'Bloqueada',
  closed: 'Cerrada',
  archived: 'Archivada',
}

const priorityLabels = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
}

const roleLabels = {
  turin: 'Turín',
  loren: 'Loren',
  claude: 'Claude',
}

const originLabels = {
  internal: 'Workspace privado',
  telegram: 'Telegram',
  web: 'Web',
}

export default function ThreadDetail({
  thread,
  messages,
  consultations,
  isLoadingMessages,
  isLoadingConsultations,
  messagesError,
  consultationsError,
  onRespondConsultation,
  isSaving,
}) {
  if (!thread) {
    return (
      <div className="coordination-panel coordination-panel--detail">
        <div className="info-card">
          <h2>Abre una conversación</h2>
          <p className="agents-placeholder-copy">
            Elige una conversación de la columna izquierda para seguir hablando conmigo, ver el historial y dejar recordatorios.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="coordination-panel coordination-panel--detail">
      <div className="selected-project-banner">
        <div>
          <strong>{thread.title}</strong>
          <p className="coordination-panel-copy">{thread.summary || 'Sin resumen todavía.'}</p>
        </div>
        <div className="thread-detail__badges">
          <span className={`project-status project-status--${thread.status}`}>{statusLabels[thread.status] || thread.status}</span>
          <span className="panel-header-pill">{priorityLabels[thread.priority] || thread.priority}</span>
        </div>
      </div>

      <div className="coordination-meta-grid info-card">
        <div className="info-item"><label>Abierta por:</label><span>{thread.createdByLabel}</span></div>
        <div className="info-item"><label>Origen:</label><span>{originLabels[thread.origin] || thread.origin}</span></div>
        <div className="info-item"><label>Llevando el hilo:</label><span>{roleLabels[thread.assignedTo] || thread.assignedTo || 'Sin asignar'}</span></div>
        <div className="info-item"><label>Último movimiento:</label><span>{formatDate(thread.lastMessageAt || thread.createdAt)}</span></div>
      </div>

      <div className="coordination-detail-stack">
        <MessageTimeline messages={messages} isLoading={isLoadingMessages} error={messagesError} />
        <ConsultationList
          consultations={consultations}
          isLoading={isLoadingConsultations}
          error={consultationsError}
          onRespond={onRespondConsultation}
          isSaving={isSaving}
        />
      </div>
    </div>
  )
}
