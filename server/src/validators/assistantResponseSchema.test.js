import test from 'node:test'
import assert from 'node:assert/strict'
import { assistantResponseSchema, normalizeAssistantResponse } from './assistantResponseSchema.js'
import { chatRequestSchema } from './chatSchema.js'

const response = {
  reply: 'I can help organize the details.',
  issue_category: 'employment',
  case_brief: {
    summary: 'The user reports a workplace issue.',
    facts: [{ key: 'issue', value: 'Salary reportedly delayed', source: 'user', confirmed: false }],
    missing_information: ['State'],
  },
  follow_up_questions: [
    { question: 'Which state are you working in?', type: 'text', required: true },
  ],
  next_steps: [],
  sources: [],
  safety_note: 'Preliminary information only.',
}

test('accepts a structured assistant response with no unverified sources', () => {
  assert.equal(assistantResponseSchema.safeParse(response).success, true)
})

test('rejects AI-extracted facts marked as confirmed', () => {
  const invalid = structuredClone(response)
  invalid.case_brief.facts[0] = { key: 'duration', value: 'Three months', source: 'ai_extracted', confirmed: true }
  assert.equal(assistantResponseSchema.safeParse(invalid).success, false)
})

test('discards model sources when no retrieval is configured', () => {
  const invalid = structuredClone(response)
  invalid.sources = [{ title: 'Unknown source', authority: 'Unknown', url: 'https://example.test/law' }]
  const parsed = assistantResponseSchema.safeParse(invalid)
  assert.equal(parsed.success, true)
  assert.deepEqual(normalizeAssistantResponse(parsed.data).sources, [])
})

test('limits generated follow-up questions to four and keeps attachment questions', () => {
  const parsed = assistantResponseSchema.safeParse({
    ...response,
    follow_up_questions: [
      { question: 'Question 1?', type: 'yes_no', required: true },
      { question: 'Question 2?', type: 'yes_no_not_sure', required: false },
      { question: 'Question 3?', type: 'text', required: false },
      { question: 'Do you have the documents? If yes, attach them.', type: 'attachment', required: true },
      { question: 'Question 5?', type: 'text', required: false },
    ],
  })
  assert.equal(parsed.success, true)
  const questions = normalizeAssistantResponse(parsed.data).follow_up_questions
  assert.equal(questions.length, 4)
  assert.equal(questions[3].type, 'attachment')
  assert.equal(questions[3].required, false)
})

test('converts legacy string questions into structured questions', () => {
  const parsed = assistantResponseSchema.safeParse({
    ...response,
    follow_up_questions: ['Do you have a written agreement?'],
  })
  assert.equal(parsed.success, true)
  assert.deepEqual(normalizeAssistantResponse(parsed.data).follow_up_questions, [
    { question: 'Do you have a written agreement?', type: 'text', required: false },
  ])
})

test('validates chat input size and idempotency ID', () => {
  const valid = { conversationId: crypto.randomUUID(), clientMessageId: crypto.randomUUID(), message: 'A short message' }
  assert.equal(chatRequestSchema.safeParse(valid).success, true)
  assert.equal(chatRequestSchema.safeParse({ ...valid, message: 'x'.repeat(6001) }).success, false)
})
