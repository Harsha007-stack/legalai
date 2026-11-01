import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'
import { analyzeDocument, generateLegalDraft } from '../agents/documentAgent.js'
import { generateIntakeResponse } from '../agents/intakeAgent.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { extractDocument, normalizeAttachment, MAX_ATTACHMENT_BYTES } from '../services/documentExtraction.js'
import { forgetSession, getDocuments, getTurn, getTurns, rememberDocuments, rememberTurn } from '../services/documentContext.js'
import { chatRequestSchema, sessionRequestSchema } from '../validators/chatSchema.js'

export const assistantRoutes = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_BYTES, files: 1 },
})

function acceptAttachment(req, res, next) {
  upload.single('attachment')(req, res, (error) => {
    if (!error) return next()
    const tooLarge = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
    return res.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? 'ATTACHMENT_TOO_LARGE' : 'ATTACHMENT_UPLOAD_FAILED',
        message: tooLarge
          ? 'Attachments must be 15 MB or smaller.'
          : 'The attachment could not be read. Upload a PDF, image, or plain-text file.',
      },
    })
  })
}

const retryMessage = 'I could not complete a response just now. Please try again in a moment.'
const safeFallbackMetadata = {
  retryable: true,
  issue_category: null,
  case_brief: { summary: '', facts: [], missing_information: [] },
  follow_up_questions: [],
  next_steps: [],
  sources: [],
  safety_note: 'This demo provides no verified legal guidance. Please consult a qualified advocate for advice about your situation.',
  legal_draft: null,
}

function documentMetadata(documents, uploadedDocument) {
  const latest = documents[0] || null
  return {
    attachments: uploadedDocument
      ? [{ fileName: uploadedDocument.fileName, mimeType: uploadedDocument.mimeType, size: uploadedDocument.size }]
      : [],
    document_analysis: latest?.analysis || null,
    document_name: latest?.fileName || null,
    document_pages: latest?.pageCount || null,
    document_ocr: Boolean(latest?.ocrUsed),
  }
}

function buildMetadata(response, documentFields = {}) {
  return {
    issue_category: response.issue_category,
    case_brief: response.case_brief,
    follow_up_questions: response.follow_up_questions,
    next_steps: response.next_steps,
    sources: response.sources,
    safety_note: response.safety_note,
    legal_draft: response.legal_draft || null,
    ...documentFields,
  }
}

function schemaNotReadyError() {
  const error = new Error('Supabase blocked saving this conversation. Run the latest NyayaConnect SQL migration in Supabase, then retry.')
  error.status = 503
  error.code = 'ASSISTANT_SCHEMA_NOT_READY'
  return error
}

async function persistConversationTurn(req, conversationId, clientMessageId, userContent, assistantMessage) {
  const { error: userError } = await req.supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      user_id: req.user.id,
      role: 'user',
      content: userContent,
      client_message_id: clientMessageId,
    })
  if (userError?.code === '42501') throw schemaNotReadyError()
  if (userError && userError.code !== '23505') throw userError

  const { error: assistantError } = await req.supabase.rpc('append_assistant_message', {
    p_user_id: req.user.id,
    p_conversation_id: conversationId,
    p_content: assistantMessage.content,
    p_metadata: { ...assistantMessage.metadata, client_message_id: clientMessageId },
    p_client_message_id: clientMessageId,
  })
  if (assistantError?.code === '42501') throw schemaNotReadyError()
  if (assistantError) throw assistantError
}

function shouldGenerateDraft(message, response, hasPriorAssistant) {
  if (response.legal_draft) return false
  const explicitDraftRequest = /draft|notice|complaint|demand letter|legal letter|written request/i.test(message)
  if (!hasPriorAssistant && !explicitDraftRequest) return false
  const stepText = (response.next_steps || []).join(' ')
  const draftLanguage = /draft|notice|complaint|demand|representation|written request|letter/i.test(stepText)
  const disputeLanguage = /salary|wage|payment|pending|unpaid|rent|deposit|refund|builder|employer|landlord|consumer|contract|agreement|breach|delay/i
    .test(`${message} ${response.case_brief?.summary || ''}`)
  return draftLanguage && disputeLanguage
}

function describeGenerationError(generationError) {
  const errorText = generationError?.message || ''
  const rateLimited = generationError?.status === 429
    || generationError?.name === 'RateLimitError'
    || /\b429\b|rate limit|quota/i.test(errorText)
  const invalidResponse = errorText.startsWith('Gemini response validation failed:')
    || errorText.startsWith('Gemini returned no structured text')
    || errorText.startsWith('Unexpected token')
  const responseMessage = rateLimited
    ? 'Gemini has reached its current usage limit. Wait for the quota to reset or increase your Gemini API plan, then retry.'
    : invalidResponse
      ? 'The AI returned an unexpected response format. Please retry; if it continues, contact support.'
      : retryMessage
  return {
    errorText,
    rateLimited,
    invalidResponse,
    responseMessage,
    errorPayload: {
      code: rateLimited ? 'GEMINI_RATE_LIMITED' : invalidResponse ? 'GEMINI_INVALID_RESPONSE' : 'ASSISTANT_UNAVAILABLE',
      message: responseMessage,
      retryable: !rateLimited,
    },
    logCode: rateLimited ? 'GEMINI_RATE_LIMITED' : 'ASSISTANT_GENERATION_FAILED',
  }
}

assistantRoutes.post('/chat', acceptAttachment, asyncHandler(async (req, res) => {
  const parsed = chatRequestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_BODY', message: 'Enter a message of up to 6,000 characters.' } })

  const { conversationId, clientMessageId, message } = parsed.data
  const { data: conversation, error: conversationError } = await req.supabase
    .from('conversations')
    .select('id, title')
    .eq('id', conversationId)
    .eq('user_id', req.user.id)
    .maybeSingle()
  if (conversationError) throw conversationError
  if (!conversation) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } })

  let uploadedDocument = null
  if (req.file) {
    const attachment = normalizeAttachment(req.file)
    if (!attachment) {
      return res.status(415).json({ error: { code: 'UNSUPPORTED_ATTACHMENT_TYPE', message: 'Only PDF, image, and plain-text files can be analyzed.' } })
    }

    const extractionStartedAt = Date.now()
    const extraction = await extractDocument(attachment)
    console.log(JSON.stringify({
      requestId: req.id,
      code: 'DOCUMENT_TEXT_EXTRACTED',
      mimeType: attachment.mimetype,
      fileSize: attachment.size,
      pages: extraction.pageCount,
      textLength: extraction.text.length,
      ocrUsed: extraction.ocrUsed,
      durationMs: Date.now() - extractionStartedAt,
    }))
    const analysisResult = await analyzeDocument({
      fileName: attachment.originalname,
      mimeType: attachment.mimetype,
      pages: extraction.pages,
      pageCount: extraction.pageCount,
      ocrUsed: extraction.ocrUsed,
      userNote: message,
    })

    uploadedDocument = {
      fileName: attachment.originalname,
      mimeType: attachment.mimetype,
      size: attachment.size,
      pages: extraction.pages,
      text: extraction.text,
      pageCount: extraction.pageCount,
      ocrUsed: extraction.ocrUsed,
      warnings: extraction.warnings,
      analysis: analysisResult.analysis,
      analysisProvider: analysisResult.provider,
      analysisError: analysisResult.error,
    }

    console.log(JSON.stringify({
      requestId: req.id,
      code: 'DOCUMENT_ANALYZED',
      provider: analysisResult.provider,
      mimeType: attachment.mimetype,
      pages: extraction.pageCount,
      ocrUsed: extraction.ocrUsed,
      analysisReady: Boolean(analysisResult.analysis),
    }))
  }

  let documents = getDocuments(req.user.id, conversationId)
  if (uploadedDocument) {
    documents = rememberDocuments(req.user.id, conversationId, [uploadedDocument])
  }

  if (documents.length) {
    const priorTurn = getTurn(req.user.id, conversationId, clientMessageId)
    if (priorTurn) {
      if (priorTurn.userMessage.content !== message) {
        return res.status(409).json({ error: { code: 'MESSAGE_ID_REUSED', message: 'This message was already sent. Start a new message to continue.' } })
      }
      return res.json({ userMessage: priorTurn.userMessage, assistantMessage: priorTurn.assistantMessage, ephemeral: true })
    }

    const { data: persistentHistory, error: historyError } = await req.supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(12)
    if (historyError) throw historyError

    const combinedHistory = [
      ...(persistentHistory || []).reverse(),
      ...getTurns(req.user.id, conversationId),
      { id: randomUUID(), role: 'user', content: message, created_at: new Date().toISOString() },
    ]
    const userMessage = combinedHistory[combinedHistory.length - 1]
    const documentFields = documentMetadata(documents, uploadedDocument)

    let response
    try {
      response = await generateIntakeResponse(combinedHistory, documents)
    } catch (generationError) {
      const info = describeGenerationError(generationError)
      console.error(JSON.stringify({
        requestId: req.id,
        code: info.logCode,
        ephemeral: true,
        errorName: generationError?.name || 'Error',
        providerStatus: generationError?.status || null,
        detail: info.errorText.slice(0, 300),
      }))
      return res.status(503).json({
        userMessage,
        assistantMessage: {
          id: randomUUID(),
          role: 'assistant',
          content: info.responseMessage,
          metadata: { ...safeFallbackMetadata, ...documentFields },
          created_at: new Date().toISOString(),
        },
        error: info.errorPayload,
        ephemeral: true,
      })
    }

    const latestDocument = documents[0]
    const explicitDraftRequest = /draft|notice|complaint|demand letter|legal letter/i.test(message)
    const wantsDraft = Boolean(uploadedDocument) || explicitDraftRequest
    const awaitingDetails = (response.follow_up_questions || []).length > 0
    const hasActionableDocument = Boolean(latestDocument?.analysis && (
      latestDocument.analysis.obligations?.length
      || latestDocument.analysis.deadlines?.length
      || latestDocument.analysis.potential_concerns?.length
    ))
    let finalResponse = response
    if (!response.legal_draft && wantsDraft && hasActionableDocument && (!awaitingDetails || explicitDraftRequest)) {
      const draftResult = await generateLegalDraft({
        fileName: latestDocument.fileName,
        analysis: latestDocument.analysis,
        userNote: message,
        reply: response.reply,
      })
      finalResponse = { ...response, legal_draft: draftResult.draft }
      console.log(JSON.stringify({
        requestId: req.id,
        code: 'LEGAL_DRAFT_GENERATED',
        provider: draftResult.provider,
        ready: Boolean(draftResult.draft),
      }))
    }

    const assistantMessage = {
      id: randomUUID(),
      role: 'assistant',
      content: finalResponse.reply,
      metadata: buildMetadata(finalResponse, documentFields),
      created_at: new Date().toISOString(),
    }
    await persistConversationTurn(req, conversationId, clientMessageId, message, assistantMessage)
    rememberTurn(req.user.id, conversationId, { clientMessageId, userMessage, assistantMessage })

    if (conversation.title === 'New conversation') {
      const title = uploadedDocument ? 'Document review' : message.slice(0, 80)
      const { error: titleError } = await req.supabase.from('conversations')
        .update({ title })
        .eq('id', conversationId)
        .eq('user_id', req.user.id)
      if (titleError) throw titleError
    }
    const { error: conversationUpdateError } = await req.supabase.from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('user_id', req.user.id)
    if (conversationUpdateError) throw conversationUpdateError

    return res.json({ userMessage, assistantMessage, ephemeral: true })
  }

  let { data: userMessage, error: userMessageError } = await req.supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', req.user.id)
    .eq('client_message_id', clientMessageId)
    .eq('role', 'user')
    .maybeSingle()
  if (userMessageError) throw userMessageError

  if (!userMessage) {
    const inserted = await req.supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        user_id: req.user.id,
        role: 'user',
        content: message,
        client_message_id: clientMessageId,
      })
      .select('id, role, content, created_at')
      .single()
    if (inserted.error?.code === '23505') {
      const duplicate = await req.supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .eq('conversation_id', conversationId)
        .eq('user_id', req.user.id)
        .eq('client_message_id', clientMessageId)
        .eq('role', 'user')
        .single()
      if (duplicate.error) throw duplicate.error
      userMessage = duplicate.data
    } else {
      if (inserted.error) throw inserted.error
      userMessage = inserted.data
    }

    if (conversation.title === 'New conversation') {
      const { error: titleError } = await req.supabase.from('conversations')
        .update({ title: message.slice(0, 80) })
        .eq('id', conversationId)
        .eq('user_id', req.user.id)
      if (titleError) throw titleError
    }
  } else if (userMessage.content !== message) {
    return res.status(409).json({ error: { code: 'MESSAGE_ID_REUSED', message: 'This message was already sent. Start a new message to continue.' } })
  }

  const { data: priorAssistant, error: priorAssistantError } = await req.supabase
    .from('chat_messages')
    .select('id, role, content, metadata, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', req.user.id)
    .eq('client_message_id', clientMessageId)
    .eq('role', 'assistant')
    .maybeSingle()
  if (priorAssistantError) throw priorAssistantError
  if (priorAssistant) return res.json({ userMessage, assistantMessage: priorAssistant })

  const { data: history, error: historyError } = await req.supabase
    .from('chat_messages')
    .select('role, content, metadata')
    .eq('conversation_id', conversationId)
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(12)
  if (historyError) throw historyError

  let response
  try {
    response = await generateIntakeResponse((history || []).reverse(), [])
  } catch (generationError) {
    const info = describeGenerationError(generationError)
    console.error(JSON.stringify({
      requestId: req.id,
      code: info.logCode,
      errorName: generationError?.name || 'Error',
      providerStatus: generationError?.status || null,
      detail: info.errorText.slice(0, 300),
    }))
    return res.status(503).json({
      userMessage,
      assistantMessage: {
        id: null,
        role: 'assistant',
        content: info.responseMessage,
        metadata: safeFallbackMetadata,
        created_at: new Date().toISOString(),
      },
      error: info.errorPayload,
    })
  }

  let finalResponse = response
  const hasPriorAssistant = (history || []).some((item) => item.role === 'assistant')
  const hasPriorDraft = (history || []).some((item) => item.role === 'assistant' && item.metadata?.legal_draft)
  if (!hasPriorDraft && shouldGenerateDraft(message, response, hasPriorAssistant)) {
    const draftResult = await generateLegalDraft({
      fileName: 'Conversation',
      analysis: null,
      userNote: message,
      reply: response.reply,
    })
    finalResponse = { ...response, legal_draft: draftResult.draft }
    console.log(JSON.stringify({
      requestId: req.id,
      code: 'LEGAL_DRAFT_GENERATED',
      provider: draftResult.provider,
      ready: Boolean(draftResult.draft),
    }))
  }

  const metadata = buildMetadata(finalResponse)
  const { data: savedAssistant, error: saveError } = await req.supabase.rpc('append_assistant_message', {
    p_user_id: req.user.id,
    p_conversation_id: conversationId,
    p_content: finalResponse.reply,
    p_metadata: { ...metadata, client_message_id: clientMessageId },
    p_client_message_id: clientMessageId,
  })
  if (saveError?.code === '42501') {
    console.error(JSON.stringify({
      requestId: req.id,
      code: 'ASSISTANT_MESSAGE_PERMISSION_DENIED',
      databaseMessage: saveError.message,
    }))
    return res.status(503).json({
      error: {
        code: 'ASSISTANT_SCHEMA_NOT_READY',
        message: 'Supabase blocked saving the assistant reply. Run the latest NyayaConnect SQL migration in Supabase, then retry.',
        requestId: req.id,
      },
    })
  }
  if (saveError) throw saveError
  const assistantMessage = Array.isArray(savedAssistant) ? savedAssistant[0] : savedAssistant
  if (!assistantMessage) throw new Error('Could not save assistant message.')
  const { error: conversationUpdateError } = await req.supabase.from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('user_id', req.user.id)
  if (conversationUpdateError) throw conversationUpdateError
  return res.json({
    userMessage,
    assistantMessage: { ...assistantMessage, metadata },
  })
}))

assistantRoutes.delete('/documents', asyncHandler(async (req, res) => {
  const parsed = sessionRequestSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: { code: 'INVALID_BODY', message: 'A valid conversation ID is required.' } })

  const { data: conversation, error } = await req.supabase
    .from('conversations')
    .select('id')
    .eq('id', parsed.data.conversationId)
    .eq('user_id', req.user.id)
    .maybeSingle()
  if (error) throw error
  if (!conversation) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Conversation not found.' } })

  forgetSession(req.user.id, parsed.data.conversationId)
  return res.json({ cleared: true })
}))
