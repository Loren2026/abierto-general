import { supabaseAdmin } from '../config/supabase.js'
import { compareProjectPassword } from './passwords.js'

export async function findMatchingAccess(projectId, code) {
  const { data, error } = await supabaseAdmin
    .from('project_accesses')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) throw error

  for (const access of data || []) {
    const matches = await compareProjectPassword(code, access.password_hash)
    if (matches) return access
  }

  return null
}

export function sanitizeValidatedAccess(record) {
  if (!record) return null

  return {
    id: record.id,
    projectId: record.project_id,
    personName: record.person_name,
    status: record.status,
    createdAt: record.created_at,
    passwordLastGeneratedAt: record.password_last_generated_at,
    trialDays: record.trial_days,
    activatedAt: record.activated_at,
  }
}
