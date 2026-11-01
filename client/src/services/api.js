import { supabase } from './supabase'

const apiBaseUrl = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export async function apiRequest(path, options = {}) {
  if (!supabase) throw new Error('Supabase authentication is not configured.')

  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw new Error('Could not read the current sign-in session.')
  if (!session?.access_token) throw new Error('Please sign in again to continue.')

  const {
    timeoutMs = 60_000,
    retries = 0,
    retryDelayMs = 700,
    retryErrorCodes = [],
    ...fetchOptions
  } = options
  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData

  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
          Authorization: `Bearer ${session.access_token}`,
          ...fetchOptions.headers,
        },
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        const message = body?.error?.message
          || (response.status >= 500
            ? 'The server had a temporary problem processing this request.'
            : 'The server could not complete that request.')
        const error = new Error(message)
        error.status = response.status
        error.code = body?.error?.code
        error.data = body
        throw error
      }
      return body
    } catch (error) {
      const networkError = error instanceof TypeError
      const transient = networkError
        || (Number.isInteger(error.status) && error.status >= 500)
        || retryErrorCodes.includes(error.code)
      if (attempt < retries && transient) {
        window.clearTimeout(timeout)
        await wait(retryDelayMs * (attempt + 1))
        continue
      }
      if (error.name === 'AbortError') throw new Error('The server took too long to respond. Your message may be saved; retry safely.')
      if (networkError) throw new Error('Could not connect to the server. Please try again.')
      throw error
    } finally {
      window.clearTimeout(timeout)
    }
  }
}
