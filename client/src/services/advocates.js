import { isSupabaseConfigured, supabase } from './supabase'
import { advocates } from '../data/mockData'

const directoryStorageKey = 'nyayaconnect-advocate-directory'
const publicFields = 'advocate_id, display_name, bio, practice_areas, jurisdictions, city, state, years_experience, languages, remote_available, consultation_fee_min, consultation_fee_max'
const sampleFields = 'id, email, display_name, bio, practice_areas, jurisdictions, city, state, years_experience, languages, remote_available, consultation_fee_min, consultation_fee_max'

const initialsFor = (name = '') => name
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => part[0])
  .join('')
  .slice(0, 2)
  .toUpperCase()

export function toAdvocateProfile(row) {
  return {
    id: row.advocate_id,
    name: row.display_name,
    initials: initialsFor(row.display_name),
    bio: row.bio,
    practiceAreas: row.practice_areas || [],
    jurisdictions: row.jurisdictions || [row.state],
    city: row.city,
    state: row.state,
    yearsExperience: row.years_experience,
    languages: row.languages || [],
    remote: row.remote_available,
    feeMin: Number(row.consultation_fee_min),
    feeMax: Number(row.consultation_fee_max),
    verificationStatus: 'Advocate-submitted',
    isSample: false,
  }
}

function toSampleAdvocateProfile(row) {
  const profile = toAdvocateProfile({
    ...row,
    advocate_id: row.id,
  })
  return {
    ...profile,
    email: row.email,
    verificationStatus: 'Sample profile',
    isSample: true,
  }
}

function getLocalSampleAdvocates() {
  return advocates.map((advocate) => ({
    ...advocate,
    email: `${advocate.id.replaceAll('-', '.')}@example.com`,
    isSample: true,
  }))
}

function readLocalProfiles() {
  const stored = window.localStorage.getItem(directoryStorageKey)
  if (!stored) return []
  const profiles = JSON.parse(stored)
  if (!Array.isArray(profiles)) throw new Error('The saved advocate directory has an invalid format.')
  return profiles
}

function toDatabaseRecord(profile, advocateId) {
  return {
    advocate_id: advocateId,
    display_name: profile.name.trim(),
    bio: profile.bio.trim(),
    practice_areas: profile.practiceAreas,
    jurisdictions: profile.jurisdictions,
    city: profile.city.trim(),
    state: profile.state.trim(),
    years_experience: Number(profile.yearsExperience),
    languages: profile.languages,
    remote_available: profile.remote,
    consultation_fee_min: Number(profile.feeMin),
    consultation_fee_max: Number(profile.feeMax),
    is_published: true,
  }
}

export async function fetchPublicAdvocates() {
  if (!isSupabaseConfigured) return [...readLocalProfiles(), ...getLocalSampleAdvocates()]

  const [publishedResult, samplesResult] = await Promise.all([
    supabase
      .from('advocate_profiles')
      .select(publicFields)
      .eq('is_published', true)
      .order('updated_at', { ascending: false }),
    supabase
      .from('sample_advocate_profiles')
      .select(sampleFields)
      .order('display_name'),
  ])
  if (publishedResult.error) throw new Error(publishedResult.error.message)
  if (samplesResult.error) throw new Error(samplesResult.error.message)
  return [
    ...publishedResult.data.map(toAdvocateProfile),
    ...samplesResult.data.map(toSampleAdvocateProfile),
  ]
}

export async function fetchOwnAdvocateProfile(user) {
  if (!isSupabaseConfigured) {
    const profileId = user?.id || `demo-${user?.email || 'advocate'}`
    return readLocalProfiles().find((profile) => profile.id === profileId) || null
  }
  if (!user?.id) throw new Error('Please sign in again before editing your advocate profile.')

  const { data, error } = await supabase
    .from('advocate_profiles')
    .select(publicFields)
    .eq('advocate_id', user.id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toAdvocateProfile(data) : null
}

export async function saveAdvocateProfile(profile, user) {
  if (!isSupabaseConfigured) {
    const profileId = user?.id || `demo-${user?.email || 'advocate'}`
    const localProfile = { ...profile, id: profileId, initials: initialsFor(profile.name), verificationStatus: 'Demo profile', isSample: false }
    const profiles = readLocalProfiles().filter((item) => item.id !== profileId)
    window.localStorage.setItem(directoryStorageKey, JSON.stringify([localProfile, ...profiles]))
    return localProfile
  }
  if (!user?.id) throw new Error('Please sign in again before publishing your advocate profile.')

  const { data, error } = await supabase
    .from('advocate_profiles')
    .upsert(toDatabaseRecord(profile, user.id), { onConflict: 'advocate_id' })
    .select(publicFields)
    .single()
  if (error) throw new Error(error.message)
  return toAdvocateProfile(data)
}
