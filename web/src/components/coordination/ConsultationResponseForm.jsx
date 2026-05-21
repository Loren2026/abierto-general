import { useState } from 'react'

export default function ConsultationResponseForm({ consultation, onSubmit, isSaving }) {
  const [status, setStatus] = useState('answered')
  const [responseText, setResponseText] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    const result = await onSubmit(consultation.id, {
      status,
      responseText,
      metadata: {},
    })

    if (result?.success) {
      setStatus('answered')
      setResponseText('')
    }
  }

  return (
    <form className="coordination-response-form" onSubmit={handleSubmit}>
      <label>
        <span>Cómo queda</span>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="answered">Respondida</option>
          <option value="cancelled">Cancelada</option>
          <option value="superseded">Sustituida</option>
        </select>
      </label>
      <label>
        <span>Respuesta</span>
        <textarea
          rows="3"
          value={responseText}
          onChange={(event) => setResponseText(event.target.value)}
          placeholder="Respuesta o cierre de este recordatorio"
        />
      </label>
      <button className="cta-admin-button cta-admin-button--green" type="submit" disabled={isSaving}>
        {isSaving ? 'Guardando...' : 'Guardar respuesta'}
      </button>
    </form>
  )
}
