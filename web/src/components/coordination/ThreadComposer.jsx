import { useState } from 'react'

const initialMessageForm = {
  authorRole: 'turin',
  body: '',
  messageType: 'message',
  isActionable: false,
  requiresResponse: false,
}

const initialThreadForm = {
  title: '',
  summary: '',
  priority: 'normal',
}

export default function ThreadComposer({ selectedThread, onCreateThread, onCreateMessage, isSaving }) {
  const [threadForm, setThreadForm] = useState(initialThreadForm)
  const [messageForm, setMessageForm] = useState(initialMessageForm)

  async function handleCreateThread(event) {
    event.preventDefault()
    const result = await onCreateThread({
      title: threadForm.title,
      summary: threadForm.summary,
      priority: threadForm.priority,
      origin: 'internal',
      createdByType: 'human',
      createdByLabel: 'Loren',
      assignedTo: 'turin',
      metadata: {},
    })

    if (result?.success) setThreadForm(initialThreadForm)
  }

  async function handleCreateMessage(event) {
    event.preventDefault()
    if (!selectedThread) return

    const labelMap = {
      loren: 'Loren',
      turin: 'Turín',
      claude: 'Claude',
      system: 'System',
    }

    const result = await onCreateMessage({
      messageType: messageForm.messageType,
      authorType: messageForm.authorRole === 'loren' ? 'human' : 'assistant',
      authorRole: messageForm.authorRole,
      authorLabel: labelMap[messageForm.authorRole],
      body: messageForm.body,
      bodyFormat: 'plain_text',
      visibility: 'internal',
      isActionable: messageForm.isActionable,
      requiresResponse: messageForm.requiresResponse,
      metadata: {},
    })

    if (result?.success) setMessageForm(initialMessageForm)
  }

  return (
    <div className="coordination-composer-grid">
      <section className="coordination-subpanel">
        <div className="panel-header-row">
          <div>
            <h3>Nuevo hilo</h3>
            <p className="coordination-panel-copy">Abrir un nuevo frente de coordinación.</p>
          </div>
        </div>

        <form className="coordination-form" onSubmit={handleCreateThread}>
          <label>
            <span>Título</span>
            <input
              type="text"
              value={threadForm.title}
              onChange={(event) => setThreadForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ej. Canal GestActas B7"
              required
            />
          </label>
          <label>
            <span>Resumen</span>
            <textarea
              rows="3"
              value={threadForm.summary}
              onChange={(event) => setThreadForm((current) => ({ ...current, summary: event.target.value }))}
              placeholder="Contexto rápido del hilo"
            />
          </label>
          <label>
            <span>Prioridad</span>
            <select
              value={threadForm.priority}
              onChange={(event) => setThreadForm((current) => ({ ...current, priority: event.target.value }))}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <button className="cta-admin-button cta-admin-button--green" type="submit" disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Crear hilo'}
          </button>
        </form>
      </section>

      <section className="coordination-subpanel">
        <div className="panel-header-row">
          <div>
            <h3>Nuevo mensaje</h3>
            <p className="coordination-panel-copy">
              {selectedThread ? `Publicar en: ${selectedThread.title}` : 'Selecciona un hilo para publicar mensajes.'}
            </p>
          </div>
        </div>

        <form className="coordination-form" onSubmit={handleCreateMessage}>
          <label>
            <span>Autor</span>
            <select
              value={messageForm.authorRole}
              onChange={(event) => setMessageForm((current) => ({ ...current, authorRole: event.target.value }))}
              disabled={!selectedThread}
            >
              <option value="turin">Turín</option>
              <option value="claude">Claude</option>
              <option value="loren">Loren</option>
            </select>
          </label>
          <label>
            <span>Tipo</span>
            <select
              value={messageForm.messageType}
              onChange={(event) => setMessageForm((current) => ({ ...current, messageType: event.target.value }))}
              disabled={!selectedThread}
            >
              <option value="message">Message</option>
              <option value="note">Note</option>
              <option value="proposal">Proposal</option>
              <option value="decision">Decision</option>
            </select>
          </label>
          <label>
            <span>Mensaje</span>
            <textarea
              rows="4"
              value={messageForm.body}
              onChange={(event) => setMessageForm((current) => ({ ...current, body: event.target.value }))}
              placeholder="Escribe aquí el mensaje operativo"
              disabled={!selectedThread}
              required
            />
          </label>
          <div className="coordination-checkbox-row">
            <label className="invite-form__checkbox">
              <input
                type="checkbox"
                checked={messageForm.isActionable}
                onChange={(event) => setMessageForm((current) => ({ ...current, isActionable: event.target.checked }))}
                disabled={!selectedThread}
              />
              <span>Accionable</span>
            </label>
            <label className="invite-form__checkbox">
              <input
                type="checkbox"
                checked={messageForm.requiresResponse}
                onChange={(event) => setMessageForm((current) => ({ ...current, requiresResponse: event.target.checked }))}
                disabled={!selectedThread}
              />
              <span>Requiere respuesta</span>
            </label>
          </div>
          <button className="cta-admin-button cta-admin-button--blue" type="submit" disabled={!selectedThread || isSaving}>
            {isSaving ? 'Publicando...' : 'Publicar mensaje'}
          </button>
        </form>
      </section>
    </div>
  )
}
