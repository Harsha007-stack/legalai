import test from 'node:test'
import assert from 'node:assert/strict'
import { formatConsultationCaseSummary, splitConsultationCaseSummary } from './caseBrief.js'

test('formats client concern and the AI case brief as separate, attributed sections', () => {
  const text = formatConsultationCaseSummary('My landlord kept the deposit.', 'The client mentioned a rental agreement.', {
    issue_title: 'Rental deposit dispute',
    preliminary_summary: 'The client reports that their deposit was retained.',
    key_facts: ['The tenancy has ended.'],
    document_points: ['The agreement mentions a refundable deposit.'],
    client_goal: 'Recover the deposit',
    questions_to_confirm: ['Was an itemized deduction provided?'],
  })
  const split = splitConsultationCaseSummary(text)
  assert.match(split.clientContext, /My landlord kept the deposit/)
  assert.match(split.clientContext, /rental agreement/)
  assert.match(split.aiBrief, /Rental deposit dispute/)
  assert.match(split.aiBrief, /Observations from the attached document \(not verified\)/)
})

test('leaves legacy requests without an AI brief intact', () => {
  assert.deepEqual(splitConsultationCaseSummary('An older client request'), {
    clientContext: 'An older client request',
    aiBrief: '',
    aiGenerated: false,
  })
})

test('formats a readable fallback note when AI or document extraction is unavailable', () => {
  const text = formatConsultationCaseSummary('My allotment agreement has a property dispute.', '', null, {
    aiGenerated: false,
    documentName: 'allotment.pdf',
    documentAnalyzed: false,
    warnings: ['The attached document could not be read for the brief.'],
  })
  const split = splitConsultationCaseSummary(text)
  assert.match(split.clientContext, /My allotment agreement/)
  assert.equal(split.aiGenerated, false)
  assert.match(split.aiBrief, /allotment\.pdf/)
  assert.match(split.aiBrief, /could not be read/)
})
