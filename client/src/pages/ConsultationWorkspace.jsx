import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, MessageCircle, Mic, MicOff, Paperclip, Phone, Send, Video, VideoOff, X } from 'lucide-react'
import { useDemo } from '../context/useDemo'
import {
  createDocumentDownloadUrl,
  fetchActiveCall,
  fetchCallSignals,
  fetchConsultationDocuments,
  fetchConsultationMessages,
  sendCallSignal,
  sendConsultationMessage,
  setConsultationCallStatus,
  startConsultationCall,
  uploadConsultationDocument,
} from '../services/consultations'
import { Button, Card, DemoNotice, PageHeader } from '../components/UI'
import { supabase } from '../services/supabase'

function formatMessageTime(value) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatFileSize(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function CallControls({ requestId, user, setError }) {
  const [call, setCall] = useState(null)
  const [remoteReady, setRemoteReady] = useState(false)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [callBusy, setCallBusy] = useState(false)
  const [hasPeerConnection, setHasPeerConnection] = useState(false)
  const localVideo = useRef(null)
  const remoteVideo = useRef(null)
  const peer = useRef(null)
  const localStream = useRef(null)
  const processedSignalId = useRef(0)
  const pendingCandidates = useRef([])
  const callRef = useRef(null)

  useEffect(() => { callRef.current = call }, [call])

  const closeMedia = useCallback(() => {
    callRef.current = null
    peer.current?.close()
    peer.current = null
    setHasPeerConnection(false)
    localStream.current?.getTracks().forEach((track) => track.stop())
    localStream.current = null
    if (localVideo.current) localVideo.current.srcObject = null
    if (remoteVideo.current) remoteVideo.current.srcObject = null
    setRemoteReady(false)
    setCall(null)
  }, [])

  const endCall = useCallback(async () => {
    const active = callRef.current
    closeMedia()
    if (active) {
      try {
        await setConsultationCallStatus(active.id, 'ended')
      } catch (endError) {
        setError(`Could not save the call ending: ${endError.message}`)
      }
    }
  }, [closeMedia, setError])

  useEffect(() => () => {
    peer.current?.close()
    localStream.current?.getTracks().forEach((track) => track.stop())
  }, [])

  useEffect(() => {
    let active = true
    let previousCallId = ''
    const poll = async () => {
      try {
        const current = await fetchActiveCall(requestId)
        if (!active) return
        if (!current) {
          if (callRef.current) closeMedia()
          previousCallId = ''
          return
        }
        if (current.id !== previousCallId) {
          previousCallId = current.id
          processedSignalId.current = 0
          pendingCandidates.current = []
          if (callRef.current?.status !== current.status) setCall(current)
        } else {
          if (callRef.current?.status !== current.status) setCall(current)
        }
      } catch (pollError) {
        if (active) setError(`Could not check call status: ${pollError.message}`)
      }
    }
    poll()
    const timer = window.setInterval(poll, 1800)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [requestId, closeMedia, setError])

  const startPeer = useCallback(async (activeCall, initiator) => {
    if (peer.current) return
    setError('')
    setCallBusy(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: activeCall.call_type === 'video',
      })
      localStream.current = stream
      if (localVideo.current) localVideo.current.srcObject = stream

      const connection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      peer.current = connection
      setHasPeerConnection(true)
      stream.getTracks().forEach((track) => connection.addTrack(track, stream))
      connection.ontrack = (event) => {
        if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0]
        setRemoteReady(true)
      }
      connection.onicecandidate = (event) => {
        if (event.candidate) {
          sendCallSignal(activeCall.id, user.id, 'ice', event.candidate.toJSON())
            .catch((signalError) => setError(`Could not send call network data: ${signalError.message}`))
        }
      }
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === 'failed') {
          setError('The call could not connect. This network may require a TURN relay to allow peer-to-peer calls.')
        }
      }

      if (initiator) {
        const offer = await connection.createOffer()
        await connection.setLocalDescription(offer)
        await sendCallSignal(activeCall.id, user.id, 'offer', offer.toJSON())
      } else {
        let offerSignal = null
        let initialSignals = []
        for (let attempt = 0; attempt < 10 && !offerSignal; attempt += 1) {
          initialSignals = await fetchCallSignals(activeCall.id, 0)
          offerSignal = initialSignals.find((signal) => signal.signal_type === 'offer')
          if (!offerSignal) await new Promise((resolve) => window.setTimeout(resolve, 600))
        }
        if (!offerSignal) throw new Error('The caller’s offer did not arrive. Ask them to start the call again.')
        processedSignalId.current = Math.max(
          processedSignalId.current,
          ...initialSignals.map((signal) => signal.id),
        )
        pendingCandidates.current.push(...initialSignals
          .filter((signal) => signal.sender_id !== user.id && signal.signal_type === 'ice')
          .map((signal) => new RTCIceCandidate(signal.payload)))
        await connection.setRemoteDescription(offerSignal.payload)
        for (const candidate of pendingCandidates.current.splice(0)) await connection.addIceCandidate(candidate)
        const answer = await connection.createAnswer()
        await connection.setLocalDescription(answer)
        await sendCallSignal(activeCall.id, user.id, 'answer', answer.toJSON())
        await setConsultationCallStatus(activeCall.id, 'active')
      }
    } catch (callError) {
      peer.current?.close()
      peer.current = null
      setHasPeerConnection(false)
      localStream.current?.getTracks().forEach((track) => track.stop())
      localStream.current = null
      setError(`Could not start the ${activeCall.call_type} call: ${callError.message}`)
      try {
        await setConsultationCallStatus(activeCall.id, 'ended')
      } catch (statusError) {
        setError(`Could not start the call: ${callError.message}. Could not clear its invitation: ${statusError.message}`)
      }
    } finally {
      setCallBusy(false)
    }
  }, [setError, user.id])

  useEffect(() => {
    if (!call || !peer.current) return undefined
    let active = true
    const pollSignals = async () => {
      try {
        const signals = await fetchCallSignals(call.id, processedSignalId.current)
        for (const signal of signals) {
          processedSignalId.current = Math.max(processedSignalId.current, signal.id)
          if (signal.sender_id === user.id) continue
          const connection = peer.current
          if (!connection) return
          if (signal.signal_type === 'answer' && !connection.currentRemoteDescription) {
            await connection.setRemoteDescription(signal.payload)
            for (const candidate of pendingCandidates.current.splice(0)) await connection.addIceCandidate(candidate)
          } else if (signal.signal_type === 'offer' && call.started_by !== user.id && !connection.currentRemoteDescription) {
            await connection.setRemoteDescription(signal.payload)
            const answer = await connection.createAnswer()
            await connection.setLocalDescription(answer)
            await sendCallSignal(call.id, user.id, 'answer', answer.toJSON())
            await setConsultationCallStatus(call.id, 'active')
          } else if (signal.signal_type === 'ice') {
            const candidate = new RTCIceCandidate(signal.payload)
            if (connection.currentRemoteDescription) await connection.addIceCandidate(candidate)
            else pendingCandidates.current.push(candidate)
          }
        }
      } catch (signalError) {
        if (active) setError(`Call signaling failed: ${signalError.message}`)
      }
    }
    const timer = window.setInterval(pollSignals, 1000)
    pollSignals()
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [call, callBusy, setError, user.id])

  const beginCall = async (type) => {
    setError('')
    try {
      const newCall = await startConsultationCall(requestId, user.id, type)
      setCall(newCall)
      callRef.current = newCall
      await startPeer(newCall, true)
    } catch (callError) {
      setError(`Could not create the call: ${callError.message}`)
    }
  }

  const joinCall = async () => {
    if (!call) return
    await startPeer(call, false)
  }

  const toggleTracks = (kind, setOff, isOff) => {
    localStream.current?.getTracks()
      .filter((track) => track.kind === kind)
      .forEach((track) => { track.enabled = isOff })
    setOff(!isOff)
  }

  return (
    <Card className="communication-call-card">
      <div className="communication-section-title"><div><span className="eyebrow">PRIVATE CALL</span><h2>Voice or video</h2></div><Phone size={18} /></div>
      <p className="card-muted">Calls are peer-to-peer. Your browser will ask for microphone or camera access.</p>
      {!call ? <div className="call-start-actions">
        <Button variant="outline" onClick={() => beginCall('audio')} disabled={callBusy}><Phone size={15} /> Voice call</Button>
        <Button variant="outline" onClick={() => beginCall('video')} disabled={callBusy}><Video size={15} /> Video call</Button>
      </div> : <div className="call-active">
        <p role="status">{call.started_by === user.id ? `Calling… (${call.call_type})` : `Incoming ${call.call_type} call`}</p>
        {!hasPeerConnection && <div className="call-start-actions">
          {call.started_by !== user.id && <Button onClick={joinCall} disabled={callBusy}>{callBusy ? 'Connecting…' : 'Answer call'}</Button>}
          <Button type="button" variant="danger" onClick={endCall}>{call.started_by === user.id ? 'Cancel call' : 'Decline call'}</Button>
        </div>}
        <div className={`call-video-grid ${call.call_type === 'audio' ? 'call-audio-only' : ''}`}>
          <video ref={remoteVideo} autoPlay playsInline aria-label="Other participant" />
          <video ref={localVideo} autoPlay muted playsInline aria-label="Your camera" />
          {call.call_type === 'audio' && <span>{remoteReady ? 'Connected' : 'Waiting for the other participant…'}</span>}
        </div>
        {hasPeerConnection && <div className="call-controls">
          <Button type="button" variant="outline" onClick={() => toggleTracks('audio', setMuted, muted)}>{muted ? <MicOff size={15} /> : <Mic size={15} />}{muted ? 'Unmute' : 'Mute'}</Button>
          {call.call_type === 'video' && <Button type="button" variant="outline" onClick={() => toggleTracks('video', setCameraOff, cameraOff)}>{cameraOff ? <VideoOff size={15} /> : <Video size={15} />}{cameraOff ? 'Camera on' : 'Camera off'}</Button>}
          <Button type="button" variant="danger" onClick={endCall}><Phone size={15} /> End call</Button>
        </div>}
      </div>}
      <small className="call-privacy-note">Calls use a public STUN server for connection discovery. Some networks require a TURN relay, which this deployment does not configure.</small>
    </Card>
  )
}

export default function ConsultationWorkspace() {
  const { id } = useParams()
  const { user, requests, requestsLoading, requestError, isSupabaseConfigured } = useDemo()
  const request = requests.find((item) => item.id === id)
  const [messages, setMessages] = useState([])
  const [documents, setDocuments] = useState([])
  const [message, setMessage] = useState('')
  const [pageError, setPageError] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [openedFile, setOpenedFile] = useState('')
  const messagesEnd = useRef(null)
  const documentInput = useRef(null)
  const active = request && ['accepted', 'confirmed'].includes(request.status)

  useEffect(() => {
    let mounted = true
    if (!active) return () => { mounted = false }
    Promise.all([fetchConsultationMessages(id), fetchConsultationDocuments(id)])
      .then(([nextMessages, nextDocuments]) => {
        if (mounted) {
          setMessages(nextMessages)
          setDocuments(nextDocuments)
        }
      })
      .catch((loadError) => {
        if (mounted) setPageError(`Could not load this conversation: ${loadError.message}`)
      })
    if (!isSupabaseConfigured) return () => { mounted = false }
    const channel = supabase
      .channel(`consultation-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'consultation_messages',
        filter: `request_id=eq.${id}`,
      }, (payload) => {
        setMessages((current) => current.some((item) => item.id === payload.new.id) ? current : [...current, payload.new])
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'consultation_documents',
        filter: `request_id=eq.${id}`,
      }, () => {
        fetchConsultationDocuments(id)
          .then((nextDocuments) => setDocuments(nextDocuments))
          .catch((loadError) => setPageError(`Could not refresh shared files: ${loadError.message}`))
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setPageError('Live updates are unavailable. Reload the conversation to check for new messages.')
        }
      })
    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [active, id, isSupabaseConfigured])

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const send = async (event) => {
    event.preventDefault()
    if (!message.trim() || sending) return
    setSending(true)
    setPageError('')
    try {
      const saved = await sendConsultationMessage(id, user.id, message)
      setMessages((current) => current.some((item) => item.id === saved.id) ? current : [...current, saved])
      setMessage('')
    } catch (sendError) {
      setPageError(`Message not sent: ${sendError.message}`)
    } finally {
      setSending(false)
    }
  }

  const upload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setPageError('')
    try {
      const saved = await uploadConsultationDocument(id, user.id, file)
      setDocuments((current) => [saved, ...current])
    } catch (uploadError) {
      setPageError(`File not uploaded: ${uploadError.message}`)
    } finally {
      setUploading(false)
    }
  }

  const openDocument = async (document) => {
    setOpenedFile(document.id)
    setPageError('')
    const newWindow = window.open('about:blank', '_blank')
    if (newWindow) newWindow.opener = null
    try {
      const url = await createDocumentDownloadUrl(document.storage_path)
      if (newWindow) newWindow.location = url
      else setPageError('Your browser blocked the new tab. Allow pop-ups to open this private file.')
    } catch (downloadError) {
      newWindow?.close()
      setPageError(`Could not open this file: ${downloadError.message}`)
    } finally {
      setOpenedFile('')
    }
  }

  if (requestsLoading) return <p role="status">Loading consultation…</p>
  if (!request) return <div className="inline-error">{requestError || 'This consultation is not available.'} <Link to={user?.role === 'advocate' ? '/advocate/requests' : '/app/requests'}>Back to requests</Link></div>
  const requestsPath = user?.role === 'advocate' ? '/advocate/requests' : '/app/requests'

  return (
    <>
      <Link className="text-link small-link" to={requestsPath}><ArrowLeft size={14} /> Back to requests</Link>
      <PageHeader eyebrow="PRIVATE CONSULTATION" title={request.caseTitle} description={`With ${user?.role === 'advocate' ? request.citizenName : request.advocateName} · ${request.status.replace('_', ' ')}`} />
      {!active ? <DemoNotice>The private chat, file sharing, and calls unlock after the advocate accepts this request.</DemoNotice> : <DemoNotice>Private case conversation · Messages and shared files are visible to both participants</DemoNotice>}
      {!isSupabaseConfigured && <div className="inline-error" role="alert">Database-backed consultation messages, documents, and calls require Supabase. Configure and apply the consultation migration first.</div>}
      {pageError && <p className="form-error" role="alert">{pageError}</p>}
      {active && isSupabaseConfigured ? <div className="consultation-workspace">
        <div className="consultation-main-column">
          <Card className="consultation-chat-card">
            <div className="communication-section-title"><div><span className="eyebrow">CASE CONVERSATION</span><h2>Messages</h2></div><MessageCircle size={18} /></div>
            <div className="consultation-message-list" aria-live="polite">
              {!messages.length && <p className="consultation-empty">No messages yet. Send a message to start the conversation.</p>}
              {messages.map((item) => <div className={`consultation-message ${item.sender_id === user.id ? 'consultation-message-own' : ''}`} key={item.id}>
                <strong>{item.sender_id === user.id ? 'You' : user?.role === 'advocate' ? request.citizenName : request.advocateName}</strong>
                <p>{item.content}</p>
                <time dateTime={item.created_at}>{formatMessageTime(item.created_at)}</time>
              </div>)}
              <div ref={messagesEnd} />
            </div>
            <form className="consultation-composer" onSubmit={send}>
              <label className="sr-only" htmlFor="consultation-message">Write a private message</label>
              <textarea id="consultation-message" rows="2" maxLength="12000" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message…" />
              <Button type="submit" disabled={sending || !message.trim()}>{sending ? 'Sending…' : 'Send'} <Send size={14} /></Button>
            </form>
          </Card>
          <CallControls requestId={id} user={user} setError={setPageError} />
        </div>
        <aside className="consultation-side-column">
          <Card className="consultation-documents-card">
            <div className="communication-section-title"><div><span className="eyebrow">SHARED FILES</span><h2>Documents</h2></div><FileText size={18} /></div>
            <p className="card-muted">Private files are shared only with the two participants in this consultation. Maximum 15 MB per file.</p>
            <Button
              type="button"
              variant="outline"
              className="consultation-upload"
              onClick={() => documentInput.current?.click()}
              disabled={uploading}
            >
              <Paperclip size={15} /> {uploading ? 'Uploading…' : 'Upload a document'}
            </Button>
            <input
              ref={documentInput}
              className="sr-only"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,application/pdf,image/png,image/jpeg,image/webp,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              aria-label="Choose a document to share"
              onChange={upload}
              disabled={uploading}
            />
            <div className="consultation-file-list">
              {!documents.length && <p className="consultation-empty">No documents shared yet.</p>}
              {documents.map((document) => <button className="consultation-file-row" type="button" key={document.id} onClick={() => openDocument(document)} disabled={openedFile === document.id}>
                <FileText size={16} /><span><strong>{document.file_name}</strong><small>{formatFileSize(document.size_bytes)} · {formatMessageTime(document.created_at)}</small></span><span>{openedFile === document.id ? 'Opening…' : 'Open'}</span>
              </button>)}
            </div>
          </Card>
          <Card className="consultation-detail-card"><span className="eyebrow">SHARED CASE DETAILS</span><h2>{request.caseTitle}</h2><p>{request.caseSummary}</p><small>Only share documents and information relevant to this consultation. Avoid sending passwords or payment details.</small></Card>
        </aside>
      </div> : active && <Card><p>Set up Supabase to enable secure case messages, document sharing, and calls.</p></Card>}
      {request.status === 'declined' && <p className="request-status-note status-declined"><X size={15} /> This consultation request was declined.</p>}
    </>
  )
}
