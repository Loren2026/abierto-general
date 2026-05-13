import { supabaseAdmin } from '../../config/supabase.js'
import {
  buildConsultationInsert,
  buildConsultationResponseUpdate,
  buildMessageInsert,
  buildThreadInsert,
  mapConsultation,
  mapMessage,
  mapThread,
  parseListParams,
  validateConsultationPayload,
  validateConsultationResponsePayload,
  validateMessagePayload,
  validateThreadPayload,
  THREAD_PRIORITIES,
  THREAD_STATUSES,
  CONSULTATION_STATUSES,
} from '../../utils/coordination.js'

function handleSupabaseError(error, res) {
  if (!error) return false

  if (error.code === '23505') {
    res.status(409).json({ error: 'resource already exists' })
    return true
  }

  res.status(500).json({ error: error.message || 'Internal server error' })
  return true
}

async function getThreadById(threadId) {
  const { data, error } = await supabaseAdmin
    .from('coordination_threads')
    .select('*')
    .eq('id', threadId)
    .maybeSingle()

  if (error) throw error
  return data
}

async function getMessageById(messageId) {
  const { data, error } = await supabaseAdmin
    .from('coordination_messages')
    .select('*')
    .eq('id', messageId)
    .maybeSingle()

  if (error) throw error
  return data
}

async function getConsultationById(consultationId) {
  const { data, error } = await supabaseAdmin
    .from('coordination_consultations')
    .select('*')
    .eq('id', consultationId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function listThreads(req, res) {
  const { limit, offset } = parseListParams(req.query, 20, 100)

  let query = supabaseAdmin
    .from('coordination_threads')
    .select('*', { count: 'exact' })
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (req.query.status && THREAD_STATUSES.includes(req.query.status)) {
    query = query.eq('status', req.query.status)
  }

  if (req.query.priority && THREAD_PRIORITIES.includes(req.query.priority)) {
    query = query.eq('priority', req.query.priority)
  }

  if (req.query.projectId) {
    query = query.eq('project_id', req.query.projectId)
  }

  if (req.query.search) {
    const search = req.query.search.toString().trim()
    if (search) query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%`)
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1)

  if (handleSupabaseError(error, res)) return

  return res.json({
    threads: (data || []).map(mapThread),
    pagination: {
      limit,
      offset,
      count: count || 0,
    },
  })
}

export async function createThread(req, res) {
  const validationError = validateThreadPayload(req.body)
  if (validationError) {
    return res.status(400).json({ error: validationError })
  }

  const threadToInsert = buildThreadInsert(req.body)

  const { data, error } = await supabaseAdmin
    .from('coordination_threads')
    .insert(threadToInsert)
    .select('*')
    .single()

  if (error?.code === '23505') {
    return res.status(409).json({ error: 'threadKey already exists' })
  }

  if (handleSupabaseError(error, res)) return

  return res.status(201).json({ thread: mapThread(data) })
}

export async function getThread(req, res) {
  try {
    const thread = await getThreadById(req.params.threadId)
    if (!thread) return res.status(404).json({ error: 'thread not found' })
    return res.json({ thread: mapThread(thread) })
  } catch (error) {
    return handleSupabaseError(error, res)
  }
}

export async function listThreadMessages(req, res) {
  const { threadId } = req.params
  const { limit, offset } = parseListParams(req.query, 50, 200)

  try {
    const thread = await getThreadById(threadId)
    if (!thread) return res.status(404).json({ error: 'thread not found' })

    const { data, error, count } = await supabaseAdmin
      .from('coordination_messages')
      .select('*', { count: 'exact' })
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (handleSupabaseError(error, res)) return

    return res.json({
      messages: (data || []).map(mapMessage),
      pagination: {
        limit,
        offset,
        count: count || 0,
      },
    })
  } catch (error) {
    return handleSupabaseError(error, res)
  }
}

export async function createThreadMessage(req, res) {
  const { threadId } = req.params
  const validationError = validateMessagePayload(req.body)
  if (validationError) {
    return res.status(400).json({ error: validationError })
  }

  try {
    const thread = await getThreadById(threadId)
    if (!thread) return res.status(404).json({ error: 'thread not found' })

    if (req.body.parentMessageId) {
      const parentMessage = await getMessageById(req.body.parentMessageId)
      if (!parentMessage) return res.status(400).json({ error: 'parentMessageId not found' })
      if (parentMessage.thread_id !== threadId) {
        return res.status(400).json({ error: 'parentMessageId must belong to the same thread' })
      }
    }

    const messageToInsert = buildMessageInsert(threadId, req.body)

    const { data, error } = await supabaseAdmin
      .from('coordination_messages')
      .insert(messageToInsert)
      .select('*')
      .single()

    if (handleSupabaseError(error, res)) return

    return res.status(201).json({ message: mapMessage(data) })
  } catch (error) {
    return handleSupabaseError(error, res)
  }
}

export async function listThreadConsultations(req, res) {
  const { threadId } = req.params
  const { limit, offset } = parseListParams(req.query, 20, 100)

  try {
    const thread = await getThreadById(threadId)
    if (!thread) return res.status(404).json({ error: 'thread not found' })

    let query = supabaseAdmin
      .from('coordination_consultations')
      .select('*', { count: 'exact' })
      .eq('thread_id', threadId)
      .order('requested_at', { ascending: false })

    if (req.query.status && CONSULTATION_STATUSES.includes(req.query.status)) {
      query = query.eq('status', req.query.status)
    }

    if (req.query.requestedToRole) {
      query = query.eq('requested_to_role', req.query.requestedToRole)
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (handleSupabaseError(error, res)) return

    return res.json({
      consultations: (data || []).map(mapConsultation),
      pagination: {
        limit,
        offset,
        count: count || 0,
      },
    })
  } catch (error) {
    return handleSupabaseError(error, res)
  }
}

export async function createThreadConsultation(req, res) {
  const { threadId } = req.params
  const validationError = validateConsultationPayload(req.body)
  if (validationError) {
    return res.status(400).json({ error: validationError })
  }

  try {
    const thread = await getThreadById(threadId)
    if (!thread) return res.status(404).json({ error: 'thread not found' })
    if (thread.status === 'closed' || thread.status === 'archived') {
      return res.status(409).json({ error: 'cannot create consultation on a closed thread' })
    }

    if (req.body.messageId) {
      const message = await getMessageById(req.body.messageId)
      if (!message) return res.status(400).json({ error: 'messageId not found' })
      if (message.thread_id !== threadId) {
        return res.status(400).json({ error: 'messageId must belong to the same thread' })
      }
    }

    const consultationToInsert = buildConsultationInsert(threadId, req.body)

    const { data, error } = await supabaseAdmin
      .from('coordination_consultations')
      .insert(consultationToInsert)
      .select('*')
      .single()

    if (handleSupabaseError(error, res)) return

    return res.status(201).json({ consultation: mapConsultation(data) })
  } catch (error) {
    return handleSupabaseError(error, res)
  }
}

export async function respondConsultation(req, res) {
  const validationError = validateConsultationResponsePayload(req.body)
  if (validationError) {
    return res.status(400).json({ error: validationError })
  }

  try {
    const consultation = await getConsultationById(req.params.consultationId)
    if (!consultation) return res.status(404).json({ error: 'consultation not found' })
    if (consultation.status !== 'pending') {
      return res.status(409).json({ error: 'consultation already resolved' })
    }

    const updatePayload = buildConsultationResponseUpdate(req.body)
    const { data, error } = await supabaseAdmin
      .from('coordination_consultations')
      .update(updatePayload)
      .eq('id', req.params.consultationId)
      .select('*')
      .single()

    if (handleSupabaseError(error, res)) return

    return res.json({ consultation: mapConsultation(data) })
  } catch (error) {
    return handleSupabaseError(error, res)
  }
}
