import { supabase } from './supabase'

const requestSelection = `
  *,
  citizen:profiles!consultation_requests_citizen_id_fkey(full_name),
  advocate:profiles!consultation_requests_advocate_id_fkey(full_name)
`

export function toConsultationRequest(row) {
  return {
    id: row.id,
    citizenId: row.citizen_id,
    advocateId: row.advocate_id,
    citizenName: row.citizen?.full_name || 'Client',
    advocateName: row.advocate?.full_name || 'Advocate',
    caseTitle: row.case_title,
    caseSummary: row.case_summary,
    createdAt: row.created_at,
    status: row.status,
    proposedTime: row.proposed_time,
    requestedTime: row.requested_time,
    proposedFee: row.proposed_fee,
    proposalBy: row.proposal_by,
  }
}

export async function fetchConsultationRequests(user) {
  if (!supabase || !user?.id) return []
  const column = user.role === 'advocate' ? 'advocate_id' : 'citizen_id'
  const { data, error } = await supabase
    .from('consultation_requests')
    .select(requestSelection)
    .eq(column, user.id)
    .eq(user.role === 'advocate' ? 'advocate_hidden' : 'citizen_hidden', false)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map(toConsultationRequest)
}

export async function createConsultationRequest(request, user) {
  if (!supabase || !user?.id) throw new Error('Sign in before creating a consultation request.')
  const { data, error } = await supabase
    .from('consultation_requests')
    .insert({
      citizen_id: user.id,
      advocate_id: request.advocateId,
      case_title: request.caseTitle,
      case_summary: request.caseSummary,
      requested_time: request.proposedTime,
    })
    .select(requestSelection)
    .single()
  if (error) throw new Error(error.message)
  return toConsultationRequest(data)
}

export async function respondToConsultationRequest(id, action, updates = {}) {
  if (!supabase) throw new Error('Database is not configured.')
  const { data, error } = await supabase.rpc('respond_to_consultation_request', {
    p_request_id: id,
    p_action: action,
    p_proposed_fee: updates.proposedFee ?? null,
    p_proposed_time: updates.proposedTime ?? null,
  })
  if (error) throw new Error(error.message)
  return toConsultationRequest(data)
}

export async function archiveConsultationRequest(id, role) {
  if (!supabase) throw new Error('Database is not configured.')
  if (!['advocate', 'citizen'].includes(role)) throw new Error('Could not determine which account is removing this request.')
  const { error } = await supabase.rpc('archive_consultation_request', { p_request_id: id })
  if (error) throw new Error(error.message)
}

export async function fetchConsultationMessages(requestId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('consultation_messages')
    .select('id, request_id, sender_id, content, created_at')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data
}

export async function sendConsultationMessage(requestId, senderId, content) {
  if (!supabase) throw new Error('Database is not configured.')
  const { data, error } = await supabase
    .from('consultation_messages')
    .insert({ request_id: requestId, sender_id: senderId, content: content.trim() })
    .select('id, request_id, sender_id, content, created_at')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function fetchConsultationDocuments(requestId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('consultation_documents')
    .select('id, request_id, uploader_id, storage_path, file_name, content_type, size_bytes, created_at')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function uploadConsultationDocument(requestId, userId, file) {
  if (!supabase) throw new Error('Database is not configured.')
  if (file.size > 15 * 1024 * 1024) throw new Error('Choose a file smaller than 15 MB.')
  const mimeTypesByExtension = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    txt: 'text/plain',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
  const extension = file.name.split('.').pop()?.toLowerCase()
  const inferredType = mimeTypesByExtension[extension]
  const contentType = Object.values(mimeTypesByExtension).includes(file.type)
    ? file.type
    : (file.type === '' || file.type === 'application/octet-stream') ? inferredType : null
  if (!contentType) throw new Error('Use a PDF, JPG, PNG, WebP, text file, or Word document.')
  const safeName = file.name.replace(/[^\w.-]/g, '_').slice(-180)
  const storagePath = `${requestId}/${userId}/${crypto.randomUUID()}-${safeName}`
  const { error: uploadError } = await supabase.storage
    .from('consultation-documents')
    .upload(storagePath, file, { contentType, upsert: false })
  if (uploadError) throw new Error(uploadError.message)

  const { data, error } = await supabase
    .from('consultation_documents')
    .insert({
      request_id: requestId,
      uploader_id: userId,
      storage_path: storagePath,
      file_name: file.name,
      content_type: contentType,
      size_bytes: file.size,
    })
    .select('id, request_id, uploader_id, storage_path, file_name, content_type, size_bytes, created_at')
    .single()
  if (error) {
    const { error: cleanupError } = await supabase.storage.from('consultation-documents').remove([storagePath])
    if (cleanupError) throw new Error(`${error.message}. Uploaded file cleanup failed: ${cleanupError.message}`)
    throw new Error(error.message)
  }
  return data
}

export async function createDocumentDownloadUrl(storagePath) {
  if (!supabase) throw new Error('Database is not configured.')
  const { data, error } = await supabase.storage
    .from('consultation-documents')
    .createSignedUrl(storagePath, 60)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export async function fetchActiveCall(requestId) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('consultation_calls')
    .select('id, request_id, started_by, call_type, status, created_at')
    .eq('request_id', requestId)
    .in('status', ['ringing', 'active'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function startConsultationCall(requestId, userId, callType) {
  if (!supabase) throw new Error('Database is not configured.')
  const { data, error } = await supabase
    .from('consultation_calls')
    .insert({ request_id: requestId, started_by: userId, call_type: callType })
    .select('id, request_id, started_by, call_type, status, created_at')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function setConsultationCallStatus(callId, status) {
  if (!supabase) throw new Error('Database is not configured.')
  const { error } = await supabase.rpc('set_consultation_call_status', {
    p_call_id: callId,
    p_status: status,
  })
  if (error) throw new Error(error.message)
}

export async function sendCallSignal(callId, senderId, signalType, payload = {}) {
  if (!supabase) throw new Error('Database is not configured.')
  const { error } = await supabase
    .from('consultation_call_signals')
    .insert({ call_id: callId, sender_id: senderId, signal_type: signalType, payload })
  if (error) throw new Error(error.message)
}

export async function fetchCallSignals(callId, afterId = 0) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('consultation_call_signals')
    .select('id, sender_id, signal_type, payload, created_at')
    .eq('call_id', callId)
    .gt('id', afterId)
    .order('id')
  if (error) throw new Error(error.message)
  return data
}
