import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DemoContext } from './DemoContext'
import { initialRequests } from '../data/mockData'
import { archiveConsultationRequest, createConsultationRequest, fetchConsultationRequests, respondToConsultationRequest } from '../services/consultations'
import { isSupabaseConfigured, supabase } from '../services/supabase'

export function DemoProvider({ children }) {
  const [user, setUser] = useState(null)
  const [requests, setRequests] = useState(isSupabaseConfigured ? [] : initialRequests)
  const [demoRequests, setDemoRequests] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [authError, setAuthError] = useState('')
  const userRef = useRef(null)

  useEffect(() => {
    userRef.current = user
  }, [user])

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null)
      setRequests([])
      setDemoRequests([])
      setRequestsLoading(false)
      setRequestError('')
      return null
    }
    setRequestsLoading(true)
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', authUser.id)
      .maybeSingle()
    if (error || !profile) {
      setAuthError('Your account profile is not ready. Apply the Supabase SQL setup, then sign in again.')
      setUser(null)
      setRequests([])
      setDemoRequests([])
      setRequestsLoading(false)
      return null
    }
    setAuthError('')
    const nextUser = { id: authUser.id, name: profile.full_name, email: authUser.email, role: profile.role }
    setUser(nextUser)
    setDemoRequests([])
    return nextUser
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined

    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setAuthError('Could not restore your sign-in session. Please sign in again.')
      return loadProfile(data?.session?.user || null)
    }).catch(() => {
      if (active) setAuthError('Could not restore your sign-in session. Please sign in again.')
    }).finally(() => {
      if (active) setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') return
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setRequests([])
        setDemoRequests([])
        setRequestsLoading(false)
        setRequestError('')
        setAuthLoading(false)
        return
      }
      if (event !== 'SIGNED_IN' && event !== 'USER_UPDATED') return
      if (session?.user?.id && session.user.id === userRef.current?.id) return
      setAuthLoading(true)
      window.setTimeout(() => {
        if (active) {
          loadProfile(session?.user || null)
            .catch(() => setAuthError('Could not load your account profile. Please sign in again.'))
            .finally(() => setAuthLoading(false))
        }
      }, 0)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const refreshRequests = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return
    setRequestError('')
    try {
      const savedRequests = await fetchConsultationRequests(user)
      setRequests(savedRequests)
    } catch (error) {
      setRequestError(error.message)
      throw error
    } finally {
      setRequestsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    if (!user?.id) return undefined

    let active = true
    fetchConsultationRequests(user)
      .then((savedRequests) => {
        if (active) {
          setRequests(savedRequests)
          setRequestError('')
        }
      })
      .catch((error) => {
        if (active) setRequestError(error.message || 'Could not load consultation requests.')
      })
      .finally(() => {
        if (active) setRequestsLoading(false)
      })

    const filterColumn = user.role === 'advocate' ? 'advocate_id' : 'citizen_id'
    const channel = supabase
      .channel(`consultation-requests-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'consultation_requests',
        filter: `${filterColumn}=eq.${user.id}`,
      }, () => {
        if (active) refreshRequests().catch(() => {})
      })
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [user, refreshRequests])

  const signIn = useCallback((nextUser) => {
    const safeUser = { name: nextUser.name, email: nextUser.email, role: nextUser.role }
    setUser(safeUser)
    setDemoRequests([])
  }, [])
  const authenticate = useCallback(async ({ email, password }) => {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    const profile = await loadProfile(data.user)
    if (!profile) {
      await supabase.auth.signOut()
      throw new Error('Your profile could not be loaded. Please contact the project administrator.')
    }
    return profile
  }, [loadProfile])
  const register = useCallback(async ({ name, email, password, role }) => {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, role } },
    })
    if (error) throw new Error(error.message)
    if (!data.session) return { needsEmailConfirmation: true }
    const profile = await loadProfile(data.user)
    if (!profile) throw new Error('The account was created, but its profile is not ready. Apply the SQL setup and sign in again.')
    return { profile }
  }, [loadProfile])
  const signOut = useCallback(async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut()
      if (error) throw new Error(error.message)
    }
    setUser(null)
    setRequests([])
    setDemoRequests([])
    setRequestsLoading(false)
    setRequestError('')
  }, [])
  const createRequest = useCallback(async (request) => {
    if (isSupabaseConfigured) {
      const created = await createConsultationRequest(request, user)
      setRequests((current) => [created, ...current.filter((item) => item.id !== created.id)])
      return created
    }
    const nextRequest = {
      ...request,
      id: `REQ-${Math.floor(2000 + Math.random() * 7000)}`,
      citizenName: user?.name || 'You',
      createdAt: new Date().toISOString(),
      status: 'pending',
      proposalBy: 'citizen',
    }
    setRequests((current) => [nextRequest, ...current])
    return nextRequest
  }, [user])
  const createDemoRequest = useCallback((request) => {
    const nextRequest = {
      ...request,
      id: `DEMO-${crypto.randomUUID()}`,
      citizenId: user?.id,
      citizenName: user?.name || 'You',
      createdAt: new Date().toISOString(),
      status: 'demo_only',
      isDemo: true,
    }
    const nextDemoRequests = [nextRequest, ...demoRequests]
    setDemoRequests(nextDemoRequests)
    return nextRequest
  }, [demoRequests, user])
  const updateRequest = useCallback(async (id, updates) => {
    if (demoRequests.some((request) => request.id === id)) {
      throw new Error('Sample requests are simulations only and cannot be accepted, confirmed, or messaged.')
    }
    if (isSupabaseConfigured) {
      const request = requests.find((item) => item.id === id)
      if (!request) throw new Error('Consultation request is no longer available.')
      const action = updates.status === 'accepted' ? 'accept'
        : updates.status === 'declined' ? 'decline'
          : updates.status === 'counter_proposed' ? 'counter_propose'
            : updates.status === 'confirmed' ? 'confirm'
              : updates.status === 'cancelled' ? 'cancel'
                : null
      if (!action) throw new Error('Unsupported request update.')
      const savedRequest = await respondToConsultationRequest(id, action, updates)
      const mergedRequest = { ...request, ...savedRequest }
      setRequests((current) => current.map((item) => item.id === id ? mergedRequest : item))
      return mergedRequest
    }
    setRequests((current) => current.map((request) => request.id === id ? { ...request, ...updates } : request))
    return true
  }, [demoRequests, requests])
  const deleteRequest = useCallback(async (id) => {
    const demoRequest = demoRequests.find((request) => request.id === id)
    if (demoRequest) {
      const nextDemoRequests = demoRequests.filter((request) => request.id !== id)
      setDemoRequests(nextDemoRequests)
      return
    }
    if (isSupabaseConfigured) {
      await archiveConsultationRequest(id, user?.role)
    }
    setRequests((current) => current.filter((request) => request.id !== id))
  }, [demoRequests, user])

  const visibleRequests = useMemo(() => [
    ...requests,
    ...(user?.role === 'citizen' ? demoRequests : []),
  ], [requests, demoRequests, user?.role])

  const value = useMemo(() => ({ user, signIn, authenticate, register, signOut, requests: visibleRequests, requestsLoading, requestError, refreshRequests, createRequest, createDemoRequest, updateRequest, deleteRequest, authLoading, authError, isSupabaseConfigured }), [user, signIn, authenticate, register, signOut, visibleRequests, requestsLoading, requestError, refreshRequests, createRequest, createDemoRequest, updateRequest, deleteRequest, authLoading, authError])
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}
