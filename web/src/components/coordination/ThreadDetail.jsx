import MessageTimeline from './MessageTimeline'

function formatDate(value) {
  if (!value) return 'Sin actividad todavía'

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
  general: 'General',
  open: 'Abierta',
  pending_review: 'Pendiente',
  blocked: 'Bloqueada',
  closed: 'Cerrada',
  archived: 'Archivada',
  public: 'Publicado',
  private: 'Privado',
  draft: 'Borrador',
}

export default function ThreadDetail({
  thread,
  messages,
  isLoadingMessages,
  messagesError,
}) {
  if (!thread) {
    return (
      <div className="workspace-chat-panel workspace-chat-panel--empty">
        <div className="workspace-chat-empty">
          <strong>Chat libre/general</strong>
          <p>Elige una conversación del desplegable para verla aquí.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="workspace-chat-shell">
      <div className="workspace-chat-titlebar">
        <div>
          <strong>{thread.title}</strong>
          <p>{thread.summary || 'Conversación continua del proyecto.'}</p>
        </div>
        <span className={`project-status project-status--${thread.status}`}>{statusLabels[thread.status] || thread.status}</span>
      </div>

      <div className="thread-detail__meta-inline">
        <span>Última actividad: {formatDate(thread.lastMessageAt || thread.createdAt)}</span>
      </div>

      <MessageTimeline messages={messages} isLoading={isLoadingMessages} error={messagesError} />
    </div>
  )
}
