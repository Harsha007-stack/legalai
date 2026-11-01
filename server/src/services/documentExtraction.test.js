import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { extractDocument, normalizeAttachment } from './documentExtraction.js'

test('extracts selectable text from a multi-page PDF', async () => {
  const buffer = await readFile(new URL('../../../node_modules/pdf-parse/test/data/04-valid.pdf', import.meta.url))
  const result = await extractDocument({ buffer, mimetype: 'application/pdf' })

  assert.equal(result.pageCount, 5)
  assert.equal(result.ocrUsed, false)
  assert.equal(result.pages.length, 5)
  assert.match(result.text, /\[Page 1\]/)
  assert.ok(result.text.length > 1000)
})

test('recognizes a phone-uploaded PDF with a generic MIME type by its extension and signature', async () => {
  const buffer = await readFile(new URL('../../../node_modules/pdf-parse/test/data/04-valid.pdf', import.meta.url))
  const attachment = normalizeAttachment({
    buffer,
    mimetype: 'application/octet-stream',
    originalname: 'document.pdf',
  })

  assert.equal(attachment.mimetype, 'application/pdf')
  const result = await extractDocument(attachment)
  assert.equal(result.pageCount, 5)
  assert.ok(result.text.length > 1000)
})

test('rejects generic MIME uploads whose extension and file signature do not match', () => {
  assert.equal(normalizeAttachment({
    buffer: Buffer.from('not a PDF'),
    mimetype: 'application/octet-stream',
    originalname: 'document.pdf',
  }), null)
})

test('rejects invalid PDFs with a user-readable extraction error', async () => {
  const buffer = await readFile(new URL('../../../node_modules/pdf-parse/test/data/03-invalid.pdf', import.meta.url))

  await assert.rejects(
    extractDocument({ buffer, mimetype: 'application/pdf' }),
    (error) => error.status === 422 && error.code === 'ATTACHMENT_UNREADABLE',
  )
})
