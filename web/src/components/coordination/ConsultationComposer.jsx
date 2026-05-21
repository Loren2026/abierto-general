import { useState } from 'react'

const initialForm = {
  requestedToRole: 'claude',
  consultationType: 'review',
  question: '',
}

export default function ConsultationComposer({ selectedThread, onCreateConsultation, isSaving }) {
  const [form, setForm] = useState(initialForm)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!selectedThread) return

    const result = await onCreateConsultation({
      consultationType: form.consultationType,
      requestedByRole: 'turin',
      requestedToRole: form.requestedToRole,
      question: form.question,
      metadata: {},
    })

    if (result?.success) setForm(initialForm)
  }

  return (
    <section className="coordination-subpanel">
      <div className="panel-header-row">
        <div>
          <h3>Nuevo recordatorio o consulta</h3>
          <p className="coordination-panel-copy">
            {selectedThread ? `Quedará guardado dentro de: ${selectedThread.title}` : 'Selecciona una conversación para dejar un recordatorio o una consulta.'}
          </p>
        </div>
      </div>

      <form className="coordination-form" onSubmit={handleSubmit}>
        <label>
          <span>Dirigido a</span>
          <select
            value={form.requestedToRole}
            onChange={(event) => setForm((current) => ({ ...current, requestedToRole: event.target.value }))}
            disabled={!selectedThread}
          >
            <option value="claude">Claude</option>
            <option value="loren">Loren</option>
            <option value="turin">Turín</option>
          </select>
        </label>
        <label>
          <span>Tipo</span>
          <select
            value={form.consultationType}
            onChange={(event) => setForm((current) => ({ ...current, consultationType: event.target.value }))}
            disabled={!selectedThread}
          >
            <option value="review">Revisión</option>
            <option value="proposal">Propuesta</option>
            <option value="risk_check">Revisión de riesgo</option>
            <option value="decision_request">Petición de decisión</option>
            <option value="clarification">Aclaración</option>
          </select>
        </label>
        <label>
          <span>Texto</span>
          <textarea
            rows="4"
            value={form.question}
            onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))}
            placeholder="Escribe aquí la duda, decisión pendiente o seguimiento"
            disabled={!selectedThread}
            required
          />
        </label>
        <button className="cta-admin-button cta-admin-button--orange" type="submit" disabled={!selectedThread || isSaving}>
          {isSaving ? 'Guardando...' : 'Guardar recordatorio'}
        </button>
      </form>
    </section>
  )
}
