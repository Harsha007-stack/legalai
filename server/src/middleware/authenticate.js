import { createUserScopedSupabase, supabaseAuth } from '../config/supabase.js'

export async function authenticate(req, res, next) {
  const authorization = req.get('authorization') || ''
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } })
  }

  try {
    const { data, error } = await supabaseAuth.auth.getUser(match[1])
    if (error || !data.user) {
      return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Your session is invalid or has expired. Sign in again.' } })
    }

    req.user = data.user
    req.supabase = createUserScopedSupabase(match[1])
    return next()
  } catch {
    return res.status(503).json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Could not verify your session right now.' } })
  }
}
