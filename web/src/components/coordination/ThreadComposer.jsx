import { useState } from 'react'

export default function ThreadComposer({ selectedThread }) {
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState('')

  function showPlaceholder(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2500)
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
        placeholder={selectedThread ? `Escribe para ${selectedThread.title}…` : 'Escribe en Chat libre/general…'}
        rows="1"
      />
      <button
        className="workspace-chat-send"
        type="button"
        onClick={() => showPlaceholder('Enviar estará disponible en F2.')}
      >
        Enviar
      </button>
      {notice ? <small className="workspace-chat-composer__notice">{notice}</small> : null}
    </section>
  )
}
