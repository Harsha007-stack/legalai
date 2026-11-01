import { useEffect, useState } from 'react'
import { fetchPublicAdvocates } from '../services/advocates'

export function useAdvocateDirectory() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetchPublicAdvocates()
      .then((results) => {
        if (active) setProfiles(results)
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Could not load advocate profiles.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  return { profiles, loading, error }
}
