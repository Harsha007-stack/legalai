import { apiRequest } from './api'

export async function generateAdvocateBio(input) {
  const { bio } = await apiRequest('/api/ai/advocate-bio', {
    method: 'POST',
    body: JSON.stringify(input),
    timeoutMs: 120_000,
  })
  return bio
}

export async function generateConsultationBrief({ clientConcern, assistantContext, attachment }) {
  const body = new FormData()
  body.set('clientConcern', clientConcern)
  body.set('assistantContext', assistantContext || '')
  body.set('aiProcessingConsent', 'true')
  if (attachment) body.set('attachment', attachment)
  return apiRequest('/api/ai/consultation-brief', {
    method: 'POST',
    body,
    timeoutMs: 120_000,
  })
}
