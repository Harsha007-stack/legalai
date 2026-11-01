import test from 'node:test'
import assert from 'node:assert/strict'
import { documentAnalysisSchema, normalizeDocumentAnalysis } from './documentAnalysisSchema.js'

test('normalizes document analysis values, page strings, and string-only items', () => {
  const parsed = documentAnalysisSchema.safeParse({
    document_type: 'Sale Agreement',
    summary: 'A sale agreement.',
    parties: [{ role: 'Buyer', name: 'A', page: '2' }, 'Builder B'],
    key_dates: [{ label: 'Agreement date', date: '15 April 2023', page: 1 }],
    important_clauses: [{ clause: 'Registration', summary: 'Register within 90 days.', page: 3 }],
    potential_concerns: ['Signature missing'],
    missing_information: ['Date of payment'],
  })

  assert.equal(parsed.success, true)
  const analysis = normalizeDocumentAnalysis(parsed.data, { fileName: 'agreement.pdf', pageCount: 3, ocrUsed: true })

  assert.equal(analysis.document_type, 'Sale Agreement')
  assert.equal(analysis.parties[0].page, 2)
  assert.equal(analysis.parties[1].name, 'Builder B')
  assert.equal(analysis.important_clauses[0].page, 3)
  assert.equal(analysis.potential_concerns[0].concern, 'Signature missing')
  assert.equal(analysis.missing_information[0], 'Date of payment')
  assert.equal(analysis.source.fileName, 'agreement.pdf')
  assert.equal(analysis.source.ocrUsed, true)
})

test('rejects a document analysis that is not an object', () => {
  assert.equal(documentAnalysisSchema.safeParse(['not', 'an', 'object']).success, false)
})
