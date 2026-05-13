import { useState } from 'react'
import ConsultationResponseForm from './ConsultationResponseForm'

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

export default function ConsultationList({ consultations, isLoading, error, onRespond, isSaving }) {
  const [openResponseId, setOpenResponseId] = useState(null)

  return (
    <section className="coordination-subpanel">
      <div className="panel-header-row">
        <div>
          <h3>Consultas</h3>
          <p className="coordination-panel-copy">Consultas abiertas y resueltas dentro del hilo.</p>
        </div>
      </div>

      {error ? <div className="error-message">{error}</div> : null}
      {isLoading ? <div className="admin-notice">Cargando consultas...</div> : null}
      {!isLoading && !consultations.length ? <div className="admin-notice">No hay consultas registradas.</div> : null}

      <div className="consultation-list">
        {consultations.map((consultation) => (
          <article key={consultation.id} className={`consultation-card consultation-card--${consultation.status}`}>
            <div className="consultation-card__header">
              <div>
                <strong>{consultation.requestedByRole} → {consultation.requestedToRole}</strong>
                <span className="coordination-muted">{consultation.consultationType}</span>
              </div>
              <span className={`project-status project-status--${consultation.status}`}>{consultation.status}</span>
            </div>
            <p className="consultation-card__question">{consultation.question}</p>
            {consultation.responseText ? (
              <div className="consultation-card__response">
                <strong>Respuesta</strong>
                <p>{consultation.responseText}</p>
              </div>
            ) : null}
            <div className="consultation-card__footer">
              <span>{formatDate(consultation.requestedAt)}</span>
              {consultation.respondedAt ? <span>Respondida: {formatDate(consultation.respondedAt)}</span> : null}
            </div>
            {consultation.status === 'pending' ? (
              <div className="consultation-card__actions">
                <button
                  type="button"
                  className="cta-admin-button cta-admin-button--orange"
                  onClick={() => setOpenResponseId((current) => current === consultation.id ? null : consultation.id)}
                >
                  {openResponseId === consultation.id ? 'Ocultar respuesta' : 'Responder'}
                </button>
                {openResponseId === consultation.id ? (
                  <ConsultationResponseForm consultation={consultation} onSubmit={onRespond} isSaving={isSaving} />
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
