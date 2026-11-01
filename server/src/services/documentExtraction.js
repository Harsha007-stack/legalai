import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import { createWorker } from 'tesseract.js'

export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024
export const MAX_OCR_PAGES = 8

export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
])

export const ATTACHMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/png,image/jpeg,image/webp,text/plain'

const MIME_TYPES_BY_EXTENSION = new Map([
  ['pdf', 'application/pdf'],
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'],
  ['txt', 'text/plain'],
])

function matchesFileSignature(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer)) return false
  if (mimeType === 'application/pdf') return buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (mimeType === 'image/webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  }
  return mimeType === 'text/plain'
}

export function normalizeAttachment(file) {
  if (!file) return null
  const declaredMimeType = String(file.mimetype || '').toLowerCase()
  if (ALLOWED_ATTACHMENT_MIME_TYPES.has(declaredMimeType)) {
    return { ...file, mimetype: declaredMimeType }
  }
  if (declaredMimeType && declaredMimeType !== 'application/octet-stream') return null

  const extension = String(file.originalname || '').split('.').pop()?.toLowerCase()
  const mimeType = MIME_TYPES_BY_EXTENSION.get(extension)
  if (!mimeType || !matchesFileSignature(file.buffer, mimeType)) return null
  return { ...file, mimetype: mimeType }
}

export function isAllowedAttachment(file) {
  return Boolean(normalizeAttachment(file))
}

function normalizeText(value) {
  return String(value || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function buildResult(pages, options = {}) {
  const cleanedPages = pages
    .filter((page) => page && Number.isFinite(page.page))
    .map((page) => ({ page: page.page, text: normalizeText(page.text) }))
  const text = cleanedPages
    .map((page) => `[Page ${page.page}]\n${page.text}`)
    .join('\n\n')
  return {
    pages: cleanedPages,
    text,
    pageCount: Math.max(options.pageCount || 0, cleanedPages.length),
    ocrUsed: Boolean(options.ocrUsed),
    warnings: options.warnings || [],
  }
}

async function extractPdfTextPages(buffer) {
  const pages = []
  const parsed = await pdfParse(buffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
      let text = ''
      let lastY
      for (const item of textContent.items) {
        const y = item.transform?.[5]
        if (lastY !== y) {
          text += '\n'
          lastY = y
        }
        text += item.str
      }
      const pageNumber = Number.isInteger(pageData.pageIndex) ? pageData.pageIndex + 1 : pages.length + 1
      pages.push({ page: pageNumber, text })
      return text
    },
  })
  pages.sort((left, right) => left.page - right.page)
  return { pages, pageCount: parsed.numpages || pages.length }
}

async function ocrPages(images, pageOffset = 0) {
  const worker = await createWorker('eng')
  const pages = []
  try {
    let index = 0
    for await (const image of images) {
      index += 1
      if (index > MAX_OCR_PAGES) break
      const { data } = await worker.recognize(image)
      pages.push({ page: pageOffset + index, text: data?.text || '' })
    }
  } finally {
    await worker.terminate()
  }
  return pages
}

async function ocrScannedPdf(buffer, pageCount) {
  const { pdf: pdfToImages } = await import('pdf-to-img')
  const document = await pdfToImages(`data:application/pdf;base64,${buffer.toString('base64')}`, { scale: 1.5 })
  try {
    const pages = await ocrPages(document)
    const warnings = ['This PDF had little selectable text, so OCR was used. Page numbers may be approximate.']
    if (pageCount > MAX_OCR_PAGES) warnings.push(`Only the first ${MAX_OCR_PAGES} of ${pageCount} pages were analyzed.`)
    return { pages, pageCount, ocrUsed: true, warnings }
  } catch (error) {
    const wrapped = new Error('The scanned PDF could not be processed. Try uploading clear page images instead.')
    wrapped.status = 422
    wrapped.code = 'SCANNED_PDF_UNREADABLE'
    wrapped.details = error?.message
    throw wrapped
  } finally {
    await document.destroy?.()
  }
}

async function extractPdf(buffer) {
  const { pages, pageCount } = await extractPdfTextPages(buffer)
  const totalText = pages.reduce((sum, page) => sum + page.text.trim().length, 0)
  if (totalText < 20) return ocrScannedPdf(buffer, pageCount)
  return { pages, pageCount, ocrUsed: false, warnings: [] }
}

async function extractImage(buffer) {
  const worker = await createWorker('eng')
  try {
    const { data } = await worker.recognize(buffer)
    return {
      pages: [{ page: 1, text: data?.text || '' }],
      pageCount: 1,
      ocrUsed: true,
      warnings: [],
    }
  } finally {
    await worker.terminate()
  }
}

export async function extractDocument(file) {
  if (!file?.buffer?.length) {
    const error = new Error('The attachment could not be read. Try uploading it again.')
    error.status = 400
    error.code = 'EMPTY_ATTACHMENT'
    throw error
  }

  let result
  try {
    if (file.mimetype === 'application/pdf') {
      result = await extractPdf(file.buffer)
    } else if (file.mimetype.startsWith('image/')) {
      result = await extractImage(file.buffer)
    } else if (file.mimetype === 'text/plain') {
      result = {
        pages: [{ page: 1, text: file.buffer.toString('utf8') }],
        pageCount: 1,
        ocrUsed: false,
        warnings: [],
      }
    } else {
      const error = new Error('Only PDF, image, and plain-text files can be analyzed.')
      error.status = 415
      error.code = 'UNSUPPORTED_ATTACHMENT_TYPE'
      throw error
    }
  } catch (error) {
    if (error.status) throw error
    const wrapped = new Error('The attached file could not be processed. Try another PDF, image, or plain-text file.')
    wrapped.status = 422
    wrapped.code = 'ATTACHMENT_UNREADABLE'
    wrapped.details = error?.message
    throw wrapped
  }

  const finalResult = buildResult(result.pages, result)
  if (!finalResult.pages.some((page) => page.text.length >= 2)) {
    const error = new Error('No readable text was found in this file. Try a clearer image or a text-based PDF.')
    error.status = 422
    error.code = 'NO_READABLE_TEXT'
    throw error
  }
  return finalResult
}

export async function extractDocumentText(file) {
  const result = await extractDocument(file)
  return result.text
}
