import { z } from 'zod'

export const documentAnalysisSchema = z.object({
  document_type: z.any().optional(),
  summary: z.any().optional(),
  parties: z.array(z.any()).optional(),
  key_dates: z.array(z.any()).optional(),
  dates: z.array(z.any()).optional(),
  amounts: z.array(z.any()).optional(),
  important_clauses: z.array(z.any()).optional(),
  obligations: z.array(z.any()).optional(),
  deadlines: z.array(z.any()).optional(),
  rights: z.array(z.any()).optional(),
  potential_concerns: z.array(z.any()).optional(),
  missing_information: z.array(z.any()).optional(),
  inconsistencies: z.array(z.any()).optional(),
  key_facts: z.array(z.any()).optional(),
}).passthrough()

function text(value, max = 2000) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim().slice(0, max)
}

function pageNumber(value) {
  const match = String(value ?? '').match(/\d+/)
  const parsed = match ? Number.parseInt(match[0], 10) : NaN
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function items(value) {
  return Array.isArray(value) ? value.slice(0, 20) : []
}

function objectOrString(value, mapper) {
  return items(value)
    .map((item) => {
      if (typeof item === 'string') return mapper({}, item)
      if (item && typeof item === 'object') return mapper(item, '')
      return null
    })
    .filter((item) => item && Object.values(item).some((entry) => entry !== null && entry !== ''))
}

export function normalizeDocumentAnalysis(raw, context = {}) {
  const keyDates = objectOrString(raw.key_dates || raw.dates, (item, fallback) => ({
    label: text(item.label || item.key || item.event) || null,
    date: text(item.date || item.value || fallback) || null,
    page: pageNumber(item.page),
  }))

  return {
    document_type: text(raw.document_type || raw.documentType) || null,
    summary: text(raw.summary || raw.overview, 2400),
    parties: objectOrString(raw.parties, (item, fallback) => ({
      role: text(item.role || item.type) || null,
      name: text(item.name || item.party || fallback) || null,
      page: pageNumber(item.page),
    })),
    key_dates: keyDates,
    amounts: objectOrString(raw.amounts || raw.payments, (item, fallback) => ({
      label: text(item.label || item.description || item.for) || null,
      amount: text(item.amount || item.value || fallback) || null,
      page: pageNumber(item.page),
    })),
    important_clauses: objectOrString(raw.important_clauses || raw.clauses, (item, fallback) => ({
      clause: text(item.clause || item.title || item.name || fallback) || null,
      summary: text(item.summary || item.detail || item.description) || null,
      page: pageNumber(item.page),
    })),
    obligations: objectOrString(raw.obligations, (item, fallback) => ({
      party: text(item.party || item.on) || null,
      obligation: text(item.obligation || item.duty || fallback) || null,
      page: pageNumber(item.page),
    })),
    deadlines: objectOrString(raw.deadlines, (item, fallback) => ({
      label: text(item.label || item.description || fallback) || null,
      date: text(item.date || item.due || item.value) || null,
      status: text(item.status || item.condition) || null,
      page: pageNumber(item.page),
    })),
    rights: objectOrString(raw.rights, (item, fallback) => ({
      party: text(item.party || item.of) || null,
      right: text(item.right || item.detail || fallback) || null,
      page: pageNumber(item.page),
    })),
    potential_concerns: objectOrString(raw.potential_concerns || raw.concerns, (item, fallback) => ({
      concern: text(item.concern || item.description || fallback) || null,
      page: pageNumber(item.page),
    })),
    missing_information: items(raw.missing_information || raw.missing).map((item) => text(item, 400)).filter(Boolean),
    inconsistencies: objectOrString(raw.inconsistencies, (item, fallback) => ({
      description: text(item.description || item.issue || fallback) || null,
      document_says: text(item.document_says || item.document) || null,
      user_says: text(item.user_says || item.user) || null,
    })),
    key_facts: objectOrString(raw.key_facts || raw.facts, (item, fallback) => ({
      key: text(item.key || item.label) || null,
      value: text(item.value || fallback) || null,
      page: pageNumber(item.page),
    })),
    source: {
      fileName: context.fileName || null,
      pageCount: context.pageCount || null,
      ocrUsed: Boolean(context.ocrUsed),
    },
  }
}
