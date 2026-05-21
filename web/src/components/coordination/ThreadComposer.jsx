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
            <h3>Nueva conversación</h3>
            <p className="coordination-panel-copy">Abre un tema nuevo cuando quieras separar un proyecto, entrega o idea.</p>
          </div>
        </div>

        <form className="coordination-form" onSubmit={handleCreateThread}>
          <label>
            <span>Título</span>
            <input
              type="text"
              value={threadForm.title}
              onChange={(event) => setThreadForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Ej. Workspace, documentos para GestActas"
              required
            />
          </label>
          <label>
            <span>Resumen rápido</span>
            <textarea
              rows="3"
              value={threadForm.summary}
              onChange={(event) => setThreadForm((current) => ({ ...current, summary: event.target.value }))}
              placeholder="Qué quieres tratar aquí"
            />
          </label>
          <label>
            <span>Prioridad</span>
            <select
              value={threadForm.priority}
              onChange={(event) => setThreadForm((current) => ({ ...current, priority: event.target.value }))}
            >
              <option value="low">Baja</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </label>
          <button className="cta-admin-button cta-admin-button--green" type="submit" disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Crear conversación'}
          </button>
        </form>
      </section>

      <section className="coordination-subpanel">
        <div className="panel-header-row">
          <div>
            <h3>Escribir en la conversación</h3>
            <p className="coordination-panel-copy">
              {selectedThread ? `Ahora mismo estás en: ${selectedThread.title}` : 'Selecciona una conversación para seguir escribiendo.'}
            </p>
          </div>
        </div>

        <form className="coordination-form" onSubmit={handleCreateMessage}>
          <label>
            <span>Quién habla</span>
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
            <span>Tipo de mensaje</span>
            <select
              value={messageForm.messageType}
              onChange={(event) => setMessageForm((current) => ({ ...current, messageType: event.target.value }))}
              disabled={!selectedThread}
            >
              <option value="message">Mensaje</option>
              <option value="note">Nota</option>
              <option value="proposal">Propuesta</option>
              <option value="decision">Decisión</option>
            </select>
          </label>
          <label>
            <span>Texto</span>
            <textarea
              rows="4"
              value={messageForm.body}
              onChange={(event) => setMessageForm((current) => ({ ...current, body: event.target.value }))}
              placeholder="Escribe aquí como si siguiéramos el tema dentro del workspace"
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
              <span>Deja una acción pendiente</span>
            </label>
            <label className="invite-form__checkbox">
              <input
                type="checkbox"
                checked={messageForm.requiresResponse}
                onChange={(event) => setMessageForm((current) => ({ ...current, requiresResponse: event.target.checked }))}
                disabled={!selectedThread}
              />
              <span>Necesita respuesta</span>
            </label>
          </div>
          <button className="cta-admin-button cta-admin-button--blue" type="submit" disabled={!selectedThread || isSaving}>
            {isSaving ? 'Enviando...' : 'Enviar mensaje'}
          </button>
        </form>
      </section>
    </div>
  )
}
