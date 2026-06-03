import { useEffect, useRef, useState } from 'react'

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

function getBubbleSide(message) {
  if (message.authorRole === 'loren') return 'right'
  if (message.authorRole === 'system') return 'center'
  return 'left'
}

async function copyMessageText(text, onCopied) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }

  onCopied?.()
}

export default function MessageTimeline({
  messages,
  isLoading,
  error,
  copiedMessageId,
  deletingMessageId,
  onCopyMessage,
  onDeleteMessage,
  onSendMessage,
}) {
  const bottomRef = useRef(null)
  const longPressTimerRef = useRef(null)
  const [activeMessageId, setActiveMessageId] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  const [editDraft, setEditDraft] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, isLoading])

  useEffect(() => () => window.clearTimeout(longPressTimerRef.current), [])

  function startLongPress(message) {
    window.clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = window.setTimeout(() => setActiveMessageId(message.id), 520)
  }

  function cancelLongPress() {
    window.clearTimeout(longPressTimerRef.current)
  }

  function startEdit(message) {
    setActiveMessageId(null)
    setReplyingTo(null)
    setEditingMessage(message)
    setEditDraft(message.body)
  }

  function startReply(message) {
    setActiveMessageId(null)
    setEditingMessage(null)
    setReplyingTo(message)
    setReplyDraft('')
  }

  async function submitEdit() {
    const body = editDraft.trim()
    if (!body || isSubmittingAction) return

    setIsSubmittingAction(true)
    const sent = await onSendMessage?.(body)
    setIsSubmittingAction(false)
    if (sent) {
      setEditingMessage(null)
      setEditDraft('')
    }
  }

  async function submitReply() {
    const body = replyDraft.trim()
    if (!body || !replyingTo || isSubmittingAction) return

    setIsSubmittingAction(true)
    const sent = await onSendMessage?.(body, { replyTo: replyingTo })
    setIsSubmittingAction(false)
    if (sent) {
      setReplyingTo(null)
      setReplyDraft('')
    }
  }

  return (
    <section className="workspace-chat-panel" onClick={() => setActiveMessageId(null)}>
      {error ? <div className="error-message">{error}</div> : null}
      {isLoading ? <div className="admin-notice">Cargando mensajes...</div> : null}
      {!isLoading && !messages.length ? (
        <div className="workspace-chat-empty">
          <strong>Chat listo.</strong>
          <p>Escribe el primer mensaje para iniciar la conversación real con Turín.</p>
        </div>
      ) : null}

      <div className="message-timeline message-timeline--chat">
        {messages.map((message) => {
          const side = getBubbleSide(message)
          const isActive = activeMessageId === message.id
          return (
            <article
              key={message.id}
              className={`message-bubble message-bubble--${message.authorRole} message-bubble--${side}`}
              onMouseDown={() => startLongPress(message)}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onTouchStart={() => startLongPress(message)}
              onTouchEnd={cancelLongPress}
              onContextMenu={(event) => {
                event.preventDefault()
                setActiveMessageId(message.id)
              }}
            >
              <div className="message-bubble__content" onClick={(event) => event.stopPropagation()}>
                <div className="message-bubble__header">
                  <strong>{message.authorLabel}</strong>
                  <span>{formatDate(message.createdAt)}</span>
                </div>
                <p>{message.body}</p>
                {isActive ? (
                  <div className="message-action-card">
                    <button type="button" onClick={() => copyMessageText(message.body, () => onCopyMessage?.(message.id))}>
                      {copiedMessageId === message.id ? 'Copiado' : 'Copiar'}
                    </button>
                    <button type="button" onClick={() => onDeleteMessage?.(message)} disabled={deletingMessageId === message.id}>
                      {deletingMessageId === message.id ? 'Eliminando…' : 'Eliminar'}
                    </button>
                    <button type="button" onClick={() => startEdit(message)}>Editar</button>
                    <button type="button" onClick={() => startReply(message)}>Responder</button>
                  </div>
                ) : null}
              </div>
            </article>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {editingMessage ? (
        <div className="message-inline-editor">
          <strong>Editar y reenviar</strong>
          <textarea value={editDraft} onChange={(event) => setEditDraft(event.target.value)} rows="3" />
          <div>
            <button type="button" onClick={() => setEditingMessage(null)}>Cancelar</button>
            <button type="button" onClick={submitEdit} disabled={isSubmittingAction || !editDraft.trim()}>Guardar/reenviar</button>
          </div>
        </div>
      ) : null}

      {replyingTo ? (
        <div className="message-inline-editor">
          <strong>Responder a {replyingTo.authorLabel}</strong>
          <blockquote>{replyingTo.body}</blockquote>
          <textarea value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} rows="3" />
          <div>
            <button type="button" onClick={() => setReplyingTo(null)}>Cancelar</button>
            <button type="button" onClick={submitReply} disabled={isSubmittingAction || !replyDraft.trim()}>Responder</button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
