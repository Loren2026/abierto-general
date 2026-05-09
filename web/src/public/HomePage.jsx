import { useMemo, useState } from 'react'
import emailjs from '@emailjs/browser'
import PublicLayout from '../components/layout/PublicLayout'

const initialForm = {
  fullName: '',
  email: '',
  phone: '',
  interest: '',
  message: '',
  privacyAccepted: false,
}

const featureCards = [
  {
    title: 'Herramientas privadas',
    copy: 'Accesos habilitados individualmente para proyectos y recursos seleccionados por Loren.',
  },
  {
    title: 'Recursos exclusivos',
    copy: 'Contenido curado y organizado para que cada persona vea solo lo que realmente necesita.',
  },
  {
    title: 'Apps seleccionadas',
    copy: 'Aplicaciones, materiales y descargas controladas con seguimiento y validación.',
  },
  {
    title: 'Accesos personalizados',
    copy: 'Cada invitación se concede con criterio, según proyecto, momento y uso previsto.',
  },
]

const publishedProjects = []

const flowSteps = [
  {
    title: 'Recibes tu invitación o tu código',
    copy: 'Loren habilita el acceso de forma individual para cada usuario.',
  },
  {
    title: 'Accedes al proyecto autorizado',
    copy: 'Solo ves el contenido que realmente tienes permitido usar.',
  },
  {
    title: 'Activas tu acceso',
    copy: 'El sistema valida el acceso y lo vincula correctamente.',
  },
  {
    title: 'Descargas o utilizas tu contenido',
    copy: 'Todo de forma sencilla, privada y organizada.',
  },
]

function getEmailJsConfig() {
  return {
    serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID,
    templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
    publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
    toEmail: import.meta.env.VITE_INVITATION_TO_EMAIL || 'Loren',
  }
}

export default function HomePage() {
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [formData, setFormData] = useState(initialForm)
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const emailJsConfig = useMemo(getEmailJsConfig, [])

  function updateField(field, value) {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  function openInvite() {
    setIsInviteOpen(true)
    setStatus({ type: 'idle', message: '' })
  }

  function closeInvite() {
    setIsInviteOpen(false)
  }

  function hasFullNameAndSurname(value) {
    const parts = value.trim().split(/\s+/).filter(Boolean)
    return parts.length >= 2
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus({ type: 'idle', message: '' })

    if (!hasFullNameAndSurname(formData.fullName)) {
      setStatus({ type: 'error', message: 'Introduce tu nombre y tu primer apellido.' })
      return
    }

    if (!formData.email.trim()) {
      setStatus({ type: 'error', message: 'El correo electrónico es obligatorio.' })
      return
    }

    if (!formData.phone.trim()) {
      setStatus({ type: 'error', message: 'El teléfono o WhatsApp es obligatorio.' })
      return
    }

    if (formData.interest.trim() && !publishedProjects.includes(formData.interest.trim())) {
      setStatus({
        type: 'error',
        message: 'Si indicas un proyecto, debe coincidir exactamente con uno de los proyectos publicados disponibles.',
      })
      return
    }

    if (!formData.privacyAccepted) {
      setStatus({ type: 'error', message: 'Debes aceptar la política de privacidad para enviar la solicitud.' })
      return
    }

    if (!emailJsConfig.serviceId || !emailJsConfig.templateId || !emailJsConfig.publicKey) {
      setStatus({
        type: 'error',
        message:
          'El formulario está listo, pero EmailJS aún no está configurado en este entorno. Añade las variables VITE_EMAILJS_* para activarlo.',
      })
      return
    }

    setIsSubmitting(true)

    try {
      await emailjs.send(
        emailJsConfig.serviceId,
        emailJsConfig.templateId,
        {
          full_name: formData.fullName.trim(),
          reply_to: formData.email.trim(),
          phone: formData.phone.trim() || 'No facilitado',
          interest: formData.interest.trim(),
          message: formData.message.trim() || 'Sin mensaje adicional.',
          to_email: emailJsConfig.toEmail,
        },
        {
          publicKey: emailJsConfig.publicKey,
        },
      )

      setStatus({
        type: 'success',
        message:
          'Solicitud enviada correctamente. Loren revisará tu petición y, si procede, te enviará una invitación.',
      })
      setFormData(initialForm)
    } catch (error) {
      console.error('Error enviando solicitud de invitación', error)
      setStatus({
        type: 'error',
        message: 'No se pudo enviar la solicitud ahora mismo. Inténtalo de nuevo en unos minutos.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <PublicLayout>
      <main className="landing-page">
        <section className="landing-hero section-shell">
          <div className="hero-panel">
            <div className="hero-panel__eyebrow">Acceso privado y gestionado</div>
            <h1>Inteligencia Loren</h1>
            <p className="hero-panel__lead">Tecnología útil, privada y seleccionada con criterio.</p>
            <p className="hero-panel__copy">
              Una plataforma donde Loren organiza proyectos, accesos y recursos digitales de forma simple,
              segura y controlada.
            </p>
            <div className="hero-panel__actions">
              <a className="cta-button cta-button--primary" href="/login">
                Acceder con código
              </a>
              <button className="cta-button cta-button--invite" type="button" onClick={openInvite}>
                Solicitar Invitación
              </button>
            </div>
          </div>
        </section>

        <section className="section-shell content-card-grid">
          <article className="content-card content-card--wide">
            <span className="content-card__eyebrow">Qué es Inteligencia Loren</span>
            <h2>Un acceso cuidado, no una plataforma abierta sin filtro.</h2>
            <p>
              Inteligencia Loren reúne herramientas, proyectos y contenidos digitales que Loren publica,
              habilita y comparte de forma controlada. Cada acceso se concede de manera individual, con
              seguimiento y validación.
            </p>
          </article>

          <article className="content-card content-card--accent">
            <span className="content-card__eyebrow">Acceso controlado</span>
            <h2>Cada acceso está gestionado de forma individual.</h2>
            <p>
              El acceso no es abierto. Cada usuario recibe autorización específica según el proyecto, el
              momento y el uso previsto. Así se mantiene orden, privacidad y una mejor experiencia.
            </p>
          </article>
        </section>

        <section className="section-shell flow-section">
          <div className="section-heading">
            <span className="section-heading__eyebrow">Cómo funciona</span>
            <h2>Así funciona el acceso</h2>
          </div>
          <div className="flow-grid">
            {flowSteps.map((step, index) => (
              <article className="flow-card" key={step.title}>
                <div className="flow-card__index">0{index + 1}</div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-shell features-section">
          <div className="section-heading">
            <span className="section-heading__eyebrow">Qué puedes encontrar aquí</span>
            <h2>Proyectos y recursos seleccionados</h2>
            <p>
              Aquí no se publica todo. Cada proyecto se revisa, se prepara y se activa cuando Loren decide
              que está listo para compartirse.
            </p>
          </div>
          <div className="feature-grid">
            {featureCards.map((card) => (
              <article className="feature-card" key={card.title}>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section-shell invite-section">
          <div className="invite-section__card">
            <div>
              <span className="section-heading__eyebrow">Invitación</span>
              <h2>¿No tienes acceso todavía?</h2>
              <p>
                Si quieres recibir una invitación, puedes enviar tu solicitud y Loren revisará tus datos
                antes de habilitar cualquier acceso.
              </p>
            </div>
            <div className="hero-panel__actions invite-section__actions">
              <a className="cta-button cta-button--primary" href="/login">
                Acceder con código
              </a>
              <button className="cta-button cta-button--invite" type="button" onClick={openInvite}>
                Solicitar Invitación
              </button>
            </div>
          </div>
        </section>

        <footer className="landing-footer section-shell">
          <div className="landing-footer__card">
            <strong>Inteligencia Loren</strong>
            <span>Acceso privado y gestionado</span>
            <div className="landing-footer__links">
              <a href="/login">Acceso / Login</a>
              <a href="#privacidad">Privacidad</a>
            </div>
          </div>
        </footer>

        {isInviteOpen ? (
          <div className="invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
            <div className="invite-modal__backdrop" onClick={closeInvite} />
            <div className="invite-modal__card">
              <button className="invite-modal__close" type="button" onClick={closeInvite} aria-label="Cerrar formulario">
                ×
              </button>
              <span className="section-heading__eyebrow">Solicitar Invitación</span>
              <h2 id="invite-modal-title">Déjanos tus datos</h2>
              <p className="invite-modal__copy">
                Loren revisará tu solicitud antes de conceder acceso. Este formulario está pensado para enviar
                los datos recibidos por email.
              </p>

              <form className="invite-form" onSubmit={handleSubmit}>
                <label>
                  <span>Nombre completo</span>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(event) => updateField('fullName', event.target.value)}
                    placeholder="Tu nombre y apellidos"
                    required
                  />
                </label>

                <label>
                  <span>Correo electrónico</span>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    placeholder="tu@email.com"
                    required
                  />
                </label>

                <label>
                  <span>Teléfono o WhatsApp</span>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(event) => updateField('phone', event.target.value)}
                    placeholder="Obligatorio"
                    required
                  />
                </label>

                <label>
                  <span>Proyecto o motivo de interés</span>
                  <input
                    type="text"
                    value={formData.interest}
                    onChange={(event) => updateField('interest', event.target.value)}
                    placeholder="Opcional. Si lo rellenas, debe coincidir exactamente con un proyecto publicado"
                  />
                </label>

                <label>
                  <span>Mensaje adicional</span>
                  <textarea
                    value={formData.message}
                    onChange={(event) => updateField('message', event.target.value)}
                    placeholder="Cuéntale a Loren lo que considere útil para valorar tu solicitud"
                    rows={5}
                  />
                </label>

                <label className="invite-form__checkbox">
                  <input
                    type="checkbox"
                    checked={formData.privacyAccepted}
                    onChange={(event) => updateField('privacyAccepted', event.target.checked)}
                    required
                  />
                  <span>Acepto la política de privacidad y el uso de estos datos para revisar mi solicitud.</span>
                </label>

                {status.type !== 'idle' ? (
                  <div className={`form-status form-status--${status.type}`}>{status.message}</div>
                ) : null}

                <button className="cta-button cta-button--invite cta-button--full" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Enviando solicitud...' : 'Enviar solicitud'}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </main>
    </PublicLayout>
  )
}
