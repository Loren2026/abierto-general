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
          <h3>Nueva consulta</h3>
          <p className="coordination-panel-copy">
            {selectedThread ? `Registrar consulta en: ${selectedThread.title}` : 'Selecciona un hilo para abrir una consulta.'}
          </p>
        </div>
      </div>

      <form className="coordination-form" onSubmit={handleSubmit}>
        <label>
          <span>Dirigida a</span>
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
            <option value="review">Review</option>
            <option value="proposal">Proposal</option>
            <option value="risk_check">Risk check</option>
            <option value="decision_request">Decision request</option>
            <option value="clarification">Clarification</option>
          </select>
        </label>
        <label>
          <span>Pregunta</span>
          <textarea
            rows="4"
            value={form.question}
            onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))}
            placeholder="Escribe aquí la consulta"
            disabled={!selectedThread}
            required
          />
        </label>
        <button className="cta-admin-button cta-admin-button--orange" type="submit" disabled={!selectedThread || isSaving}>
          {isSaving ? 'Guardando...' : 'Crear consulta'}
        </button>
      </form>
    </section>
  )
}
