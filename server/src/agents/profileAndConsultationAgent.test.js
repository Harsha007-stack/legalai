import test from 'node:test'
import assert from 'node:assert/strict'

Object.assign(process.env, {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-key',
  DOCUMENT_AI_PROVIDER: 'groq',
  GROQ_API_KEY: 'test-groq-key',
  GROQ_BASE_URL: 'https://groq.test/v1',
  GROQ_DOCUMENT_MODEL: 'test-groq-model',
  GEMINI_API_KEY: 'test-gemini-key',
  GEMINI_OPENAI_BASE_URL: 'https://gemini.test/v1',
  GEMINI_MODEL: 'test-gemini-model',
  KIMI_API_KEY: 'test-kimi-key',
  KIMI_BASE_URL: 'https://kimi.test/v1',
  KIMI_DOCUMENT_MODEL: 'test-kimi-model',
})

const { generateAdvocateBio, generateConsultationBrief } = await import('./profileAndConsultationAgent.js')

function providerResponse(content) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
}

test('generates a bio from advocate-supplied profile details', async () => {
  const originalFetch = globalThis.fetch
  let prompt = ''
  globalThis.fetch = async (_url, options) => {
    prompt = JSON.parse(options.body).messages[1].content
    return providerResponse('An advocate with 8 years of experience handling civil matters.')
  }
  try {
    const bio = await generateAdvocateBio({
      name: 'A. Advocate',
      practiceAreas: ['Civil'],
      yearsExperience: 8,
      jurisdictions: ['Karnataka'],
      city: 'Bengaluru',
      languages: ['English'],
      remote: true,
      notes: 'Focus on client communication.',
    })
    assert.match(bio, /8 years/)
    assert.match(prompt, /Focus on client communication/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('falls back to the next provider and returns a validated consultation brief', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  const response = {
    issue_title: 'Rental deposit dispute',
    preliminary_summary: 'The client reports that their rental deposit was retained.',
    key_facts: ['The tenancy has ended.'],
    document_points: ['The agreement mentions a refundable deposit.'],
    client_goal: 'Recover the deposit',
    questions_to_confirm: ['Were deductions explained?'],
  }
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (String(url).startsWith('https://groq.test/')) {
      const error = new Error('Temporary provider failure')
      error.status = 429
      throw error
    }
    return providerResponse(JSON.stringify(response))
  }
  try {
    const brief = await generateConsultationBrief({
      clientConcern: 'My landlord kept my rental deposit after I moved out.',
      assistantContext: 'The client says they have an agreement.',
      document: { fileName: 'rental-agreement.pdf', text: 'Refundable deposit after tenancy.' },
    })
    assert.equal(brief.issue_title, response.issue_title)
    assert.deepEqual(brief.document_points, response.document_points)
    assert.equal(calls.length, 2)
    assert.match(calls[1], /gemini\.test/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
