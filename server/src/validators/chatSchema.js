import { z } from 'zod'

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
}).strict()

export const conversationIdSchema = z.string().uuid()

export const updateConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  status: z.enum(['active', 'archived']).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field is required.')

export const chatRequestSchema = z.object({
  conversationId: z.string().uuid(),
  clientMessageId: z.string().uuid(),
  message: z.string().trim().min(1).max(6000),
}).strict()

export const sessionRequestSchema = z.object({
  conversationId: z.string().uuid(),
}).strict()
