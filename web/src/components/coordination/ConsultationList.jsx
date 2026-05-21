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

const roleLabels = {
  turin: 'Turín',
  loren: 'Loren',
  claude: 'Claude',
}

const typeLabels = {
  review: 'Revisión',
  proposal: 'Propuesta',
  risk_check: 'Revisión de riesgo',
  decision_request: 'Petición de decisión',
  clarification: 'Aclaración',
}

const statusLabels = {
  pending: 'Pendiente',
  answered: 'Respondida',
  cancelled: 'Cancelada',
  superseded: 'Sustituida',
}

export default function ConsultationList({ consultations, isLoading, error, onRespond, isSaving }) {
  const [openResponseId, setOpenResponseId] = useState(null)

  return (
    <section className="coordination-subpanel">
      <div className="panel-header-row">
        <div>
          <h3>Recordatorios y consultas</h3>
          <p className="coordination-panel-copy">Aquí quedan apuntadas las preguntas, decisiones y seguimientos que no conviene perder.</p>
        </div>
      </div>

      {error ? <div className="error-message">{error}</div> : null}
      {isLoading ? <div className="admin-notice">Cargando recordatorios...</div> : null}
      {!isLoading && !consultations.length ? <div className="admin-notice">No hay recordatorios ni consultas todavía.</div> : null}

      <div className="consultation-list">
        {consultations.map((consultation) => (
          <article key={consultation.id} className={`consultation-card consultation-card--${consultation.status}`}>
            <div className="consultation-card__header">
              <div>
                <strong>{roleLabels[consultation.requestedByRole] || consultation.requestedByRole} → {roleLabels[consultation.requestedToRole] || consultation.requestedToRole}</strong>
                <span className="coordination-muted">{typeLabels[consultation.consultationType] || consultation.consultationType}</span>
              </div>
              <span className={`project-status project-status--${consultation.status}`}>{statusLabels[consultation.status] || consultation.status}</span>
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
                  {openResponseId === consultation.id ? 'Ocultar respuesta' : 'Responder ahora'}
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
