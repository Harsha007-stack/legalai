import { Router } from 'express'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { conversationIdSchema, createConversationSchema, updateConversationSchema } from '../validators/chatSchema.js'

export const conversationRoutes = Router()

conversationRoutes.post('/', asyncHandler(async (req, res) => {
  const parsed = createConversationSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_BODY', message: 'Enter a valid conversation title.' } })

  const { data, error } = await req.supabase
    .from('conversations')
    .insert({ user_id: req.user.id, title: parsed.data.title || 'New conversation' })
    .select('id, title, status, created_at, updated_at')
    .single()
  if (error) throw error
  return res.status(201).json({ conversation: data })
}))

conversationRoutes.get('/', asyncHandler(async (req, res) => {
  const { data, error } = await req.supabase
    .from('conversations')
    .select('id, title, status, created_at, updated_at')
    .eq('user_id', req.user.id)
    .order('updated_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return res.json({ conversations: data })
}))

conversationRoutes.get('/:id/messages', asyncHandler(async (req, res) => {
  const id = conversationIdSchema.safeParse(req.params.id)
  if (!id.success) return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Conversation ID is invalid.' } })

  const { data: conversation, error: conversationError } = await req.supabase
    .from('conversations')
    .select('id')
    .eq('id', id.data)
    .eq('user_id', req.user.id)
    .maybeSingle()
  if (conversationError) throw conversationError
  if (!conversation) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } })

  const { data, error } = await req.supabase
    .from('chat_messages')
    .select('id, role, content, metadata, client_message_id, created_at')
    .eq('conversation_id', id.data)
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  return res.json({ messages: data })
}))

conversationRoutes.patch('/:id', asyncHandler(async (req, res) => {
  const id = conversationIdSchema.safeParse(req.params.id)
  const body = updateConversationSchema.safeParse(req.body)
  if (!id.success || !body.success) return res.status(400).json({ error: { code: 'INVALID_REQUEST', message: 'Enter a valid conversation update.' } })

  const { data, error } = await req.supabase
    .from('conversations')
    .update(body.data)
    .eq('id', id.data)
    .eq('user_id', req.user.id)
    .select('id, title, status, created_at, updated_at')
    .maybeSingle()
  if (error) throw error
  if (!data) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } })
  return res.json({ conversation: data })
}))
