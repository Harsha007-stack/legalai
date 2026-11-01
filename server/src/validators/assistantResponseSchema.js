import { z } from 'zod'

const factSchema = z.object({
  key: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(1000),
  source: z.enum(['user', 'ai_extracted']),
  confirmed: z.boolean(),
}).superRefine((fact, context) => {
  if (fact.source === 'ai_extracted' && fact.confirmed) {
    context.addIssue({ code: 'custom', message: 'AI-extracted facts cannot be confirmed automatically.' })
  }
})

const followUpSchema = z.object({
  question: z.string().trim().min(1).max(300),
  type: z.enum(['yes_no', 'yes_no_not_sure', 'text', 'attachment']).default('text'),
  required: z.boolean().default(false),
})

const legacyFollowUpSchema = z.string().trim().min(1).max(300).transform((question) => ({
  question,
  type: 'text',
  required: false,
}))

export const assistantResponseSchema = z.object({
  reply: z.string().trim().min(1).max(4000),
  issue_category: z.string().trim().max(120).nullable(),
  case_brief: z.object({
    summary: z.string().trim().max(2000),
    facts: z.array(factSchema).max(30),
    missing_information: z.array(z.string().trim().min(1).max(300)).max(20),
  }),
  follow_up_questions: z.array(z.union([followUpSchema, legacyFollowUpSchema])).max(10),
  next_steps: z.array(z.string().trim().min(1).max(500)).max(10),
  sources: z.array(z.unknown()).max(20),
  safety_note: z.string().trim().max(500).optional().default(''),
  legal_draft: z.string().trim().max(8000).nullable().optional().default(null),
})

export function normalizeAssistantResponse(response) {
  return {
    ...response,
    follow_up_questions: response.follow_up_questions.slice(0, 4).map((question) => (
      typeof question === 'string'
        ? { question, type: 'text', required: false }
        : {
            question: question.question,
            type: question.type || 'text',
            required: question.type === 'attachment' ? false : Boolean(question.required),
          }
    )),
    next_steps: response.next_steps.slice(0, 5),
    sources: [],
    legal_draft: response.legal_draft ? response.legal_draft.slice(0, 8000) : null,
  }
}
