import { useEffect, useMemo, useState } from 'react'
import emailjs from '@emailjs/browser'
import { Link } from 'react-router-dom'
import PublicLayout from '../components/layout/PublicLayout'
import fitLorenHero from '../assets/fit-loren-hero.jpg'
import gestactasHero from '../assets/gestactas-hero.png'

const DEVICE_ID_KEY = 'inteligencialoren.deviceId'
const PANEL_API_BASE_URL = 'https://panel.inteligencialoren.com/api'

const initialForm = {
  fullName: '',
  email: '',
  phone: '',
  interest: '',
  message: '',
  website: '',
  privacyAccepted: false,
}

const publishedProjects = ['Fit Loren', 'fit-loren', 'GestActas', 'gestactas']

const featuredProjects = [
  {
    slug: 'fit-loren',
    name: 'Fit Loren',
    description:
      'Fit Loren es tu entrenador personal en casa. Combina ejercicios con máquinas de musculación, rutinas sin equipo y calistenia en una sola app. Se registra con tus datos y preferencias, y la inteligencia artificial adapta cada entrenamiento a ti, tu nivel, tus objetivos, tu ritmo.',
    image: fitLorenHero,
    badge: 'Próximamente',
    accessLabel: 'Código de invitación',
    visibleUrl: 'fit.inteligencialoren.com',
  },
  {
    slug: 'gestactas',
    name: 'GestActas',
    description:
      'Gestión completa de juntas de comunidades de propietarios. Grabación de audio, transcripción automática y generación del acta con inteligencia artificial.',
    image: gestactasHero,
    badge: 'Disponible',
    accessLabel: 'Código de invitación',
    visibleUrl: 'gestactas.inteligencialoren.com',
  },
]

const flowSteps = [
  {
    title: 'Solicitas tu acceso',
    copy: 'Pides un código de invitación; Loren lo habilita de forma individual para ti.',
  },
  {
    title: 'Entras en tu proyecto',
    copy: 'Introduces el código y accedes solo al contenido que tienes autorizado.',
  },
  {
    title: 'Activas tu acceso',
    copy: 'El sistema valida tu código y lo vincula a tu dispositivo de forma segura.',
  },
  {
    title: 'Usas tu contenido',
    copy: 'Ya puedes consultar, descargar o utilizar todo, de forma sencilla y privada.',
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

function getOrCreateDeviceId() {
  const existing = window.localStorage.getItem(DEVICE_ID_KEY)
  if (existing) return existing

  const generated = window.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  window.localStorage.setItem(DEVICE_ID_KEY, generated)
  return generated
}

function getClientPlatform() {
  const ua = window.navigator.userAgent.toLowerCase()

  if (ua.includes('android')) return 'android'
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios'
  if (ua.includes('mac os x') || ua.includes('macintosh')) return 'macos'
  if (ua.includes('windows')) return 'windows'
  if (ua.includes('linux')) return 'linux'
  return 'unknown'
}

function getClientDeviceInfo() {
  const ua = window.navigator.userAgent
  const platform = getClientPlatform()
  let browser = 'Navegador'

  if (ua.includes('Edg/')) browser = 'Edge'
  else if (ua.includes('Chrome/')) browser = 'Chrome'
  else if (ua.includes('Firefox/')) browser = 'Firefox'
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari'

  const platformLabelMap = {
    android: 'Android',
    ios: 'iPhone',
    macos: 'Mac',
    windows: 'Windows',
    linux: 'Linux',
    unknown: 'Dispositivo desconocido',
  }

  return {
    platform,
    deviceName: `${browser} en ${platformLabelMap[platform] || 'Dispositivo'}`,
  }
}

function readApiError(data, fallback) {
  if (!data) return fallback
  if (data.reason === 'trial_expired') {
    return 'Periodo de prueba finalizado'
  }
  if (data.binding === 'blocked') {
    return 'Este código ya está vinculado a otro dispositivo activo. Pide a Loren que revoque o reasigne el acceso si necesitas moverlo.'
  }
  if (data.error === 'Invalid access code' || data.error === 'Invalid credentials' || data.error === 'invalid access code') {
    return 'El código no es válido o ya no está activo para este proyecto.'
  }
  return data.error || fallback
}

export default function HomePage() {
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [publicProjects, setPublicProjects] = useState(featuredProjects)
  const [accessCode, setAccessCode] = useState('')
  const [accessStatus, setAccessStatus] = useState({ type: 'idle', message: '' })
  const [isValidatingCode, setIsValidatingCode] = useState(false)
  const [formData, setFormData] = useState(initialForm)
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const emailJsConfig = useMemo(getEmailJsConfig, [])

  useEffect(() => {
    let isMounted = true

    async function loadPublicProjects() {
      try {
        const response = await fetch(`${PANEL_API_BASE_URL}/projects`)
        const data = await response.json().catch(() => ({}))

        if (!response.ok || !Array.isArray(data.projects)) {
          return
        }

        const projectsBySlug = new Map(data.projects.map((project) => [project.slug, project]))
        const hydratedProjects = featuredProjects.map((project) => ({
          ...project,
          redirectUrl: projectsBySlug.get(project.slug)?.redirectUrl ?? null,
        }))

        if (isMounted) {
          setPublicProjects(hydratedProjects)
        }
      } catch (error) {
        // keep static fallback content if the public API is temporarily unavailable
      }
    }

    loadPublicProjects()

    return () => {
      isMounted = false
    }
  }, [])

  function updateField(field, value) {
    setFormData((current) => ({ ...current, [field]: value }))
  }

  function openInvite(project = null) {
    setFormData((current) => ({
      ...current,
      interest: project?.slug || project?.name || current.interest,
    }))
    setIsInviteOpen(true)
    setStatus({ type: 'idle', message: '' })
  }

  function closeInvite() {
    setIsInviteOpen(false)
  }

  function openAccessModal(project) {
    setSelectedProject(project)
    setAccessCode('')
    setAccessStatus({ type: 'idle', message: '' })
    setIsAccessModalOpen(true)
  }

  function closeAccessModal() {
    setIsAccessModalOpen(false)
    setSelectedProject(null)
    setAccessCode('')
    setAccessStatus({ type: 'idle', message: '' })
    setIsValidatingCode(false)
  }

  function hasFullNameAndSurname(value) {
    const parts = value.trim().split(/\s+/).filter(Boolean)
    return parts.length >= 2
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus({ type: 'idle', message: '' })

    if (isSubmitted) {
      return
    }

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

    setIsSubmitting(true)

    try {
      const projectSlug = formData.interest.trim() || publicProjects[0]?.slug
      const requestResponse = await fetch(`${PANEL_API_BASE_URL}/projects/${encodeURIComponent(projectSlug)}/access-requests`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          message: formData.message.trim(),
          website: formData.website,
          privacyAccepted: formData.privacyAccepted,
        }),
      })

      const requestData = await requestResponse.json().catch(() => ({}))
      if (!requestResponse.ok) {
        throw new Error(requestData.error || 'No se pudo guardar la solicitud ahora mismo.')
      }

      if (emailJsConfig.serviceId && emailJsConfig.templateId && emailJsConfig.publicKey) {
        await emailjs.send(
          emailJsConfig.serviceId,
          emailJsConfig.templateId,
          {
            full_name: formData.fullName.trim(),
            reply_to: formData.email.trim(),
            phone: formData.phone.trim() || 'No facilitado',
            interest: projectSlug,
            message: formData.message.trim() || 'Sin mensaje adicional.',
            to_email: emailJsConfig.toEmail,
          },
          {
            publicKey: emailJsConfig.publicKey,
          },
        )
      }

      setStatus({ type: 'idle', message: '' })
      setFormData(initialForm)
      setIsSubmitted(true)
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

  async function handleValidateCode(event) {
    event.preventDefault()

    if (!selectedProject?.slug) {
      setAccessStatus({ type: 'error', message: 'No se ha seleccionado ningún proyecto.' })
      return
    }

    if (!accessCode.trim()) {
      setAccessStatus({ type: 'error', message: 'Introduce tu código de invitación.' })
      return
    }

    setIsValidatingCode(true)
    setAccessStatus({ type: 'idle', message: '' })

    try {
      const deviceId = getOrCreateDeviceId()
      const { deviceName, platform } = getClientDeviceInfo()

      const response = await fetch(`${PANEL_API_BASE_URL}/validate-code`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: accessCode.trim(),
          deviceId,
          deviceName,
          platform,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setAccessStatus({
          type: 'error',
          message: readApiError(data, 'No se pudo validar el acceso ahora mismo. Inténtalo de nuevo en unos minutos.'),
        })
        return
      }

      const resolvedProject = publicProjects.find((project) => project.slug === data.project?.slug)

      if (!resolvedProject?.redirectUrl) {
        setAccessStatus({
          type: 'error',
          message: 'Este proyecto todavía no tiene URL de destino configurada. Pide a Loren que revise la publicación.',
        })
        return
      }

      setAccessStatus({ type: 'success', message: 'Acceso validado. Redirigiendo al proyecto…' })

      if (data.project?.slug === 'gestactas') {
        const accessToken = encodeURIComponent(JSON.stringify({
          validated: true,
          project: 'gestactas',
          deviceId,
          accessId: data.access?.id || null,
          binding: data.binding || null,
          ts: Date.now(),
        }))
        window.location.href = `${resolvedProject.redirectUrl}?access_token=${accessToken}`
        return
      }

      window.location.href = resolvedProject.redirectUrl
    } catch (error) {
      setAccessStatus({
        type: 'error',
        message: 'No se pudo validar el acceso ahora mismo. Inténtalo de nuevo en unos minutos.',
      })
    } finally {
      setIsValidatingCode(false)
    }
  }

  return (
    <PublicLayout>
      <main className="landing-page">
        <div className="landing-private-entry section-shell">
          <Link to="/login" className="nav-chip nav-chip--blue">Privado</Link>
        </div>

        <section className="landing-hero section-shell">
          <div className="hero-panel">
            <div className="hero-panel__eyebrow">Acceso privado y gestionado</div>
            <h1>Inteligencia Loren</h1>
            <p className="hero-panel__lead">Tecnología útil, privada y seleccionada con criterio.</p>
            <p className="hero-panel__copy">
              Una plataforma donde Loren organiza proyectos, accesos y recursos digitales de forma simple,
              segura y controlada.
            </p>
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

        <section className="section-shell project-showcase-section">
          <div className="content-card content-card--wide project-showcase-heading-card" style={{ padding: '18px 20px' }}>
            <span className="content-card__eyebrow">Proyectos publicados</span>
            <h2 style={{ fontSize: 'clamp(1.35rem, 7vw, 2.1rem)', lineHeight: 1.05, whiteSpace: 'nowrap', marginBottom: 0 }}>PROYECTOS PUBLICADOS</h2>
          </div>
          <div className="project-showcase-grid">
            {publicProjects.map((project) => (
              <article className="project-card project-card--featured" key={project.slug}>
                <div className="project-card__media">
                  <img src={project.image} alt={project.name} />
                </div>
                <div className="project-card__body">
                  <div className="project-card__topline">
                    <span className="project-card__badge">{project.badge}</span>
                    <span className="project-card__access">{project.accessLabel}</span>
                  </div>
                  <h3>{project.name}</h3>
                  <p>{project.description}</p>
                  <div className="project-card__url">{project.visibleUrl}</div>
                  <div className="project-card__actions">
                    <button className="cta-button cta-button--primary" type="button" onClick={() => openAccessModal(project)}>
                      Acceder con código
                    </button>
                    <button className="cta-button cta-button--invite" type="button" onClick={() => openInvite(project)}>
                      Solicitar código
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="landing-footer section-shell">
          <div className="landing-footer__card">
            <strong>Inteligencia Loren</strong>
            <span>Acceso privado y gestionado</span>
            <div className="landing-footer__links" aria-label="Información de pie de página">
              <span>Acceso con código</span>
              <span>Privacidad</span>
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
                Loren revisará tu solicitud antes de conceder acceso. La solicitud se guardará en la bandeja interna
                y se mantendrá el aviso por email como notificación secundaria.
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

                <label style={{ display: 'none' }} aria-hidden="true">
                  <span>Web</span>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(event) => updateField('website', event.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
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

                {status.type === 'error' ? (
                  <div className={`form-status form-status--${status.type}`}>{status.message}</div>
                ) : null}

                <button
                  className={`cta-button ${isSubmitted ? 'cta-button--success' : 'cta-button--invite'} cta-button--full`}
                  type="submit"
                  disabled={isSubmitting || isSubmitted}
                >
                  {isSubmitted ? 'Solicitud enviada' : isSubmitting ? 'Enviando solicitud...' : 'Enviar solicitud'}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {isAccessModalOpen && selectedProject ? (
          <div className="invite-modal" role="dialog" aria-modal="true" aria-labelledby="access-modal-title">
            <div className="invite-modal__backdrop" onClick={closeAccessModal} />
            <div className="invite-modal__card">
              <button className="invite-modal__close" type="button" onClick={closeAccessModal} aria-label="Cerrar acceso con código">
                ×
              </button>
              <span className="section-heading__eyebrow">Acceder con código</span>
              <h2 id="access-modal-title">{selectedProject.name}</h2>
              <p className="invite-modal__copy">
                Introduce tu código de invitación. El sistema validará el acceso, vinculará este dispositivo y te llevará al proyecto.
              </p>

              <form className="invite-form" onSubmit={handleValidateCode}>
                <label>
                  <span>Código de invitación</span>
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
                    placeholder="Ej. ABCD1234"
                    autoCapitalize="characters"
                    autoComplete="one-time-code"
                    required
                  />
                </label>

                {accessStatus.message ? (
                  <div className={`form-status form-status--${accessStatus.type === 'success' ? 'success' : 'error'}`}>
                    {accessStatus.message}
                  </div>
                ) : null}

                <button className="cta-button cta-button--primary cta-button--full" type="submit" disabled={isValidatingCode}>
                  {isValidatingCode ? 'Validando...' : 'Validar acceso'}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </main>
    </PublicLayout>
  )
}
