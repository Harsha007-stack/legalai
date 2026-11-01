import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Clock3, FileText, Filter, MapPin, MessageCircle, Mic, MicOff, Paperclip, Plus, Search, Send, ShieldCheck, Sparkles, Trash2, Video, X } from 'lucide-react'
import { recommendAdvocates } from '../data/advocateRecommendations'
import { formatConsultationCaseSummary } from '../data/caseBrief'
import { formatDate, formatFee, mockDocuments } from '../data/mockData'
import { useAdvocateDirectory } from '../hooks/useAdvocateDirectory'
import { useDemo } from '../context/useDemo'
import { saveDemoDraft, sendDemoMessage } from '../services/mockApi'
import { apiRequest } from '../services/api'
import { generateConsultationBrief } from '../services/ai'
import { detectLocation, getStoredLocation } from '../services/location'
import { uploadConsultationDocument } from '../services/consultations'
import { Badge, Button, Card, DemoNotice, EmptyState, Field, Modal, PageHeader } from '../components/UI'

const followUpOptions = {
  yes_no: ['Yes', 'No'],
  yes_no_not_sure: ['Yes', 'No', 'Not sure'],
}

const ATTACHMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.txt,application/pdf,image/png,image/jpeg,image/webp,text/plain'
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024
const recordHintPattern = /record|proof|document|evidence|receipt|agreement|written|bill|invoice|certificate|statement/i
const ASSISTANT_STATE_PREFIX = 'nyaya:assistant:'
const analyzedFilesByUser = new Map()

function readAssistantState(userId) {
  if (!userId || typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(`${ASSISTANT_STATE_PREFIX}${userId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function writeAssistantState(userId, state) {
  if (!userId || typeof window === 'undefined') return
  try {
    const key = `${ASSISTANT_STATE_PREFIX}${userId}`
    if (!state.conversationId && !state.messages?.length && !state.input) {
      window.sessionStorage.removeItem(key)
      return
    }
    window.sessionStorage.setItem(key, JSON.stringify(state))
  } catch {
    // Session storage can be full or blocked; the chat keeps working in memory.
  }
}

function assistantContextForRequest(details) {
  if (!details) return ''
  return [
    details.summary ? `Intake summary: ${details.summary}` : '',
    details.facts?.length ? `Reported facts: ${details.facts.join('; ')}` : '',
    details.extractedFacts?.length ? `Extracted facts for review: ${details.extractedFacts.join('; ')}` : '',
    details.documentAnalysis?.summary ? `Document agent notes (unverified): ${details.documentAnalysis.summary}` : '',
    details.query ? `Recent concern from chat: ${details.query}` : '',
  ].filter(Boolean).join('\n').slice(0, 1500)
}

function formatAttachmentSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function pageLabel(page) {
  return page ? ` (p. ${page})` : ''
}

function recommendationReason(person, details, location) {
  const category = String(details?.category || '').toLowerCase()
  const query = String(details?.query || '').toLowerCase()
  const practice = (person.practiceAreas || []).find((area) => {
    const normalized = area.toLowerCase()
    return normalized && (category.includes(normalized) || normalized.includes(category) || query.includes(normalized))
  }) || person.practiceAreas?.[0]
  const reasons = []
  if (practice) reasons.push(`Handles ${practice.toLowerCase()} matters`)
  if (person.city && location?.city && person.city.toLowerCase() === location.city.toLowerCase()) {
    reasons.push(`based in ${person.city}`)
  } else if (person.state && location?.state && person.state.toLowerCase() === location.state.toLowerCase()) {
    reasons.push(`practises in ${person.state}`)
  }
  if (person.remote) reasons.push('offers remote consultations')
  if (person.yearsExperience) reasons.push(`${person.yearsExperience} years' experience`)
  return reasons.join(' · ') || 'Matched to your case area and location'
}

function advocateMatchesCase(person, details) {
  const category = String(details?.category || '').toLowerCase()
  const query = String(details?.query || '').toLowerCase()
  return (person.practiceAreas || []).some((area) => {
    const normalized = area.toLowerCase()
    return Boolean(normalized) && (category.includes(normalized) || normalized.includes(category) || query.includes(normalized))
  })
}

function messageRequestsRecords(message) {
  if (recordHintPattern.test(message.text || '')) return true
  return (message.followUps || []).some((question) => recordHintPattern.test(question.question || ''))
}

function toStructuredQuestion(question) {
  if (typeof question === 'string') return { question, type: 'text', required: false }
  return {
    question: question?.question || question?.text || '',
    type: question?.type || 'text',
    required: Boolean(question?.required),
  }
}

function FollowUpQuestions({ questions, messageKey, onAnswer, onAttach, attachment, onRemoveAttachment }) {
  const [answers, setAnswers] = useState({})
  const [openText, setOpenText] = useState(null)
  const [sent, setSent] = useState(false)
  const setAnswer = (index, value) => setAnswers((current) => ({ ...current, [index]: value }))
  const hasAnswer = (index) => Boolean(String(answers[index] ?? '').trim())
  const missingRequired = questions.some((question, index) => question.required && !hasAnswer(index))
  const canSend = !sent && !missingRequired && (Boolean(attachment) || questions.some((question, index) => hasAnswer(index)))
  const submitAll = () => {
    if (!canSend) return
    const lines = questions.flatMap((question, index) => (
      hasAnswer(index) ? [`${index + 1}. ${question.question}\nAnswer: ${String(answers[index]).trim()}`] : []
    ))
    if (!lines.length && !attachment) return
    setSent(true)
    const text = lines.length ? `Answers to your questions:\n${lines.join('\n')}` : ''
    onAnswer(text, null, attachment || null)
  }
  return (
    <div className="question-card">
      <strong className="question-heading">I need just a few details to understand your case better:</strong>
      <ol className="question-list">
        {questions.map((question, index) => {
          const options = followUpOptions[question.type]
          const isOpen = openText === index
          return (
            <li className="question-item" key={`${messageKey}-${index}`}>
              <span className="question-number">{index + 1}</span>
              <div className="question-body">
                <p className="question-text">
                  {question.question}
                  {question.required && <span className="required-tag">Required</span>}
                </p>
                {question.type === 'attachment' ? (
                  <div className="attachment-question">
                    {attachment ? (
                      <div className="message-attachment qa-attachment">
                        <Paperclip size={12} />
                        <span>{attachment.name}</span>
                        <small>{formatAttachmentSize(attachment.size)}</small>
                        {!sent && <button type="button" className="button-as-link text-link small-link" onClick={onRemoveAttachment}>Remove</button>}
                      </div>
                    ) : (
                      <button type="button" className="answer-chip answer-chip-attach" onClick={onAttach} disabled={sent}>
                        <Paperclip size={12} /> Attach documents
                      </button>
                    )}
                    <small className="question-note">PDF, image, or text · up to 15 MB · analyzed together with your answers</small>
                  </div>
                ) : options ? (
                  <div className="answer-options">
                    {options.map((option) => (
                      <button
                        type="button"
                        key={option}
                        className={answers[index] === option ? 'answer-chip answer-chip-selected' : 'answer-chip'}
                        disabled={sent}
                        onClick={() => setAnswer(index, option)}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : sent ? (
                  hasAnswer(index)
                    ? <p className="inline-answer-sent">{answers[index]}</p>
                    : <p className="inline-answer-skipped">Not answered</p>
                ) : isOpen ? (
                  <form className="inline-answer-form" onSubmit={(event) => { event.preventDefault(); setOpenText(null) }}>
                    <textarea
                      rows="2"
                      autoFocus
                      placeholder="Type your answer here…"
                      value={answers[index] || ''}
                      onChange={(event) => setAnswer(index, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          setOpenText(null)
                        }
                      }}
                    />
                    <div className="inline-answer-actions">
                      <button type="button" className="answer-chip" onClick={() => { setOpenText(null); setAnswer(index, '') }}>Cancel</button>
                      <button type="submit" className="answer-chip" disabled={!hasAnswer(index)}>Done</button>
                    </div>
                  </form>
                ) : hasAnswer(index) ? (
                  <div className="inline-answer-edit">
                    <p className="inline-answer-sent">{answers[index]}</p>
                    <button type="button" className="button-as-link text-link small-link" onClick={() => setOpenText(index)}>Edit</button>
                  </div>
                ) : (
                  <button type="button" className="answer-chip" onClick={() => setOpenText(index)}>Answer</button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <div className="question-footer">
        <div>
          <small className="question-note">These questions help organize your case; they are not a legal assessment.</small>
          {!sent && missingRequired && <small className="question-hint">Answer all required questions to send.</small>}
        </div>
        <button type="button" className="question-send" onClick={submitAll} disabled={!canSend}>
          <Send size={13} /> {sent ? 'Answers sent' : 'Send answers'}
        </button>
      </div>
    </div>
  )
}

export function CitizenDashboard() {
  const { user, requests } = useDemo()
  const latest = requests.slice(0, 2)
  return (
    <>
      <PageHeader eyebrow="YOUR SPACE" title={`Good to see you, ${user?.name?.split(' ')[0] || 'there'}.`} description="A clear first step can help make everything after it feel more manageable." />
      <div className="welcome-banner"><div className="welcome-icon"><Sparkles size={20} /></div><div><span className="eyebrow">START WITH WHAT YOU KNOW</span><h2>What would you like help understanding?</h2><p>Share a few details and get help organizing your concern.</p></div><Link to="/app/assistant" className="button button-primary">Describe your issue <ArrowRight size={16} /></Link></div>
      <div className="dashboard-grid">
        <Card className="dashboard-main-card"><div className="card-title-row"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Consultation requests</h2></div><Link className="text-link small-link" to="/app/requests">View all <ArrowRight size={14} /></Link></div>
          {latest.length ? <div className="activity-list">{latest.map((request) => <Link className="activity-row" to="/app/requests" key={request.id}><span className="activity-avatar">{request.advocateName.split(' ').map((part) => part[0]).join('')}</span><span className="activity-info"><strong>{request.advocateName}</strong><small>{request.caseTitle}</small></span><Badge>{request.status.replace('_', ' ')}</Badge><ArrowUpRight size={16} className="activity-arrow" /></Link>)}</div> : <EmptyState icon={MessageCircle} title="No requests yet">When you’re ready, you can choose an advocate to contact.</EmptyState>}
        </Card>
        <Card className="checklist-card"><span className="eyebrow">A GENTLE REMINDER</span><h2>What to prepare</h2><p>Small steps can make a first conversation easier.</p><ul className="check-list"><li><span><Check size={14} /></span>Write down key dates</li><li><span><Check size={14} /></span>Keep relevant messages</li><li><span><Check size={14} /></span>Note questions you have</li></ul><Link to="/app/documents" className="text-link small-link">Go to documents <ArrowRight size={14} /></Link></Card>
      </div>
      <div className="section-spacer">
        <div className="card-title-row section-inline-heading"><div><span className="eyebrow">YOUR TOOLS</span><h2>Take things one step at a time</h2></div></div>
        <div className="tools-grid">
          <Link to="/app/assistant" className="tool-card"><span className="tool-icon tool-navy"><MessageCircle size={19} /></span><span><strong>Legal assistant</strong><small>Organize your concern in plain language</small></span><ArrowUpRight size={16} /></Link>
          <Link to="/app/lawyers" className="tool-card"><span className="tool-icon tool-gold"><Search size={19} /></span><span><strong>Find an advocate</strong><small>Explore sample profiles and practice areas</small></span><ArrowUpRight size={16} /></Link>
          <Link to="/app/documents" className="tool-card"><span className="tool-icon tool-slate"><FileText size={19} /></span><span><strong>Documents</strong><small>Review your demo notes and draft</small></span><ArrowUpRight size={16} /></Link>
        </div>
      </div>
      <div className="footer-note"><ShieldCheck size={16} /><span>NyayaConnect shares general legal information. For advice about your situation, speak with a qualified advocate.</span></div>
    </>
  )
}

export function AssistantPage() {
  const { isSupabaseConfigured, user } = useDemo()
  const restoredState = useMemo(() => readAssistantState(user?.id) || {}, [user?.id])
  const [messages, setMessages] = useState(() => restoredState.messages || [])
  const [input, setInput] = useState(() => restoredState.input || '')
  const [loading, setLoading] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [error, setError] = useState('')
  const [details, setDetails] = useState(() => restoredState.details || null)
  const [conversationId, setConversationId] = useState(() => restoredState.conversationId || '')
  const [conversations, setConversations] = useState([])
  const [pendingRetry, setPendingRetry] = useState(null)
  const [attachment, setAttachment] = useState(null)
  const [processingDocument, setProcessingDocument] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const { profiles: publishedAdvocates, error: advocateDirectoryError } = useAdvocateDirectory()
  const inputRef = useRef(null)
  const attachmentInputRef = useRef(null)
  const speechRecognitionRef = useRef(null)
  const speechBaseTextRef = useRef('')
  const chatScrollRef = useRef(null)
  const autoSendAttachmentRef = useRef(false)
  const loadRequestId = useRef(0)
  const [location, setLocation] = useState(() => getStoredLocation())
  const [locationStatus, setLocationStatus] = useState(() => (getStoredLocation() ? 'ready' : 'loading'))

  useEffect(() => {
    writeAssistantState(user?.id, { conversationId, messages, details, input })
  }, [user?.id, conversationId, messages, details, input])

  useEffect(() => {
    const node = chatScrollRef.current
    if (!node) return undefined
    const frame = window.requestAnimationFrame(() => {
      node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [messages, loading])

  useEffect(() => () => {
    speechRecognitionRef.current?.stop()
  }, [])

  const toggleVoiceInput = () => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop()
      return
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechError('Voice typing is not supported in this browser. You can type your message instead.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.continuous = true
    recognition.interimResults = true
    speechBaseTextRef.current = input.trim()
    setSpeechError('')
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join('')
        .trim()
      const base = speechBaseTextRef.current
      setInput(transcript ? `${base}${base ? ' ' : ''}${transcript}` : base)
    }
    recognition.onerror = (event) => {
      setIsListening(false)
      speechRecognitionRef.current = null
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setSpeechError('Microphone access is blocked. Allow microphone access in your browser settings, then try again.')
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setSpeechError('Voice typing stopped. Please try again or type your message.')
      }
    }
    recognition.onend = () => {
      setIsListening(false)
      speechRecognitionRef.current = null
    }
    speechRecognitionRef.current = recognition
    try {
      recognition.start()
      setIsListening(true)
    } catch {
      speechRecognitionRef.current = null
      setSpeechError('Could not start voice typing. Check microphone permission and try again.')
    }
  }

  const locate = useCallback(async () => {
    setLocationStatus('loading')
    try {
      const nextLocation = await detectLocation()
      setLocation(nextLocation)
      setLocationStatus('ready')
    } catch {
      setLocationStatus('denied')
    }
  }, [])

  useEffect(() => {
    if (getStoredLocation()) return undefined
    let active = true
    detectLocation()
      .then((nextLocation) => {
        if (!active) return
        setLocation(nextLocation)
        setLocationStatus('ready')
      })
      .catch(() => {
        if (active) setLocationStatus('denied')
      })
    return () => { active = false }
  }, [])

  const displayMessage = useCallback((message) => {
    const metadata = message.metadata || {}
    const brief = metadata.case_brief || {}
    return {
      id: message.id,
      clientMessageId: message.client_message_id || message.clientMessageId || null,
      role: message.role,
      text: message.content,
      followUps: (metadata.follow_up_questions || []).map(toStructuredQuestion).filter((question) => question.question),
      category: metadata.issue_category || null,
      summary: brief.summary || '',
      facts: (brief.facts || []).filter((fact) => fact.source === 'user').map((fact) => `${fact.key}: ${fact.value}`),
      extractedFacts: (brief.facts || []).filter((fact) => fact.source === 'ai_extracted').map((fact) => `${fact.key}: ${fact.value}`),
      missing: brief.missing_information || [],
      nextSteps: metadata.next_steps || [],
      sources: metadata.sources || [],
      legalDraft: metadata.legal_draft || null,
      documentAnalysis: metadata.document_analysis || null,
      documentName: metadata.document_name || null,
      documentPages: metadata.document_pages || null,
      attachments: metadata.attachments || [],
    }
  }, [])

  const clearServerDocumentSession = useCallback(async (id) => {
    if (!id || !isSupabaseConfigured) return
    try {
      await apiRequest('/api/assistant/documents', {
        method: 'DELETE',
        body: JSON.stringify({ conversationId: id }),
      })
    } catch {
      // The session may already have expired; nothing else to clear.
    }
  }, [isSupabaseConfigured])

  const loadSavedConversation = useCallback(async (id) => {
    setLoadingConversations(true)
    setError('')
    try {
      const { messages: savedMessages } = await apiRequest(`/api/conversations/${id}/messages`, {
        timeoutMs: 20_000,
        retries: 2,
        retryDelayMs: 600,
      })
      const mapped = savedMessages.map(displayMessage)
      setMessages(mapped)
      setConversationId(id)
      const lastAssistant = [...mapped].reverse().find((message) => message.role === 'assistant')
      const lastUser = [...mapped].reverse().find((message) => message.role === 'user')
      setDetails(lastAssistant ? { ...lastAssistant, query: lastUser?.text || '' } : null)
    } catch (loadError) {
      setLoadFailed(true)
      setError(loadError.message || 'Could not load this conversation.')
    } finally {
      setLoadingConversations(false)
    }
  }, [displayMessage])

  const startNewConversation = () => {
    if (conversationId) void clearServerDocumentSession(conversationId)
    setConversationId('')
    setMessages([])
    setDetails(null)
    setError('')
    setPendingRetry(null)
    setInput('')
    setAttachment(null)
    setLoadFailed(false)
  }

  const loadConversationList = useCallback(async () => {
    const requestId = ++loadRequestId.current
    setLoadingConversations(true)
    setError('')
    setLoadFailed(false)
    try {
      const { conversations: savedConversations } = await apiRequest('/api/conversations', {
        timeoutMs: 10_000,
        retries: 5,
        retryDelayMs: 500,
      })
      if (requestId !== loadRequestId.current) return
      setConversations(savedConversations)
    } catch (loadError) {
      if (requestId !== loadRequestId.current) return
      setLoadFailed(true)
      setError(loadError.message || 'Could not load your conversations.')
    } finally {
      if (requestId === loadRequestId.current) setLoadingConversations(false)
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    const timer = window.setTimeout(() => loadConversationList(), 0)
    return () => window.clearTimeout(timer)
  }, [isSupabaseConfigured, loadConversationList])

  const openAttachmentPicker = (autoSend = false) => {
    if (loading) return
    autoSendAttachmentRef.current = autoSend
    attachmentInputRef.current?.click()
  }

  const chooseAttachment = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    const autoSend = autoSendAttachmentRef.current
    autoSendAttachmentRef.current = false
    if (!file) return
    if (!isSupabaseConfigured) {
      setError('File analysis needs the live backend. Configure Supabase to attach documents.')
      return
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError('Attachments must be 15 MB or smaller.')
      return
    }
    const extension = `.${(file.name.split('.').pop() || '').toLowerCase()}`
    if (!ATTACHMENT_ACCEPT.split(',').includes(extension)) {
      setError('Attach a PDF, an image (PNG, JPG, WEBP), or a plain-text file.')
      return
    }
    setError('')
    if (autoSend) {
      send('', null, file)
    } else {
      setAttachment(file)
    }
  }

  const send = async (value = input, retry = null, fileOverride = null) => {
    const text = String(value || '').trim()
    const file = retry ? retry.file || null : (fileOverride || attachment)
    if ((!text && !file) || loading) return
    speechRecognitionRef.current?.stop()
    const message = text || `Please review the attached file: ${file.name}`
    setError('')
    const clientMessageId = retry?.clientMessageId || crypto.randomUUID()
    if (retry) {
      if (input.trim() === text) setInput('')
      setMessages((current) => current.filter((item) =>
        !(item.connectionFailure && item.clientMessageId === clientMessageId),
      ))
    }
    if (!retry) {
      setInput('')
      setAttachment(null)
      setPendingRetry(null)
      setMessages((current) => [...current.filter((item) => !item.connectionFailure), {
        id: clientMessageId,
        clientMessageId,
        role: 'user',
        text: message,
        attachment: file ? { fileName: file.name, mimeType: file.type, size: file.size } : null,
        attachmentFile: file || null,
      }])
    }
    setLoading(true)
    setProcessingDocument(Boolean(file))
    try {
      if (isSupabaseConfigured) {
        let activeConversationId = conversationId
        if (!activeConversationId) {
          const created = await apiRequest('/api/conversations', {
            method: 'POST',
            body: JSON.stringify({ title: file ? 'Document review' : message.slice(0, 80) }),
          })
          activeConversationId = created.conversation.id
          setConversationId(activeConversationId)
          setConversations((current) => [created.conversation, ...current])
        }
        const body = new FormData()
        body.append('conversationId', activeConversationId)
        body.append('clientMessageId', clientMessageId)
        body.append('message', message)
        if (file) body.append('attachment', file)
        const result = await apiRequest('/api/assistant/chat', {
          method: 'POST',
          body,
          timeoutMs: file ? 300_000 : 60_000,
          retries: 1,
          retryDelayMs: 900,
          retryErrorCodes: file ? ['ATTACHMENT_UNREADABLE', 'SCANNED_PDF_UNREADABLE'] : [],
        })
        const assistant = { ...displayMessage(result.assistantMessage), query: message }
        setDetails(assistant)
        if (file && user?.id) analyzedFilesByUser.set(user.id, file)
        setMessages((current) => [...current, assistant])
      } else {
        const response = await sendDemoMessage(message)
        setDetails(response)
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', text: response.text, ...response }])
      }
      setPendingRetry(null)
    } catch (sendError) {
      const attachmentCouldNotBeRead = file && [
        'ATTACHMENT_UNREADABLE',
        'SCANNED_PDF_UNREADABLE',
        'NO_READABLE_TEXT',
      ].includes(sendError.code)
      if (attachmentCouldNotBeRead) {
        setPendingRetry(null)
        setMessages((current) => [...current, {
          id: crypto.randomUUID(),
          role: 'assistant',
          attachmentNotProcessed: true,
          text: `I couldn’t read “${file.name}”, so I haven’t analyzed it. Please try uploading it again or paste the relevant text here, and I’ll continue.`,
        }])
        return
      }
      const serverAssistantMessage = sendError.data?.assistantMessage
      if (serverAssistantMessage?.content) {
        const retryable = sendError.data.error?.retryable === true
        setPendingRetry(retryable ? { text: message, clientMessageId, file: file || null } : null)
        if (file) {
          setInput('')
          setAttachment(null)
        }
        setMessages((current) => [
          ...current.filter((item) => !(item.connectionFailure && item.clientMessageId === clientMessageId)),
          {
            ...displayMessage(serverAssistantMessage),
            clientMessageId,
            connectionFailure: retryable,
          },
        ])
        return
      }
      setPendingRetry({ text: message, clientMessageId, file: file || null })
      if (file) {
        setInput('')
        setAttachment(null)
      }
      setError('')
      setMessages((current) => [
        ...current.filter((item) => !(item.connectionFailure && item.clientMessageId === clientMessageId)),
        {
          id: `connection-${clientMessageId}`,
          clientMessageId,
          connectionFailure: true,
          role: 'assistant',
          text: file
            ? `I couldn’t analyze “${file.name}”: ${sendError.message || 'the upload did not complete.'} Please use “Try again” to resend it.`
            : `I couldn’t get a reply: ${sendError.message || 'the request did not complete.'} Your message is saved above; use “Try again” to resend it.`,
        },
      ])
    } finally {
      setLoading(false)
      setProcessingDocument(false)
    }
  }

  const clearDocumentSession = async () => {
    if (conversationId) await clearServerDocumentSession(conversationId)
    setDetails((current) => current ? {
      ...current,
      documentAnalysis: null,
      documentName: null,
      documentPages: null,
      legalDraft: null,
    } : current)
    setAttachment(null)
    setError('')
  }

  const recommendedAdvocates = useMemo(
    () => details ? recommendAdvocates(details.category, details.query, location, publishedAdvocates) : [],
    [details, location, publishedAdvocates],
  )
  const documentAnalysis = details?.documentAnalysis || null
  const lastAssistantIndex = messages.reduce((last, message, index) => (
    message.role === 'assistant' && !message.connectionFailure ? index : last
  ), -1)
  const analyzedAttachment = details?.documentName
    ? analyzedFilesByUser.get(user?.id)?.name === details.documentName
      ? analyzedFilesByUser.get(user?.id)
      : null
    : null
  const matchedAdvocates = recommendedAdvocates.filter((person) => advocateMatchesCase(person, details))
  const inlineAdvocates = (matchedAdvocates.length ? matchedAdvocates : recommendedAdvocates).slice(0, 3)

  const locationLabel = location
    ? [location.city, location.state].filter(Boolean).join(', ')
    : locationStatus === 'loading'
      ? 'Detecting your location…'
      : 'Location not enabled'

  return (
    <div className="assistant-page">
      <PageHeader eyebrow="GENERAL LEGAL INFORMATION" title="Legal assistant" description="Talk through what’s happening. We’ll help you organize details, suggest practical next steps, and connect you with an advocate." />
      <div className="assistant-layout">
        <Card className="chat-card">
          <div className="chat-top"><div className="assistant-identity"><span className="assistant-avatar"><Sparkles size={17} /></span><div><strong>Nyaya assistant</strong><small><i className="online-dot" /> {isSupabaseConfigured ? 'AI-generated · general information' : 'Demo · general information'}</small></div></div><div className="chat-actions">{isSupabaseConfigured && <><label className="sr-only" htmlFor="conversation-select">Previous conversations</label><select id="conversation-select" value={conversationId} onChange={(event) => event.target.value ? loadSavedConversation(event.target.value) : startNewConversation()} disabled={loadingConversations}><option value="">{loadingConversations ? 'Loading…' : 'New conversation'}</option>{conversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.title}</option>)}</select><button className="icon-button" onClick={startNewConversation} aria-label="Start a new conversation"><Plus size={18} /></button></>}<Badge>Not legal advice</Badge></div></div>
          <div className="chat-scroll" ref={chatScrollRef} aria-live="polite">
            {!messages.length && <div className="chat-welcome"><span className="chat-welcome-icon"><MessageCircle size={22} /></span><h2>{loadingConversations ? 'Loading your conversations…' : 'What’s on your mind?'}</h2><p>Start with a short description. You don’t need to know legal terms.</p><div className="suggestion-list"><span>Try one of these</span>{['My salary has been delayed for a few months.', 'I need help understanding a rental deposit issue.', 'What details should I prepare before speaking to an advocate?'].map((suggestion) => <button key={suggestion} className="suggestion-chip" onClick={() => send(suggestion)}>{suggestion}<ArrowUpRight size={14} /></button>)}</div></div>}
            {messages.map((message, index) => {
              const hasAssistantResponse = message.clientMessageId && messages.some((candidate) =>
                candidate.role === 'assistant' && !candidate.connectionFailure && candidate.clientMessageId === message.clientMessageId,
              )
              const canRetry = isSupabaseConfigured && message.role === 'user' && message.clientMessageId &&
                !message.attachment && !hasAssistantResponse && !loading && !pendingRetry
              const hasAttachmentQuestion = (message.followUps || []).some((question) => question.type === 'attachment')
              const isFinalAnswer = !message.followUps?.length || Boolean(message.legalDraft) || Boolean(message.documentAnalysis)
              const showAdvocates = message.role === 'assistant' && !message.attachmentNotProcessed && index === lastAssistantIndex && inlineAdvocates.length > 0 && isFinalAnswer
              return <div key={message.id || `${message.role}-${index}`} className={`message-row message-${message.role}`}><span className={`message-avatar ${message.role === 'assistant' ? 'message-avatar-ai' : ''}`}>{message.role === 'assistant' ? <Sparkles size={15} /> : 'Y'}</span><div className="message-content"><div className="message-label">{message.role === 'assistant' ? 'Nyaya assistant' : 'You'}</div><p>{message.text}</p>{message.connectionFailure && pendingRetry?.clientMessageId === message.clientMessageId && <button className="button-as-link text-link small-link" onClick={() => send(pendingRetry.text, pendingRetry)} disabled={loading}>Try again</button>}{message.attachment && <div className="message-attachment"><Paperclip size={12} /><span>{message.attachment.fileName}</span><small>{formatAttachmentSize(message.attachment.size)}</small></div>}{message.attachments?.length > 0 && <div className="message-attachment-list">{message.attachments.map((file) => <span key={`${file.fileName}-${file.size}`}><Paperclip size={12} /> {file.fileName} <small>{formatAttachmentSize(file.size)}</small></span>)}</div>}{message.role === 'assistant' && !hasAttachmentQuestion && messageRequestsRecords(message) && <button type="button" className="attach-records-hint" onClick={() => openAttachmentPicker(!message.followUps?.length)} disabled={loading}><Paperclip size={13} /> Attach proof or records</button>}{message.role === 'assistant' && message.nextSteps?.length > 0 && <div className="inline-solutions"><strong>What you can do next</strong><ol>{message.nextSteps.map((step) => <li key={step}>{step}</li>)}</ol></div>}{message.followUps?.length > 0 && <FollowUpQuestions questions={message.followUps} messageKey={message.id || index} onAnswer={send} onAttach={() => openAttachmentPicker(false)} attachment={index === lastAssistantIndex ? attachment : null} onRemoveAttachment={() => setAttachment(null)} />}{message.legalDraft && <div className="legal-draft"><div className="legal-draft-head"><strong>Preliminary draft</strong><span>Review with an advocate before sending</span></div><pre>{message.legalDraft}</pre><button type="button" className="button-as-link text-link small-link" onClick={() => navigator.clipboard?.writeText(message.legalDraft)}>Copy draft</button></div>}{showAdvocates && <div className="inline-advocates"><div className="inline-advocates-head"><strong>Advocates who can help</strong><span>Suggested from your case details · not an endorsement</span></div><div className="inline-advocate-list">{inlineAdvocates.map((person) => <Link className="inline-advocate" to={`/app/lawyers/${person.id}`} state={{ fromAssistant: true, caseSummary: assistantContextForRequest(details), caseTitle: details?.category || '', attachmentFile: analyzedAttachment }} key={person.id}><span className="activity-avatar">{person.initials}</span><span className="inline-advocate-info"><strong>{person.name}</strong><small>{recommendationReason(person, details, location)}</small></span><span className="inline-advocate-fee">{formatFee(person.feeMin, person.feeMax)}</span><ArrowRight size={14} /></Link>)}</div><Link className="text-link small-link" to="/app/lawyers">Browse all advocates <ArrowRight size={14} /></Link></div>}{canRetry && <button className="button-as-link text-link small-link" onClick={() => send(message.text, { clientMessageId: message.clientMessageId })}>Retry assistant response</button>}</div></div>
            })}
            {loading && <div className="message-row message-assistant"><span className="message-avatar message-avatar-ai"><Sparkles size={15} /></span><div className="message-content"><div className="message-label">Nyaya assistant</div><div className="typing-indicator"><i /><i /><i /><span>{processingDocument ? 'Reading and analyzing your document…' : 'Organizing your details…'}</span></div></div></div>}
            {error && <div className="inline-error" role="alert"><span>{error}</span>{(pendingRetry || loadFailed) && <button onClick={() => pendingRetry ? send(pendingRetry.text, pendingRetry) : loadConversationList()} disabled={loading || loadingConversations}>{pendingRetry ? 'Retry' : 'Retry connection'}</button>}</div>}
          </div>
          {attachment && <div className="chat-attachment-preview"><Paperclip size={14} /><span><strong>{attachment.name}</strong><small>{formatAttachmentSize(attachment.size)}</small></span><button type="button" className="icon-button" onClick={() => setAttachment(null)} aria-label="Remove attachment"><X size={14} /></button></div>}
          {speechError && <p className="speech-input-status" role="status">{speechError}</p>}
          <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); send() }}><button type="button" className="attach-button" onClick={() => openAttachmentPicker(false)} disabled={loading} aria-label="Attach proof, record, or document" title="Attach proof, record, or document"><Paperclip size={17} /></button><input ref={attachmentInputRef} className="sr-only" type="file" accept={ATTACHMENT_ACCEPT} onChange={chooseAttachment} disabled={loading} aria-label="Choose a file to analyze" /><label className="sr-only" htmlFor="chat-input">Describe your legal concern</label><textarea id="chat-input" ref={inputRef} rows="1" placeholder={isListening ? 'Listening… speak now' : 'Type a message or attach a document… (avoid highly sensitive details)'} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() } }} /><button type="button" className={`attach-button voice-input-button ${isListening ? 'voice-input-active' : ''}`} onClick={toggleVoiceInput} disabled={loading} aria-label={isListening ? 'Stop voice typing' : 'Start voice typing'} title={isListening ? 'Stop voice typing' : 'Start voice typing'}>{isListening ? <MicOff size={17} /> : <Mic size={17} />}</button><button className="send-button" type="submit" disabled={(!input.trim() && !attachment) || loading} aria-label="Send message"><Send size={17} /></button></form>
          <div className="chat-disclaimer"><ShieldCheck size={14} /> {isSupabaseConfigured ? 'AI-generated general information, not legal advice. Attached files are processed in memory; the conversation and document analysis are saved to your account.' : 'Demo responses are general information, not legal advice.'}</div>
        </Card>
        <aside className="assistant-sidebar">
          <Card className="brief-card"><div className="card-title-row"><div><span className="eyebrow">YOUR CASE BRIEF</span><h3>What we know so far</h3></div><FileText size={17} className="muted" /></div>
            {!details ? <div className="brief-empty"><span className="brief-empty-icon"><Sparkles size={16} /></span><p>Your brief will take shape as you share details.</p></div> : <>{details.category && <div className="brief-section"><span className="brief-label">TENTATIVE CATEGORY</span><p className="brief-item">{details.category}</p></div>}{details.summary && <div className="brief-section"><span className="brief-label">SUMMARY</span><p className="brief-item">{details.summary}</p></div>}<div className="brief-section"><span className="brief-label">FACTS FROM YOUR MESSAGE</span>{details.facts?.length ? details.facts.map((fact) => <p className="brief-item" key={fact}>{fact}</p>) : <p className="brief-item">No user-stated facts listed yet.</p>}</div>{details.extractedFacts?.length > 0 && <div className="brief-section"><span className="brief-label">AI-EXTRACTED — PLEASE CHECK</span>{details.extractedFacts.map((fact) => <p className="brief-item brief-missing" key={fact}>{fact}</p>)}</div>}<div className="brief-section"><span className="brief-label">STILL TO CLARIFY</span>{details.missing.length ? details.missing.map((fact) => <p className="brief-item brief-missing" key={fact}>{fact}</p>) : <p className="brief-item">No missing information identified.</p>}</div></>}
          </Card>
          {documentAnalysis && <Card className="document-analysis-card">
            <div className="card-title-row"><div><span className="eyebrow">DOCUMENT ANALYSIS</span><h3>{details.documentName || 'Attached document'}</h3></div><FileText size={17} className="muted" /></div>
            <p className="card-muted">File contents are processed in memory · this analysis is saved to your account{details.documentPages ? ` · ${details.documentPages} page${details.documentPages === 1 ? '' : 's'}` : ''}.</p>
            {documentAnalysis.document_type && <div className="brief-section"><span className="brief-label">DOCUMENT TYPE</span><p className="brief-item">{documentAnalysis.document_type}</p></div>}
            {documentAnalysis.summary && <div className="brief-section"><span className="brief-label">SUMMARY</span><p className="brief-item">{documentAnalysis.summary}</p></div>}
            {documentAnalysis.parties?.length > 0 && <div className="brief-section"><span className="brief-label">PARTIES</span>{documentAnalysis.parties.map((party, index) => <p className="brief-item" key={`party-${index}`}>{[party.role, party.name].filter(Boolean).join(': ')}{pageLabel(party.page)}</p>)}</div>}
            {documentAnalysis.key_dates?.length > 0 && <div className="brief-section"><span className="brief-label">KEY DATES</span>{documentAnalysis.key_dates.map((item, index) => <p className="brief-item" key={`date-${index}`}>{[item.label, item.date].filter(Boolean).join(': ')}{pageLabel(item.page)}</p>)}</div>}
            {documentAnalysis.amounts?.length > 0 && <div className="brief-section"><span className="brief-label">AMOUNTS</span>{documentAnalysis.amounts.map((item, index) => <p className="brief-item" key={`amount-${index}`}>{[item.label, item.amount].filter(Boolean).join(': ')}{pageLabel(item.page)}</p>)}</div>}
            {documentAnalysis.important_clauses?.length > 0 && <div className="brief-section"><span className="brief-label">IMPORTANT CLAUSES</span>{documentAnalysis.important_clauses.map((item, index) => <p className="brief-item" key={`clause-${index}`}>{[item.clause, item.summary].filter(Boolean).join(' — ')}{pageLabel(item.page)}</p>)}</div>}
            {documentAnalysis.obligations?.length > 0 && <div className="brief-section"><span className="brief-label">OBLIGATIONS</span>{documentAnalysis.obligations.map((item, index) => <p className="brief-item" key={`obligation-${index}`}>{[item.party, item.obligation].filter(Boolean).join(': ')}{pageLabel(item.page)}</p>)}</div>}
            {documentAnalysis.rights?.length > 0 && <div className="brief-section"><span className="brief-label">RIGHTS</span>{documentAnalysis.rights.map((item, index) => <p className="brief-item" key={`right-${index}`}>{[item.party, item.right].filter(Boolean).join(': ')}{pageLabel(item.page)}</p>)}</div>}
            {documentAnalysis.deadlines?.length > 0 && <div className="brief-section"><span className="brief-label">DEADLINES</span>{documentAnalysis.deadlines.map((item, index) => <p className="brief-item" key={`deadline-${index}`}>{[item.label, item.date, item.status].filter(Boolean).join(' · ')}{pageLabel(item.page)}</p>)}</div>}
            {documentAnalysis.potential_concerns?.length > 0 && <div className="brief-section"><span className="brief-label">POTENTIAL CONCERNS</span>{documentAnalysis.potential_concerns.map((item, index) => <p className="brief-item brief-missing" key={`concern-${index}`}>{item.concern}{pageLabel(item.page)}</p>)}</div>}
            {documentAnalysis.inconsistencies?.length > 0 && <div className="brief-section"><span className="brief-label">POSSIBLE INCONSISTENCIES</span>{documentAnalysis.inconsistencies.map((item, index) => <p className="brief-item brief-missing" key={`inconsistency-${index}`}>{item.description}{item.document_says ? ` Document: ${item.document_says}.` : ''}{item.user_says ? ` You said: ${item.user_says}.` : ''}</p>)}</div>}
            {documentAnalysis.missing_information?.length > 0 && <div className="brief-section"><span className="brief-label">MISSING FROM THE DOCUMENT</span>{documentAnalysis.missing_information.map((item, index) => <p className="brief-item" key={`missing-${index}`}>{item}</p>)}</div>}
            <button type="button" className="text-link small-link document-session-clear" onClick={clearDocumentSession}>Clear document session</button>
          </Card>}
          {details?.documentName && !documentAnalysis && <Card className="document-analysis-card">
            <div className="card-title-row"><div><span className="eyebrow">DOCUMENT ANALYSIS</span><h3>{details.documentName}</h3></div><FileText size={17} className="muted" /></div>
            <p className="card-muted">File contents are processed in memory · this analysis is saved to your account.</p>
            <p className="brief-item">Structured extraction is unavailable right now, but the assistant used the extracted document text to prepare its answer.</p>
            <button type="button" className="text-link small-link document-session-clear" onClick={clearDocumentSession}>Clear document session</button>
          </Card>}
          <Card className="brief-card"><span className="eyebrow">ADVOCATES NEAR YOU</span><h3>Select someone to continue</h3>
            <div className="location-line"><MapPin size={13} /><span>{locationLabel}</span><button type="button" className="text-link small-link" onClick={locate} disabled={locationStatus === 'loading'}>{location ? 'Update' : 'Use my location'}</button></div>
            <p className="card-muted">{location?.state ? `Advocates and sample profiles in ${location.state}.` : locationStatus === 'denied' ? 'Location is off, so profiles from all regions are shown.' : 'Enable location to prioritize advocates near your case.'}</p>
            {advocateDirectoryError && <p className="field-error" role="alert">Published advocate profiles could not be loaded: {advocateDirectoryError}</p>}
            {recommendedAdvocates.length ? <div className="suggested-advocates">{recommendedAdvocates.map((person) => <Link className="suggested-advocate" to={`/app/lawyers/${person.id}`} state={{ fromAssistant: true, caseSummary: assistantContextForRequest(details), caseTitle: details?.category || '', documentName: details?.documentName || '', attachmentFile: analyzedAttachment }} key={person.id}><span className="activity-avatar">{person.initials}</span><span><strong>{person.name}</strong><small>{person.practiceAreas.join(' · ')} · {person.city}</small><small className="suggested-advocate-reason">{recommendationReason(person, details, location)}</small><small>Indicative consultation for {details?.category || person.practiceAreas[0]}: {formatFee(person.feeMin, person.feeMax)}</small></span><span className="suggested-advocate-action">Select <ArrowRight size={14} /></span></Link>)}</div> : details && location?.state ? <p className="brief-item">No profiles are listed in {location.state} for this case yet. You can still browse all advocates.</p> : <p className="brief-item">Share a few details about your concern to see advocates near you.</p>}
            <Link className="text-link small-link" to="/app/lawyers">Browse all advocates <ArrowRight size={14} /></Link>
          </Card>
          <Card className="next-steps-card"><span className="eyebrow">YOUR OPTIONS</span><h3>What you can do next</h3><p className="card-muted">General information, not legal instructions.</p>{details ? <ul className="next-step-list">{details.nextSteps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ul> : <EmptyState icon={Check} title="Start a conversation">Suggested next steps will appear here.</EmptyState>}<div className="source-note">General information only · For advice about your situation, speak with a qualified advocate.</div></Card>
        </aside>
      </div>
    </div>
  )
}

export function LawyersPage() {
  const [query, setQuery] = useState('')
  const [practice, setPractice] = useState('')
  const [state, setState] = useState('')
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [language, setLanguage] = useState('')
  const [feeMax, setFeeMax] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { profiles: publishedAdvocates, loading, error: directoryError } = useAdvocateDirectory()
  const directory = publishedAdvocates
  const filtered = useMemo(() => directory.filter((person) => {
    const searchable = `${person.name} ${person.practiceAreas.join(' ')}`.toLowerCase()
    return (!query || searchable.includes(query.toLowerCase())) &&
      (!practice || person.practiceAreas.includes(practice)) &&
      (!state || person.state === state) &&
      (!remoteOnly || person.remote) &&
      (!language || person.languages.includes(language)) &&
      (!feeMax || person.feeMin <= Number(feeMax))
  }), [directory, query, practice, state, remoteOnly, language, feeMax])
  const reset = () => { setQuery(''); setPractice(''); setState(''); setRemoteOnly(false); setLanguage(''); setFeeMax('') }
  return (
    <>
      <PageHeader eyebrow="YOUR CHOICE, ALWAYS" title="Find an advocate" description="Explore advocate-submitted profiles and clearly marked sample profiles by case area, location, and indicative consultation range." action={<Button variant="outline" className="filter-toggle" onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={16} /> Filters <ChevronDown size={14} /></Button>} />
      <DemoNotice>Advocate-submitted profiles are not independently verified</DemoNotice>
      <div className={`lawyer-discovery ${filtersOpen ? 'filters-expanded' : ''}`}>
        <aside className="filters-panel"><div className="filter-header"><strong>Filter profiles</strong><button className="text-link button-as-link" onClick={reset}>Reset</button></div>
          <Field label="Search" id="lawyer-search"><div className="input-icon-wrap"><Search size={16} /><input id="lawyer-search" placeholder="Name or practice area" value={query} onChange={(event) => setQuery(event.target.value)} /></div></Field>
          <Field label="Practice area" id="practice-filter"><select id="practice-filter" value={practice} onChange={(event) => setPractice(event.target.value)}><option value="">All practice areas</option>{['Employment', 'Labour', 'Family', 'Civil', 'Property', 'Consumer'].map((area) => <option key={area}>{area}</option>)}</select></Field>
          <Field label="State / jurisdiction" id="state-filter"><select id="state-filter" value={state} onChange={(event) => setState(event.target.value)}><option value="">All jurisdictions</option>{[...new Set(directory.map((item) => item.state).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Language" id="language-filter"><select id="language-filter" value={language} onChange={(event) => setLanguage(event.target.value)}><option value="">Any language</option>{['English', 'Hindi', 'Kannada', 'Malayalam', 'Marathi', 'Punjabi', 'Tamil'].map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Indicative maximum fee" id="fee-filter"><select id="fee-filter" value={feeMax} onChange={(event) => setFeeMax(event.target.value)}><option value="">Any range</option><option value="1000">Up to ₹1,000</option><option value="1500">Up to ₹1,500</option><option value="2000">Up to ₹2,000</option><option value="3000">Up to ₹3,000</option></select></Field>
          <label className="checkbox-field"><input type="checkbox" checked={remoteOnly} onChange={(event) => setRemoteOnly(event.target.checked)} /><span>Remote consultations</span></label>
          <div className="filter-footnote">Case-area matches show each advocate’s own indicative consultation range. Confirm the final fee directly.</div>
        </aside>
        <section className="lawyer-results">{directoryError && <p className="field-error" role="alert">Could not load published profiles: {directoryError}</p>}{loading && <p role="status">Loading published advocate profiles…</p>}<div className="results-toolbar"><span><strong>{filtered.length}</strong> profiles</span><span className="results-sort">Sorted by relevance <ChevronDown size={14} /></span></div>{filtered.length ? <div className="advocate-grid">{filtered.map((person) => <AdvocateCard person={person} key={person.id} />)}</div> : <Card><EmptyState icon={Search} title="No profiles match those filters">Try changing your search or clearing one of the selected filters.<Button variant="outline" onClick={reset}>Clear filters</Button></EmptyState></Card>}<div className="match-explanation"><ShieldCheck size={17} /><span>Advocate-submitted details are not independently verified. Sample profiles are fictional. Fees are indicative and should be confirmed directly.</span></div></section>
      </div>
    </>
  )
}

function AdvocateCard({ person }) {
  return <Card className="advocate-card"><div className="advocate-card-top"><span className="avatar avatar-large">{person.initials}</span><Badge>{person.verificationStatus}</Badge></div><h3>{person.name}</h3><div className="advocate-subline"><MapPin size={14} /> {person.city}, {person.state} {person.remote && <span className="remote-tag"><Video size={13} /> Remote</span>}</div><div className="practice-tags">{person.practiceAreas.map((area) => <span key={area}>{area}</span>)}</div><div className="advocate-facts"><span>{person.yearsExperience} years’ experience</span><span>{person.languages.join(' · ')}</span></div><div className="advocate-card-bottom"><div><small>INDICATIVE CONSULTATION FEE</small><strong>{formatFee(person.feeMin, person.feeMax)}</strong></div><Link className="button button-outline button-compact" to={`/app/lawyers/${person.id}`}>View profile <ArrowRight size={14} /></Link></div><p className="profile-disclaimer">{person.isSample ? 'Fictional sample profile · Not verified' : 'Advocate-submitted · Not independently verified'}</p></Card>
}

export function LawyerProfilePage() {
  const { id } = useParams()
  const location = useLocation()
  const { createRequest, createDemoRequest, user } = useDemo()
  const { profiles: publishedAdvocates, loading, error: directoryError } = useAdvocateDirectory()
  const person = publishedAdvocates.find((item) => item.id === id)
  const assistantSuggestion = location.state?.fromAssistant ? location.state : null
  const [showRequest, setShowRequest] = useState(Boolean(assistantSuggestion))
  const [message, setMessage] = useState('')
  const [preferredTime, setPreferredTime] = useState('')
  const [requestFile, setRequestFile] = useState(() => {
    if (!assistantSuggestion || person?.isSample) return null
    const suggestedFile = assistantSuggestion.attachmentFile
    if (suggestedFile) return suggestedFile
    const analyzedFile = analyzedFilesByUser.get(user?.id)
    return assistantSuggestion.caseTitle && analyzedFile?.name === assistantSuggestion.documentName
      ? analyzedFile
      : null
  })
  const [documentConsent, setDocumentConsent] = useState(false)
  const [aiProcessingConsent, setAiProcessingConsent] = useState(false)
  const [savedRequest, setSavedRequest] = useState(null)
  const [error, setError] = useState('')
  const [creatingRequest, setCreatingRequest] = useState(false)
  const requestFileInput = useRef(null)
  const navigate = useNavigate()
  if (!person && loading) return <p role="status">Loading advocate profile…</p>
  if (!person) return <div className="inline-error">{directoryError ? `Could not load advocate profiles: ${directoryError}` : 'This advocate profile is not available.'} <Link to="/app/lawyers">Back to advocate search</Link></div>
  const submitRequest = async (event) => {
    event.preventDefault()
    if (message.trim().length < 10) { setError('Please add a little more context (at least 10 characters).'); return }
    if (!savedRequest && !person.isSample && !aiProcessingConsent) { setError('Please confirm AI processing of your concern so a preliminary case brief can be prepared.'); return }
    if (requestFile && !person.isSample && !documentConsent) { setError('Please confirm that you want to share this document with the advocate.'); return }
    if (requestFile && requestFile.size > MAX_ATTACHMENT_BYTES) { setError('Documents must be 15 MB or smaller.'); return }
    if (requestFile && !ATTACHMENT_ACCEPT.split(',').some((accepted) => accepted.startsWith('.') && requestFile.name.toLowerCase().endsWith(accepted))) {
      setError('Attach a PDF, PNG, JPG, WEBP, or plain-text document.')
      return
    }
    setCreatingRequest(true)
    setError('')
    let requestWasSaved = Boolean(savedRequest)
    try {
      let request = savedRequest
      if (!request) {
        const assistantDetails = assistantSuggestion?.caseSummary?.trim()
        let caseTitle = assistantSuggestion?.caseTitle || 'Consultation request'
        let caseSummary = [
          `Client concern:\n${message.trim()}`,
          assistantDetails ? `Details from the assistant conversation:\n${assistantDetails}` : '',
        ].filter(Boolean).join('\n\n')
        if (!person.isSample) {
          let briefResult
          try {
            briefResult = await generateConsultationBrief({
              clientConcern: message.trim(),
              assistantContext: assistantDetails || '',
              attachment: requestFile,
            })
          } catch {
            briefResult = {
              brief: null,
              aiGenerated: false,
              documentAnalyzed: false,
              warnings: ['The AI service could not be reached. The original concern will still be sent to the advocate.'],
            }
          }
          if (briefResult.aiGenerated && briefResult.brief) caseTitle = briefResult.brief.issue_title
          caseSummary = formatConsultationCaseSummary(message, assistantDetails, briefResult.brief, {
            aiGenerated: briefResult.aiGenerated,
            documentName: requestFile?.name || '',
            documentAnalyzed: briefResult.documentAnalyzed,
            warnings: briefResult.warnings,
          })
        }
        const requestData = {
          advocateId: person.id,
          advocateName: person.name,
          caseTitle,
          caseSummary,
          proposedTime: preferredTime || null,
          proposedFee: null,
        }
        request = person.isSample
          ? await createDemoRequest(requestData)
          : await createRequest(requestData)
        setSavedRequest(request)
        requestWasSaved = true
      }
      if (requestFile && !person.isSample && !request.documentAttached) {
        await uploadConsultationDocument(request.id, user.id, requestFile)
        request = { ...request, documentAttached: true }
        setSavedRequest(request)
      }
      setShowRequest(false)
      navigate('/app/requests')
    } catch (requestError) {
      setError(requestWasSaved
        ? `Your request is saved, but the document was not attached: ${requestError.message} You can retry the upload.`
        : `Could not save your request: ${requestError.message}`)
    } finally {
      setCreatingRequest(false)
    }
  }
  return (
    <>
      <div className="breadcrumb"><Link to="/app/lawyers">Find an advocate</Link><span>/</span><span>{person.name}</span></div>
      {assistantSuggestion && <div className="assistant-selection-note"><Sparkles size={16} /><span>Suggested from your assistant conversation. Review this profile, then request a consultation.</span></div>}
      <Card className="profile-main-card"><div className="profile-heading"><span className="avatar avatar-profile">{person.initials}</span><div className="profile-title"><span className="eyebrow">{person.isSample ? 'SAMPLE ADVOCATE PROFILE' : 'ADVOCATE-SUBMITTED PROFILE'}</span><h1>{person.name}</h1><p><MapPin size={15} /> {person.city}, {person.state} {person.remote && <span className="remote-tag"><Video size={13} /> Remote consultation</span>}</p></div><Badge>{person.verificationStatus}</Badge></div><div className="profile-main-body"><div className="profile-bio"><h2>About</h2><p>{person.bio}</p><h2>Practice areas</h2><div className="practice-tags">{person.practiceAreas.map((area) => <span key={area}>{area}</span>)}</div></div><aside className="profile-facts"><div><span>Experience</span><strong>{person.yearsExperience} years</strong></div><div><span>Jurisdiction</span><strong>{person.jurisdictions.join(', ')}</strong></div><div><span>Languages</span><strong>{person.languages.join(', ')}</strong></div>{person.email && <div><span>{person.isSample ? 'Sample email address' : 'Email'}</span><strong>{person.email}</strong></div>}<div><span>{assistantSuggestion?.caseTitle ? `Indicative consultation · ${assistantSuggestion.caseTitle} case` : 'Indicative consultation range'}</span><strong>{formatFee(person.feeMin, person.feeMax)}</strong></div><small>Fee provided by the advocate for an initial consultation; confirm the scope and final amount directly.{person.isSample ? ' Sample email uses the reserved example.com domain and is not a real contact.' : ''}</small></aside></div><div className="profile-actions"><Button onClick={() => setShowRequest(true)}>{person.isSample ? 'Try demo request' : 'Request a consultation'} <ArrowRight size={16} /></Button><span><ShieldCheck size={15} /> {person.isSample ? 'Demo only: not sent to a real advocate.' : 'Requests are saved to your account.'}</span></div><div className="profile-caveat"><ShieldCheck size={16} /><p>{person.isSample ? 'Fictional sample profile only; it does not represent a real advocate. Demo requests last only for this session and do not contact anyone.' : 'Profile details are advocate-submitted and have not been independently verified.'}</p></div></Card>
      {showRequest && <Modal title={person.isSample ? 'Try a sample consultation' : 'Request a consultation'} onClose={() => setShowRequest(false)}>
        <p className="modal-intro">{person.isSample
          ? 'This is a demo only. The sample advocate is fictional; nothing will be sent to a person, and chat, files, and calls are not available.'
          : `Your concern and any attached document will be shared with ${person.name} when you send this request.`}</p>
        {assistantSuggestion?.caseSummary && <div className="request-assistant-details"><strong>Details from your assistant conversation</strong><p>{assistantSuggestion.caseSummary}</p></div>}
        <form onSubmit={submitRequest} className="modal-form">
          <Field label="What is your concern?" id="request-message" hint="Tell the advocate what help you need. Avoid passwords or payment details.">
            <textarea id="request-message" rows="4" maxLength="6000" placeholder="Briefly describe what happened and what you would like help with…" value={message} onChange={(event) => { setMessage(event.target.value); setAiProcessingConsent(false) }} disabled={Boolean(savedRequest)} required />
          </Field>
          {!person.isSample && <>
            <div className="request-document-picker">
              <input ref={requestFileInput} className="sr-only" type="file" accept={ATTACHMENT_ACCEPT} aria-label="Choose a document to share with the advocate" disabled={creatingRequest || Boolean(savedRequest)} onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                if (file.size > MAX_ATTACHMENT_BYTES) {
                  setError('Documents must be 15 MB or smaller.')
                  return
                }
                setRequestFile(file)
                setDocumentConsent(false)
                setAiProcessingConsent(false)
                setError('')
              }} />
              <div className="request-document-row">
                <span><Paperclip size={15} /> {requestFile ? requestFile.name : 'No document attached'}</span>
                <div className="request-document-actions">
                  <Button type="button" variant="outline" className="button-compact" onClick={() => requestFileInput.current?.click()} disabled={creatingRequest || Boolean(savedRequest)}>
                    {requestFile ? 'Choose another' : 'Attach document'}
                  </Button>
                  {requestFile && <Button type="button" variant="outline" className="button-compact" onClick={() => { setRequestFile(null); setDocumentConsent(false); setAiProcessingConsent(false) }} disabled={creatingRequest || Boolean(savedRequest)}>Remove</Button>}
                </div>
              </div>
              {!person.isSample && <label className="request-document-consent">
                <input type="checkbox" checked={aiProcessingConsent} onChange={(event) => setAiProcessingConsent(event.target.checked)} disabled={creatingRequest || Boolean(savedRequest)} />
                <span>I agree that my concern, assistant intake details, and any attached document may be processed by the configured AI service to prepare a preliminary brief. I will review it; it is not legal advice.</span>
              </label>}
              {requestFile && <label className="request-document-consent">
                <input type="checkbox" checked={documentConsent} onChange={(event) => setDocumentConsent(event.target.checked)} disabled={creatingRequest} />
                <span>I also agree to share this document with the advocate as part of my request.</span>
              </label>}
            </div>
          </>}
          <Field label="Preferred time (optional)" id="request-time"><input id="request-time" type="datetime-local" value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} disabled={Boolean(savedRequest)} /></Field>
          {error && <p className="field-error" role="alert">{error}</p>}
          {savedRequest && <p className="request-upload-retry" role="status">Your request is saved. {requestFile && !savedRequest.documentAttached ? 'Retry to attach the document; it has not been shared yet.' : ''}</p>}
          <div className="modal-actions">
            <Button type="button" variant="outline" onClick={() => setShowRequest(false)}>Cancel</Button>
            <Button type="submit" disabled={creatingRequest || (Boolean(savedRequest?.documentAttached))}>{creatingRequest ? 'Saving…' : savedRequest ? 'Retry document upload' : person.isSample ? 'Save demo request' : 'Send consultation request'} <ArrowRight size={15} /></Button>
          </div>
        </form>
      </Modal>}
    </>
  )
}

export function RequestsPage() {
  const { requests, updateRequest, deleteRequest, requestsLoading, requestError } = useDemo()
  const [confirming, setConfirming] = useState(null)
  const [filter, setFilter] = useState('all')
  const [actionError, setActionError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const visible = requests.filter((request) => filter === 'all' || request.status === filter)
  const confirmAction = async () => {
    if (!confirming) return
    setActionBusy(true)
    setActionError('')
    try {
      if (confirming.action === 'remove') await deleteRequest(confirming.id)
      else await updateRequest(confirming.id, { status: confirming.action === 'confirm' ? 'confirmed' : 'cancelled' })
      setConfirming(null)
    } catch (saveError) {
      setActionError(`Could not save your change: ${saveError.message}`)
    } finally {
      setActionBusy(false)
    }
  }
  return (
    <>
      <PageHeader eyebrow="YOUR CONNECTIONS" title="Consultation requests" description="Track saved requests, review proposed terms, and open a private conversation after acceptance." action={<Link className="button button-outline" to="/app/lawyers"><Plus size={16} /> Find an advocate</Link>} />
      <DemoNotice>Requests and responses are saved to your account</DemoNotice>
      {(requestError || actionError) && <p className="form-error" role="alert">{actionError || `Could not load requests: ${requestError}`}</p>}
      <div className="tabs-row" role="tablist" aria-label="Filter consultation requests">{[['all', 'All requests'], ['pending', 'Pending'], ['counter_proposed', 'Counter-proposed'], ['confirmed', 'Confirmed']].map(([key, label]) => <button key={key} role="tab" aria-selected={filter === key} className={filter === key ? 'tab-active' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div>
      {requestsLoading ? <p role="status">Loading your requests…</p> : <div className="request-list">{visible.map((request) => <Card className="request-card" key={request.id}><div className="request-card-header"><div className="request-person"><span className="avatar">{request.advocateName.split(' ').map((part) => part[0]).join('')}</span><div><h3>{request.advocateName}</h3><span>{request.caseTitle}</span></div></div><Badge>{request.status.replace('_', ' ')}</Badge></div><div className="request-meta"><span><Clock3 size={14} /> Sent {formatDate(request.createdAt)}</span><span>Reference {request.id}</span></div>
        {request.status === 'counter_proposed' && <div className="proposal-box"><div><span className="eyebrow">A DIFFERENT ARRANGEMENT WAS PROPOSED</span><p><Clock3 size={14} /> {request.proposedTime ? formatDate(request.proposedTime) : 'Time to be agreed'} <span className="proposal-divider">·</span> {request.proposedFee ? `Indicative fee ₹${request.proposedFee.toLocaleString('en-IN')}` : 'Fee to be agreed'}</p><small>Review the proposed details before choosing. No appointment is confirmed until you accept.</small></div><div className="proposal-actions"><Button onClick={() => setConfirming({ id: request.id, action: 'confirm', name: request.advocateName })}><Check size={15} /> Confirm proposal</Button><Button variant="outline" onClick={() => setConfirming({ id: request.id, action: 'decline', name: request.advocateName })}>Decline</Button></div></div>}
        {request.isDemo && <div className="request-status-note status-neutral"><ShieldCheck size={16} /><span>Demo only: visible for this session and not sent to an advocate. Chat, documents, and calls are unavailable.</span></div>}
        {!request.isDemo && request.status === 'accepted' && <div className="request-status-note"><Check size={16} /><span>Your request was accepted. Coordinate the time and terms directly before treating an appointment as confirmed.</span></div>}
        {!request.isDemo && request.status === 'pending' && <div className="request-status-note status-pending"><Clock3 size={16} /><span>Waiting for the advocate to respond.</span></div>}
        {request.status === 'confirmed' && <div className="request-status-note"><Check size={16} /><span>You confirmed the proposed terms. Coordinate final details directly.</span></div>}
        {request.status === 'declined' && <div className="request-status-note status-declined"><X size={16} /><span>This request was declined.</span></div>}
        {request.status === 'cancelled' && <div className="request-status-note status-neutral"><X size={16} /><span>This request or proposal was cancelled.</span></div>}
        {!request.isDemo && ['accepted', 'confirmed'].includes(request.status) && <div className="request-row-actions"><Link className="button button-outline button-compact" to={`/app/requests/${request.id}`}><MessageCircle size={14} /> Open chat, files, and calls</Link></div>}
        <div className="request-row-actions"><Button type="button" variant="outline" className="button-compact" onClick={() => setConfirming({ id: request.id, action: 'remove', name: request.advocateName, isDemo: request.isDemo })}><Trash2 size={14} /> Remove from my list</Button></div>
      </Card>)}
      {!visible.length && <Card><EmptyState icon={MessageCircle} title="No requests in this view">Find a published advocate to create a consultation request.<Link className="button button-outline" to="/app/lawyers">Explore advocates</Link></EmptyState></Card>}</div>}
      {confirming && <Modal title={confirming.action === 'confirm' ? 'Confirm this proposal?' : confirming.action === 'remove' ? 'Remove this request from your list?' : 'Decline this proposal?'} onClose={() => setConfirming(null)}><p className="modal-intro">{confirming.action === 'confirm' ? `Confirm the proposed terms from ${confirming.name}. This does not schedule an appointment.` : confirming.action === 'remove' ? confirming.isDemo ? 'This removes the locally saved demo request from this browser. No advocate has received it.' : 'This hides the request from your list. The other participant retains their copy and consultation history.' : `Cancel the proposal from ${confirming.name}.`}</p>{actionError && <p className="field-error" role="alert">{actionError}</p>}<div className="modal-actions"><Button variant="outline" onClick={() => setConfirming(null)}>Go back</Button><Button variant={confirming.action === 'remove' ? 'danger' : 'primary'} onClick={confirmAction} disabled={actionBusy}>{actionBusy ? 'Saving…' : confirming.action === 'confirm' ? 'Confirm proposal' : confirming.action === 'remove' ? 'Remove request' : 'Decline proposal'}</Button></div></Modal>}
    </>
  )
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState(mockDocuments)
  const [selected, setSelected] = useState(null)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const openDocument = (document) => { setSelected(document); setContent(document.content); setSaveMessage('') }
  const save = async () => {
    setSaving(true)
    setSaveMessage('')
    try {
      const result = await saveDemoDraft(content)
      setDocuments((current) => current.map((document) => document.id === selected.id ? { ...document, content, updated: new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(result.savedAt)) } : document))
      setSaveMessage('Saved in this demo session.')
    } catch {
      setSaveMessage('Could not save this demo draft. Please try again.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <PageHeader eyebrow="YOUR PRIVATE SPACE" title="Documents" description="Review sample notes and editable draft content. No real files are uploaded or shared." />
      <div className="documents-notice"><ShieldCheck size={18} /><div><strong>Your documents are private in this prototype.</strong><span>Uploads and sharing are not connected. Sample items below are fictional placeholders.</span></div></div>
      <div className="document-list">{documents.map((document) => <Card className="document-row" key={document.id}><span className="document-icon"><FileText size={19} /></span><div className="document-info"><h3>{document.title}</h3><span>{document.type} <i>·</i> Updated {document.updated}</span></div><Badge>{document.status}</Badge><Button variant="outline" className="button-compact" onClick={() => openDocument(document)}>{document.type === 'Draft letter' ? 'Review draft' : 'Preview'} <ArrowRight size={14} /></Button></Card>)}</div>
      <div className="document-bottom-note"><ShieldCheck size={16} /><span>AI-generated drafts are unreviewed and may be incomplete. Verify facts and seek qualified advice before using a draft.</span></div>
      {selected && <Modal title={selected.title} onClose={() => setSelected(null)} wide><p className="modal-intro"><Badge>{selected.status}</Badge> <span className="document-modal-type">{selected.type} · Demo content</span></p><Field label="Preview / edit demo text" id="document-editor" hint="Changes are held in this browser session only."><textarea className="document-editor" id="document-editor" rows="15" value={content} onChange={(event) => setContent(event.target.value)} /></Field>{saveMessage && <p className={saveMessage.startsWith('Could not') ? 'field-error' : 'save-success'} role="status">{saveMessage}</p>}<div className="modal-actions"><Button variant="outline" onClick={() => setSelected(null)}>Close</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save in demo'} <Check size={15} /></Button></div></Modal>}
    </>
  )
}
