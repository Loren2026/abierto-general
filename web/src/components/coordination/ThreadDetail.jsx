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

const roleLabels = {
  turin: 'Turín',
  loren: 'Loren',
  claude: 'Claude',
}

const originLabels = {
  internal: 'Workspace',
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
            Elige una conversación para seguir hablando conmigo desde aquí.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="coordination-panel coordination-panel--detail">
      <div className="selected-project-banner selected-project-banner--compact">
        <div>
          <strong>{thread.title}</strong>
          <p className="coordination-panel-copy">{thread.summary || 'Seguimos desde el último punto.'}</p>
        </div>
        <div className="thread-detail__badges">
          <span className={`project-status project-status--${thread.status}`}>{statusLabels[thread.status] || thread.status}</span>
        </div>
      </div>

      <div className="thread-detail__meta-inline">
        <span>{roleLabels[thread.assignedTo] || thread.assignedTo || 'Sin asignar'}</span>
        <span>•</span>
        <span>{originLabels[thread.origin] || thread.origin}</span>
        <span>•</span>
        <span>{formatDate(thread.lastMessageAt || thread.createdAt)}</span>
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
