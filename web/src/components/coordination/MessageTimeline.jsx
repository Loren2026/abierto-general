import { useEffect, useRef } from 'react'

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

const typeLabels = {
  message: 'Mensaje',
  note: 'Nota',
  proposal: 'Propuesta',
  decision: 'Decisión',
  system: 'Sistema',
}

function getBubbleSide(message) {
  if (message.authorRole === 'loren') return 'right'
  if (message.authorRole === 'system') return 'center'
  return 'left'
}

export default function MessageTimeline({ messages, isLoading, error }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, isLoading])

  return (
    <section className="workspace-chat-panel">
      {error ? <div className="error-message">{error}</div> : null}
      {isLoading ? <div className="admin-notice">Cargando mensajes...</div> : null}
      {!isLoading && !messages.length ? (
        <div className="workspace-chat-empty">
          <strong>Chat listo.</strong>
          <p>F1 solo prepara la estructura. El envío real a Turín llegará en F2.</p>
        </div>
      ) : null}

      <div className="message-timeline message-timeline--chat">
        {messages.map((message) => {
          const side = getBubbleSide(message)
          return (
            <article
              key={message.id}
              className={`message-bubble message-bubble--${message.authorRole} message-bubble--${side}`}
            >
              <div className="message-bubble__header">
                <strong>{message.authorLabel}</strong>
                <span>{formatDate(message.createdAt)}</span>
              </div>
              <p>{message.body}</p>
              <div className="message-bubble__footer">
                <span>{typeLabels[message.messageType] || message.messageType}</span>
                {message.isActionable ? <span>Acción pendiente</span> : null}
                {message.requiresResponse ? <span>Necesita respuesta</span> : null}
              </div>
            </article>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </section>
  )
}
