const TTL_MS = 30 * 60 * 1000
const MAX_DOCUMENTS_PER_SESSION = 3
const MAX_CONVERSATIONS = 200
const MAX_TURNS = 24
const MAX_TEXT_PER_DOCUMENT = 24_000

const store = new Map()

function cacheKey(userId, conversationId) {
  return `${userId}:${conversationId}`
}

function pruneStore() {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key)
  }
  while (store.size > MAX_CONVERSATIONS) {
    store.delete(store.keys().next().value)
  }
}

function getSession(userId, conversationId, create = false) {
  pruneStore()
  const key = cacheKey(userId, conversationId)
  const existing = store.get(key)
  if (existing && existing.expiresAt > Date.now()) {
    existing.expiresAt = Date.now() + TTL_MS
    return existing
  }
  store.delete(key)
  if (!create) return null
  const session = { documents: [], turns: [], expiresAt: Date.now() + TTL_MS }
  store.set(key, session)
  return session
}

export function trimDocumentText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_PER_DOCUMENT)
}

function trimPages(pages = []) {
  let remaining = MAX_TEXT_PER_DOCUMENT
  return pages.map((page) => {
    const text = String(page.text || '').slice(0, Math.max(remaining, 0))
    remaining -= text.length
    return { page: page.page, text }
  }).filter((page) => page.text.trim())
}

function trimDocument(document) {
  const pages = trimPages(document.pages || [])
  return {
    ...document,
    pages,
    text: pages.map((page) => `[Page ${page.page}]\n${page.text}`).join('\n\n'),
  }
}

export function rememberDocuments(userId, conversationId, documents) {
  const session = getSession(userId, conversationId, true)
  const incoming = documents.map(trimDocument)
  const next = [...incoming, ...session.documents]
    .filter((document, index, list) => list.findIndex((item) => item.fileName === document.fileName) === index)
    .slice(0, MAX_DOCUMENTS_PER_SESSION)
  session.documents = next
  return next
}

export function getDocuments(userId, conversationId) {
  return getSession(userId, conversationId)?.documents || []
}

export function getTurns(userId, conversationId) {
  const session = getSession(userId, conversationId)
  if (!session) return []
  return session.turns.flatMap((turn) => [turn.userMessage, turn.assistantMessage])
}

export function getTurn(userId, conversationId, clientMessageId) {
  const session = getSession(userId, conversationId)
  if (!session) return null
  return session.turns.find((turn) => turn.clientMessageId === clientMessageId) || null
}

export function rememberTurn(userId, conversationId, turn) {
  const session = getSession(userId, conversationId, true)
  const existing = session.turns.find((item) => item.clientMessageId === turn.clientMessageId)
  if (existing) return existing
  session.turns = [...session.turns, turn].slice(-MAX_TURNS)
  return turn
}

export function forgetSession(userId, conversationId) {
  store.delete(cacheKey(userId, conversationId))
}

export function forgetDocuments(userId, conversationId) {
  forgetSession(userId, conversationId)
}
