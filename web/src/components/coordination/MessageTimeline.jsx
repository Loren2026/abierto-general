function formatDate(value) {
  if (!value) return 'Sin fecha'

  try {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

export default function MessageTimeline({ messages, isLoading, error }) {
  return (
    <section className="coordination-subpanel">
      <div className="panel-header-row">
        <div>
          <h3>Mensajes</h3>
          <p className="coordination-panel-copy">Historial cronológico del hilo seleccionado.</p>
        </div>
      </div>

      {error ? <div className="error-message">{error}</div> : null}
      {isLoading ? <div className="admin-notice">Cargando mensajes...</div> : null}
      {!isLoading && !messages.length ? <div className="admin-notice">Todavía no hay mensajes en este hilo.</div> : null}

      <div className="message-timeline">
        {messages.map((message) => (
          <article key={message.id} className={`message-bubble message-bubble--${message.authorRole}`}>
            <div className="message-bubble__header">
              <div>
                <strong>{message.authorLabel}</strong>
                <span className="coordination-muted">{message.messageType}</span>
              </div>
              <span className="coordination-muted">{formatDate(message.createdAt)}</span>
            </div>
            <p>{message.body}</p>
            <div className="message-bubble__footer">
              {message.isActionable ? <span className="panel-header-pill">Accionable</span> : null}
              {message.requiresResponse ? <span className="panel-header-pill">Requiere respuesta</span> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
