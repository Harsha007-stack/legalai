import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, Check, Clock3, FileText, MapPin, MessageCircle, ShieldCheck, Trash2, Video, X, Sparkles } from 'lucide-react'
import { formatDate, formatFee } from '../data/mockData'
import { splitConsultationCaseSummary } from '../data/caseBrief'
import { useDemo } from '../context/useDemo'
import { fetchOwnAdvocateProfile, saveAdvocateProfile } from '../services/advocates'
import { generateAdvocateBio } from '../services/ai'
import { createDocumentDownloadUrl, fetchConsultationDocuments } from '../services/consultations'
import { Badge, Button, Card, DemoNotice, EmptyState, Field, Modal, PageHeader } from '../components/UI'

const PRACTICE_AREA_OPTIONS = [
  'Arbitration', 'Banking and Finance', 'Civil', 'Commercial', 'Consumer', 'Constitutional',
  'Contract', 'Corporate', 'Criminal', 'Cyber', 'Education', 'Employment', 'Environmental',
  'Family', 'Human Rights', 'Immigration', 'Insurance', 'Intellectual Property', 'Labour',
  'Property', 'Tax', 'Other',
]

function RequestCaseSummary({ summary }) {
  const { clientContext, aiBrief, aiGenerated } = splitConsultationCaseSummary(summary || '')
  return <>
    {aiBrief && <div className="request-ai-case-brief"><strong>{aiGenerated ? 'AI-generated preliminary case summary' : 'Preliminary intake note'}</strong><p>{aiBrief}</p><small>{aiGenerated ? 'Based on client-provided information and readable document text; not a legal conclusion. Verify with the client.' : 'The AI brief was unavailable when the request was sent. Review the client’s original concern and any shared document directly.'}</small></div>}
    {clientContext && <p className="request-case-context">{clientContext}</p>}
  </>
}

export function AdvocateDashboard() {
  const { requests, user, isSupabaseConfigured } = useDemo()
  const [profilePublished, setProfilePublished] = useState(false)
  const [profileError, setProfileError] = useState('')
  useEffect(() => {
    let active = true
    fetchOwnAdvocateProfile(user)
      .then((profile) => {
        if (active) setProfilePublished(Boolean(profile))
      })
      .catch((error) => {
        if (active) setProfileError(error.message)
      })
    return () => { active = false }
  }, [user])
  const pending = requests.filter((request) => request.status === 'pending').length
  const active = requests.filter((request) => ['accepted', 'counter_proposed', 'confirmed'].includes(request.status)).length
  return (
    <>
      <PageHeader eyebrow="ADVOCATE WORKSPACE" title={`Welcome, ${user?.name?.split(' ')[0] || 'Advocate'}.`} description="Publish your profile, manage incoming requests, and continue accepted consultations in your private case workspace." />
      <DemoNotice>{isSupabaseConfigured ? 'Profiles and consultation requests are saved in Supabase' : 'Demo mode · Profiles and requests stay in this browser'}</DemoNotice>
      <div className="stat-grid"><Card className="stat-card"><span className="stat-icon stat-icon-navy"><BriefcaseBusiness size={18} /></span><span className="stat-label">Incoming requests</span><strong>{requests.length}</strong><small>Saved to your inbox</small></Card><Card className="stat-card"><span className="stat-icon stat-icon-gold"><Clock3 size={18} /></span><span className="stat-label">Awaiting response</span><strong>{pending}</strong><small>Requests marked pending</small></Card><Card className="stat-card"><span className="stat-icon stat-icon-green"><Check size={18} /></span><span className="stat-label">Active conversations</span><strong>{active}</strong><small>Accepted or awaiting terms</small></Card></div>
      <div className="dashboard-grid advocate-dashboard-grid"><Card className="dashboard-main-card"><div className="card-title-row"><div><span className="eyebrow">YOUR INBOX</span><h2>Recent requests</h2></div><Link className="text-link small-link" to="/advocate/requests">Open inbox <ArrowRight size={14} /></Link></div><RequestPreview requests={requests.slice(0, 3)} /></Card><Card className="profile-completion-card"><span className="eyebrow">YOUR PUBLIC PROFILE</span><span className="profile-progress-icon"><FileText size={20} /></span><h2>{profilePublished ? 'Your profile is published' : 'Publish your advocate profile'}</h2><p>Clients can find published profiles by case area and location, and see your experience and indicative consultation range.</p>{profileError && <p className="field-error" role="alert">Could not load profile status: {profileError}</p>}<div className="completion-meter"><span style={{ width: profilePublished ? '100%' : '12%' }} /></div><div className="completion-caption"><span>Directory visibility</span><strong>{profilePublished ? 'Published' : 'Not published'}</strong></div><Link className="button button-outline button-block" to="/advocate/profile">{profilePublished ? 'Edit profile' : 'Create profile'} <ArrowRight size={15} /></Link></Card></div>
      <div className="footer-note"><ShieldCheck size={16} /><span>Request details shown here are fictional. In a real service, only information explicitly shared by a citizen should be visible.</span></div>
    </>
  )
}

function RequestPreview({ requests }) {
  if (!requests.length) return <EmptyState icon={MessageCircle} title="Your inbox is quiet">New sample requests will appear here.</EmptyState>
  return <div className="activity-list">{requests.map((request) => <Link className="activity-row" to="/advocate/requests" key={request.id}><span className="avatar">{request.citizenName.split(' ').map((part) => part[0]).join('')}</span><span className="activity-info"><strong>{request.citizenName}</strong><small>{request.caseTitle}</small></span><Badge>{request.status.replace('_', ' ')}</Badge><ArrowRight size={15} className="activity-arrow" /></Link>)}</div>
}

function RequestAttachments({ requestId }) {
  const [documents, setDocuments] = useState([])
  const [error, setError] = useState('')
  const [openingId, setOpeningId] = useState('')

  useEffect(() => {
    let active = true
    fetchConsultationDocuments(requestId)
      .then((results) => {
        if (active) setDocuments(results)
      })
      .catch((loadError) => {
        if (active) setError(`Could not load attached documents: ${loadError.message}`)
      })
    return () => { active = false }
  }, [requestId])

  const openDocument = async (document) => {
    setOpeningId(document.id)
    setError('')
    const newWindow = window.open('about:blank', '_blank')
    if (newWindow) newWindow.opener = null
    try {
      const url = await createDocumentDownloadUrl(document.storage_path)
      if (newWindow) newWindow.location = url
      else setError('Your browser blocked the new tab. Allow pop-ups to open this private file.')
    } catch (openError) {
      newWindow?.close()
      setError(`Could not open ${document.file_name}: ${openError.message}`)
    } finally {
      setOpeningId('')
    }
  }

  if (!documents.length && !error) return null
  return (
    <div className="request-attachments">
      {error && <p className="field-error" role="alert">{error}</p>}
      {documents.map((document) => (
        <button
          className="request-attachment-link"
          type="button"
          key={document.id}
          onClick={() => openDocument(document)}
          disabled={openingId === document.id}
        >
          <FileText size={15} />
          <span>{document.file_name}</span>
          <small>{openingId === document.id ? 'Opening…' : 'Open private attachment'}</small>
        </button>
      ))}
    </div>
  )
}

export function AdvocateRequests() {
  const { requests, updateRequest, deleteRequest, requestsLoading, requestError } = useDemo()
  const [dialog, setDialog] = useState(null)
  const [fee, setFee] = useState('')
  const [time, setTime] = useState('')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [actionError, setActionError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const visible = requests.filter((request) => filter === 'all' || request.status === filter)

  const respond = (request, action) => {
    if (action === 'counter') {
      setFee('')
      setTime('')
      setError('')
      setDialog({ request, action })
      return
    }
    setDialog({ request, action })
  }
  const submitResponse = async () => {
    if (!dialog) return
    if (dialog.action === 'counter' && time && new Date(time).getTime() < Date.now()) {
      setError('Choose a future date and time for the proposal.')
      return
    }
    if (dialog.action === 'counter' && fee && (!Number.isInteger(Number(fee)) || Number(fee) < 0)) {
      setError('Enter a non-negative whole-number fee.')
      return
    }
    const updates = dialog.action === 'accept' ? { status: 'accepted' } :
      dialog.action === 'decline' ? { status: 'declined' } :
        { status: 'counter_proposed', proposalBy: 'advocate', proposedFee: fee ? Number(fee) : null, proposedTime: time || null }
    setActionBusy(true)
    setActionError('')
    try {
      await updateRequest(dialog.request.id, updates)
      setDialog(null)
    } catch (saveError) {
      setActionError(`Could not save your response: ${saveError.message}`)
    } finally {
      setActionBusy(false)
    }
  }

  const archive = async (request) => {
    setActionError('')
    try {
      await deleteRequest(request.id)
    } catch (deleteError) {
      setActionError(`Could not remove this request: ${deleteError.message}`)
    }
  }

  return (
    <>
      <PageHeader eyebrow="REQUEST INBOX" title="Consultation requests" description="Review client requests, save your response, and continue accepted consultations in a private workspace." />
      <DemoNotice>Responses are saved to the database · Sample profiles cannot receive requests</DemoNotice>
      {(requestError || actionError) && <p className="form-error" role="alert">{actionError || `Could not load requests: ${requestError}`}</p>}
      <div className="tabs-row" role="tablist" aria-label="Filter inbox">{[['all', 'All requests'], ['pending', 'Pending'], ['accepted', 'Accepted'], ['counter_proposed', 'Counter-proposed']].map(([key, label]) => <button key={key} role="tab" aria-selected={filter === key} className={filter === key ? 'tab-active' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div>
      {requestsLoading ? <p role="status">Loading your inbox…</p> : <div className="request-list advocate-request-list">{visible.map((request) => <Card className="request-card advocate-request-card" key={request.id}><div className="request-card-header"><div className="request-person"><span className="avatar avatar-sand">{request.citizenName.split(' ').map((part) => part[0]).join('')}</span><div><h3>{request.citizenName}</h3><span>Received {formatDate(request.createdAt)}</span></div></div><Badge>{request.status.replace('_', ' ')}</Badge></div><div className="citizen-summary"><span className="eyebrow">ISSUE SUMMARY SHARED FOR THIS REQUEST</span><h4>{request.caseTitle}</h4><RequestCaseSummary summary={request.caseSummary} /><div className="summary-meta"><span><ShieldCheck size={14} /> Documents attached to this request are shared with you</span><span>Reference {request.id}</span></div></div>
        <RequestAttachments requestId={request.id} />
        {request.status === 'pending' ? <div className="advocate-response-actions"><Button onClick={() => respond(request, 'accept')}><Check size={15} /> Accept</Button><Button variant="outline" onClick={() => respond(request, 'counter')}><Clock3 size={15} /> Counter-propose</Button><Button variant="danger" onClick={() => respond(request, 'decline')}><X size={15} /> Decline</Button></div> : <div className={`request-status-note ${request.status === 'declined' ? 'status-declined' : ''}`}><Check size={15} /><span>{request.status === 'accepted' ? 'You accepted this request.' : request.status === 'counter_proposed' ? 'Your counter-proposal is awaiting the client’s response.' : request.status === 'confirmed' ? 'The client confirmed your proposal.' : request.status === 'cancelled' ? 'The client cancelled this request.' : 'This request was declined.'}</span></div>}
        {['accepted', 'confirmed'].includes(request.status) && <div className="request-row-actions"><Link className="button button-outline button-compact" to={`/advocate/requests/${request.id}`}><MessageCircle size={14} /> Open chat and files</Link></div>}
        <div className="request-row-actions"><Button type="button" variant="outline" className="button-compact" onClick={() => archive(request)}><Trash2 size={14} /> Remove from my inbox</Button></div>
      </Card>)}{!visible.length && <Card><EmptyState icon={BriefcaseBusiness} title="No requests in this view">Accepted client requests will appear here.</EmptyState></Card>}</div>}
      {dialog && <Modal title={dialog.action === 'accept' ? 'Accept this request?' : dialog.action === 'decline' ? 'Decline this request?' : 'Propose a different arrangement'} onClose={() => setDialog(null)}>
        {dialog.action === 'counter' ? <><p className="modal-intro">The client will see this proposal and can confirm or cancel it.</p><div className="modal-form"><Field label="Alternative consultation time (optional)" id="counter-time"><input id="counter-time" type="datetime-local" value={time} onChange={(event) => setTime(event.target.value)} /></Field><Field label="Indicative consultation fee in INR (optional)" id="counter-fee"><input id="counter-fee" type="number" min="0" placeholder="e.g. 1500" value={fee} onChange={(event) => setFee(event.target.value)} /></Field>{error && <p className="field-error" role="alert">{error}</p>}</div></> : <p className="modal-intro">{dialog.action === 'accept' ? 'The client will be able to message you and share files after acceptance.' : 'The client will see that this request was declined.'}</p>}
        {actionError && <p className="field-error" role="alert">{actionError}</p>}
        <div className="modal-actions"><Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button variant={dialog.action === 'decline' ? 'danger' : 'primary'} onClick={submitResponse} disabled={actionBusy}>{actionBusy ? 'Saving…' : dialog.action === 'accept' ? 'Accept request' : dialog.action === 'decline' ? 'Decline request' : 'Send proposal'} <ArrowRight size={15} /></Button></div>
      </Modal>}
    </>
  )
}

export function AdvocateProfileEditor() {
  const { user, isSupabaseConfigured } = useDemo()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [bioNotes, setBioNotes] = useState('')
  const [bioGenerating, setBioGenerating] = useState(false)
  const [bioError, setBioError] = useState('')
  const [customPracticeArea, setCustomPracticeArea] = useState('')
  const [profile, setProfile] = useState({
    name: user?.name || '',
    bio: '',
    practice: '',
    jurisdiction: '',
    city: '',
    languages: '',
    yearsExperience: '',
    remote: true,
    feeMin: '',
    feeMax: '',
  })

  useEffect(() => {
    let active = true
    fetchOwnAdvocateProfile(user)
      .then((existing) => {
        if (!active || !existing) return
        setProfile({
          name: existing.name,
          bio: existing.bio,
          practice: existing.practiceAreas.join(', '),
          jurisdiction: existing.jurisdictions.join(', '),
          city: existing.city,
          languages: existing.languages.join(', '),
          yearsExperience: String(existing.yearsExperience),
          remote: existing.remote,
          feeMin: String(existing.feeMin),
          feeMax: String(existing.feeMax),
        })
      })
      .catch((loadError) => {
        if (active) setError(`Could not load your profile: ${loadError.message}`)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [user])

  const update = (key, value) => { setProfile((current) => ({ ...current, [key]: value })); setSaved(false) }
  const practiceAreas = [...new Set(profile.practice.split(',').map((item) => item.trim()).filter(Boolean))]
  const availablePracticeAreas = [...new Set([...PRACTICE_AREA_OPTIONS, ...practiceAreas])]
  const togglePracticeArea = (area) => {
    const updatedAreas = practiceAreas.some((item) => item.toLowerCase() === area.toLowerCase())
      ? practiceAreas.filter((item) => item.toLowerCase() !== area.toLowerCase())
      : [...practiceAreas, area]
    update('practice', updatedAreas.join(', '))
  }
  const addCustomPracticeArea = () => {
    const areas = customPracticeArea.split(',').map((item) => item.trim()).filter(Boolean)
    const updatedAreas = [...practiceAreas]
    for (const area of areas) {
      if (!updatedAreas.some((item) => item.toLowerCase() === area.toLowerCase())) updatedAreas.push(area)
    }
    if (updatedAreas.length === practiceAreas.length) return
    update('practice', updatedAreas.join(', '))
    setCustomPracticeArea('')
  }
  const generateBio = async () => {
    setBioError('')
    if (!profile.name.trim() || !practiceAreas.length || !profile.yearsExperience || !Number.isInteger(Number(profile.yearsExperience)) || Number(profile.yearsExperience) < 0 || Number(profile.yearsExperience) > 60) {
      setBioError('Add your display name, at least one practice area, and years of experience before generating a bio.')
      return
    }
    if (profile.bio.trim() && !window.confirm('Replace the current final biography with a new AI draft?')) return
    setBioGenerating(true)
    try {
      const bio = await generateAdvocateBio({
        name: profile.name.trim(),
        practiceAreas,
        yearsExperience: Number(profile.yearsExperience),
        jurisdictions: profile.jurisdiction.split(',').map((item) => item.trim()).filter(Boolean),
        city: profile.city.trim(),
        languages: profile.languages.split(',').map((item) => item.trim()).filter(Boolean),
        remote: profile.remote,
        notes: bioNotes.trim(),
      })
      update('bio', bio)
    } catch (generateError) {
      setBioError(`Could not generate a bio: ${generateError.message}`)
    } finally {
      setBioGenerating(false)
    }
  }
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    const practiceAreas = [...new Set(profile.practice.split(',').map((item) => item.trim()).filter(Boolean))]
    const jurisdictions = [...new Set(profile.jurisdiction.split(',').map((item) => item.trim()).filter(Boolean))]
    const languages = [...new Set(profile.languages.split(',').map((item) => item.trim()).filter(Boolean))]
    const yearsExperience = Number(profile.yearsExperience)
    const feeMin = Number(profile.feeMin)
    const feeMax = Number(profile.feeMax)

    if (!profile.name.trim() || !profile.bio.trim() || !profile.city.trim() || !profile.jurisdiction.trim() || !practiceAreas.length || !languages.length) {
      setError('Complete your name, bio, practice areas, location, and languages before publishing.')
      return
    }
    if (!profile.yearsExperience || !Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 60) {
      setError('Enter your years of experience as a whole number from 0 to 60.')
      return
    }
    if (profile.feeMin === '' || profile.feeMax === '' || !Number.isInteger(feeMin) || !Number.isInteger(feeMax) || feeMin < 0 || feeMax < feeMin) {
      setError('Enter a valid consultation fee range; the maximum must be at least the minimum.')
      return
    }

    setSaving(true)
    try {
      const savedProfile = await saveAdvocateProfile({
        name: profile.name,
        bio: profile.bio,
        practiceAreas,
        jurisdictions,
        city: profile.city,
        state: jurisdictions[0],
        languages,
        yearsExperience,
        remote: profile.remote,
        feeMin,
        feeMax,
      }, user)
      setProfile({
        name: savedProfile.name,
        bio: savedProfile.bio,
        practice: savedProfile.practiceAreas.join(', '),
        jurisdiction: savedProfile.jurisdictions.join(', '),
        city: savedProfile.city,
        languages: savedProfile.languages.join(', '),
        yearsExperience: String(savedProfile.yearsExperience),
        remote: savedProfile.remote,
        feeMin: String(savedProfile.feeMin),
        feeMax: String(savedProfile.feeMax),
      })
      setSaved(true)
    } catch (saveError) {
      const migrationHint = isSupabaseConfigured ? ' If the advocate_profiles table is missing, apply the new advocate directory migration in Supabase.' : ''
      setError(`Could not save your profile: ${saveError.message}${migrationHint}`)
    } finally {
      setSaving(false)
    }
  }
  return (
    <>
      <PageHeader eyebrow="PROFILE SETTINGS" title="Your advocate profile" description="Add your experience, practice areas, location, and indicative consultation fees. Saving publishes this profile in the client advocate directory." />
      <DemoNotice>{isSupabaseConfigured ? 'Published profiles are visible to signed-in clients' : 'Demo profile saved in this browser'}</DemoNotice>
      <div className="profile-editor-layout"><Card className="profile-editor-card"><form onSubmit={submit}>
        <div className="editor-section-head"><span className="eyebrow">PUBLIC PROFILE</span><h2>Professional information</h2><p>Use accurate details. Published profiles are advocate-submitted and are not independently verified.</p></div>
        <Field label="Display name" id="profile-name"><input id="profile-name" value={profile.name} onChange={(event) => update('name', event.target.value)} required maxLength={120} /></Field>
        <Field label="Your bio notes for AI (optional)" id="profile-bio-notes" hint="Add details about your approach, work, or background that you want included. The AI uses only what you enter here and in your profile."><textarea id="profile-bio-notes" rows="3" maxLength="1200" value={bioNotes} onChange={(event) => setBioNotes(event.target.value)} placeholder="For example: the kinds of matters you handle and how you work with clients…" /></Field>
        <div className="bio-generate-row"><Button type="button" variant="outline" onClick={generateBio} disabled={bioGenerating || loading}><Sparkles size={15} /> {bioGenerating ? 'Writing draft…' : 'Draft bio with AI'}</Button><span>Profile details and notes are sent to the configured AI provider only when you choose this option. Review and edit the draft before publishing.</span></div>
        {bioError && <p className="form-error" role="alert">{bioError}</p>}
        <Field label="Final biography" id="profile-bio" hint="This editable text is published on your profile. Review it carefully; avoid unverifiable claims or guarantees."><textarea id="profile-bio" rows="4" value={profile.bio} onChange={(event) => update('bio', event.target.value)} required maxLength={2000} /></Field>
        <div className="form-two-col"><div className="field">
          <span className="practice-area-label" id="profile-practice-label">Practice areas</span>
          <span className="field-hint">Select as many areas as apply. Existing custom areas are preserved.</span>
          <details className="practice-area-dropdown" aria-labelledby="profile-practice-label">
            <summary>{practiceAreas.length ? `${practiceAreas.length} selected` : 'Choose practice areas'}</summary>
            <div className="practice-area-options" role="group" aria-label="Practice areas">
              {availablePracticeAreas.map((area) => <label key={area}><input type="checkbox" checked={practiceAreas.some((item) => item.toLowerCase() === area.toLowerCase())} onChange={() => togglePracticeArea(area)} /><span>{area}</span></label>)}
            </div>
          </details>
          {practiceAreas.length > 0 && <div className="practice-area-selected">{practiceAreas.map((area) => <span key={area}>{area}</span>)}</div>}
          <div className="practice-area-custom"><input aria-label="Add a custom practice area" value={customPracticeArea} onChange={(event) => setCustomPracticeArea(event.target.value)} maxLength={160} placeholder="Add custom area(s), comma-separated" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomPracticeArea() } }} /><Button type="button" variant="outline" className="button-compact" onClick={addCustomPracticeArea} disabled={!customPracticeArea.trim()}>Add</Button></div>
        </div><Field label="Years of experience" id="profile-experience"><input id="profile-experience" type="number" min="0" max="60" step="1" value={profile.yearsExperience} onChange={(event) => update('yearsExperience', event.target.value)} required /></Field></div>
        <div className="form-two-col"><Field label="Jurisdiction / state" id="profile-jurisdiction" hint="Separate multiple jurisdictions with commas."><input id="profile-jurisdiction" value={profile.jurisdiction} onChange={(event) => update('jurisdiction', event.target.value)} required maxLength={300} /></Field><Field label="City" id="profile-city"><input id="profile-city" value={profile.city} onChange={(event) => update('city', event.target.value)} required maxLength={120} /></Field></div>
        <Field label="Languages" id="profile-languages" hint="Separate multiple languages with commas."><input id="profile-languages" value={profile.languages} onChange={(event) => update('languages', event.target.value)} required maxLength={300} /></Field>
        <label className="checkbox-field profile-remote-field"><input type="checkbox" checked={profile.remote} onChange={(event) => update('remote', event.target.checked)} /><span>Available for remote consultations</span><Video size={15} /></label>
        <div className="editor-section-head editor-section-divider"><span className="eyebrow">INDICATIVE INFORMATION</span><h2>Consultation fee range</h2><p>Clients with a matching case area will see this advocate-provided estimate. Final terms are agreed directly.</p></div>
        <div className="form-two-col"><Field label="Minimum (INR)" id="fee-min"><input id="fee-min" type="number" min="0" step="1" value={profile.feeMin} onChange={(event) => update('feeMin', event.target.value)} required /></Field><Field label="Maximum (INR)" id="fee-max"><input id="fee-max" type="number" min="0" step="1" value={profile.feeMax} onChange={(event) => update('feeMax', event.target.value)} required /></Field></div>
        {loading && <p role="status">Loading your saved profile…</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {saved && <p className="save-success" role="status">Profile saved and published. It will now appear in the client advocate directory.</p>}
        <div className="editor-actions"><Button type="submit" disabled={saving || loading}>{saving ? 'Publishing…' : 'Save and publish profile'} <Check size={15} /></Button></div>
      </form></Card><aside className="profile-preview"><Card className="profile-preview-card"><span className="eyebrow">CLIENT PREVIEW</span><div className="preview-person"><span className="avatar avatar-large">{profile.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><div><h3>{profile.name || 'Your name'}</h3><span><MapPin size={13} /> {profile.city || 'City'}, {profile.jurisdiction || 'State'}</span></div></div><p>{profile.bio || 'Your profile biography will appear here.'}</p><div className="practice-tags">{practiceAreas.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="preview-facts"><span>{profile.yearsExperience || '—'} years’ experience</span><span>{profile.languages || 'Languages not added'}</span><span>{formatFee(Number(profile.feeMin), Number(profile.feeMax))} indicative consultation</span></div><div className="preview-demo-label"><ShieldCheck size={14} /> Advocate-submitted · Not independently verified</div></Card><p className="profile-preview-note">Clients see your submitted practice areas, experience, location, and consultation range. Do not include private client information.</p></aside></div>
    </>
  )
}
