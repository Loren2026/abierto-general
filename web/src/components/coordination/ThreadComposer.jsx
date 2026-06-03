import { useState } from 'react'

export default function ThreadComposer({
  selectedThread,
  isBridgeEnabled = false,
  isSending = false,
  onSendMessage,
}) {
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')

  function showPlaceholder(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2500)
  }

  async function handleSend() {
    const body = draft.trim()

    if (!isBridgeEnabled) {
      showPlaceholder('El puente con Turín no está disponible ahora.')
      return
    }

    if (!selectedThread?.threadId && !selectedThread?.projectId) {
      showPlaceholder('Esta conversación todavía no tiene hilo real.')
      return
    }

    if (!body || isSending) return

    const sent = await onSendMessage?.(body)
    if (sent) setDraft('')
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <section className="workspace-chat-input-placeholder workspace-chat-composer">
      <button
        className="workspace-chat-clip"
        type="button"
        aria-label="Adjuntar archivo"
        onClick={() => showPlaceholder('Adjuntos disponibles en F3.')}
      >
        📎
      </button>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={selectedThread ? `Escribe para ${selectedThread.title}…` : 'Escribe en Chat libre/general…'}
        rows="1"
        disabled={isSending}
      />
      <button
        className="workspace-chat-send"
        type="button"
        onClick={handleSend}
        disabled={isSending || (isBridgeEnabled && !draft.trim())}
      >
        {isSending ? 'Enviando…' : 'Enviar'}
      </button>
      {notice ? <small className="workspace-chat-composer__notice">{notice}</small> : null}
    </section>
  )
}
