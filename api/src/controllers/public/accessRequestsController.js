import { supabaseAdmin } from '../../config/supabase.js'
import { normalizeProjectSlug } from '../../utils/projects.js'
import { normalizeEmail, sanitizeAccessRequestRecord, validatePublicAccessRequestPayload } from '../../utils/accessRequests.js'

const RECENT_REQUEST_WINDOW_HOURS = 24
const MAX_RECENT_REQUESTS_PER_EMAIL = 3
const MAX_RECENT_REQUESTS_PER_IP = 10

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip || null
}

async function countRecentRequests({ email, ip }) {
  const since = new Date(Date.now() - RECENT_REQUEST_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
  const checks = []

  checks.push(
    supabaseAdmin
      .from('access_requests')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', since),
  )

  if (ip) {
    checks.push(
      supabaseAdmin
        .from('access_requests')
        .select('id', { count: 'exact', head: true })
        .eq('requester_ip', ip)
        .gte('created_at', since),
    )
  }

  const [emailResult, ipResult] = await Promise.all(checks)
  if (emailResult.error) throw emailResult.error
  if (ipResult?.error) throw ipResult.error

  return { emailCount: emailResult.count || 0, ipCount: ipResult?.count || 0 }
}

async function sendEmailNotification(payload) {
  const serviceId = process.env.EMAILJS_SERVICE_ID || process.env.VITE_EMAILJS_SERVICE_ID
  const templateId = process.env.EMAILJS_TEMPLATE_ID || process.env.VITE_EMAILJS_TEMPLATE_ID
  const publicKey = process.env.EMAILJS_PUBLIC_KEY || process.env.VITE_EMAILJS_PUBLIC_KEY
  const toEmail = process.env.INVITATION_TO_EMAIL || process.env.VITE_INVITATION_TO_EMAIL

  if (!serviceId || !templateId || !publicKey) return { sent: false, reason: 'emailjs_not_configured' }

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: {
        full_name: payload.fullName,
        reply_to: payload.email,
        phone: payload.phone || 'No facilitado',
        interest: payload.projectName,
        message: payload.message || 'Sin mensaje adicional.',
        to_email: toEmail || 'Loren',
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || 'emailjs notification failed')
  }

  return { sent: true }
}

export async function createPublicAccessRequest(req, res) {
  const slug = normalizeProjectSlug(req.params.slug)
  const validationError = validatePublicAccessRequestPayload(req.body)
  if (validationError) return res.status(400).json({ error: validationError })

  const email = normalizeEmail(req.body.email)
  const requesterIp = getClientIp(req)

  try {
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, slug, name, status')
      .eq('slug', slug)
      .eq('status', 'public')
      .maybeSingle()

    if (projectError) throw projectError
    if (!project) return res.status(404).json({ error: 'project not found' })

    const { emailCount, ipCount } = await countRecentRequests({ email, ip: requesterIp })
    if (emailCount >= MAX_RECENT_REQUESTS_PER_EMAIL || ipCount >= MAX_RECENT_REQUESTS_PER_IP) {
      return res.status(429).json({ error: 'too many access requests' })
    }

    const { data, error } = await supabaseAdmin
      .from('access_requests')
      .insert({
        project_id: project.id,
        full_name: req.body.fullName.trim(),
        email,
        phone: req.body.phone?.toString().trim() || null,
        message: req.body.message?.toString().trim() || null,
        status: 'requested',
        source: 'public_form',
        requester_ip: requesterIp,
        user_agent: req.headers['user-agent']?.toString() || null,
      })
      .select('*, projects(id, slug, name, status)')
      .single()

    if (error) throw error

    let emailNotification = { sent: false, reason: 'not_attempted' }
    try {
      emailNotification = await sendEmailNotification({
        fullName: data.full_name,
        email: data.email,
        phone: data.phone,
        message: data.message,
        projectName: project.name,
      })

      if (emailNotification.sent) {
        await supabaseAdmin
          .from('access_requests')
          .update({ email_sent: true, email_sent_at: new Date().toISOString() })
          .eq('id', data.id)
        data.email_sent = true
        data.email_sent_at = new Date().toISOString()
      }
    } catch (emailError) {
      emailNotification = { sent: false, reason: emailError.message }
    }

    return res.status(201).json({
      accessRequest: sanitizeAccessRequestRecord(data),
      emailNotification,
    })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
