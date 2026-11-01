import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { env } from './config/env.js'
import { authenticate } from './middleware/authenticate.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { assistantRoutes } from './routes/assistantRoutes.js'
import { aiRoutes } from './routes/aiRoutes.js'
import { conversationRoutes } from './routes/conversationRoutes.js'

const app = express()

app.disable('x-powered-by')
app.use((req, res, next) => {
  req.id = randomUUID()
  res.setHeader('X-Request-Id', req.id)
  next()
})
app.use(helmet())
app.use(cors({ origin: env.CLIENT_URL, credentials: false, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }))
app.use(express.json({ limit: '32kb' }))

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'nyayaconnect-api' }))

app.get('/api/me', authenticate, (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email } })
})

app.use('/api/conversations', authenticate, conversationRoutes)
app.use('/api/ai', authenticate, rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many AI requests. Please wait before trying again.' } },
}), aiRoutes)
app.use('/api/assistant', authenticate, rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many assistant requests. Please wait before trying again.' } },
}), assistantRoutes)

const clientDist = resolve(dirname(fileURLToPath(import.meta.url)), '../../client/dist')
if (existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
    res.sendFile(resolve(clientDist, 'index.html'), (error) => {
      if (error) next(error)
    })
  })
}

app.use(notFoundHandler)
app.use(errorHandler)

export default app
