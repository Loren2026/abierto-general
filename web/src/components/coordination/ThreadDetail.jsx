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
          <h2>Selecciona un hilo</h2>
          <p className="agents-placeholder-copy">
            Elige un hilo de la columna izquierda para ver mensajes, consultas y responder en contexto.
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
          <span className={`project-status project-status--${thread.status}`}>{thread.status}</span>
          <span className="panel-header-pill">{thread.priority}</span>
        </div>
      </div>

      <div className="coordination-meta-grid info-card">
        <div className="info-item"><label>Creado por:</label><span>{thread.createdByLabel}</span></div>
        <div className="info-item"><label>Origen:</label><span>{thread.origin}</span></div>
        <div className="info-item"><label>Asignado a:</label><span>{thread.assignedTo || 'Sin asignar'}</span></div>
        <div className="info-item"><label>Última actividad:</label><span>{formatDate(thread.lastMessageAt || thread.createdAt)}</span></div>
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
