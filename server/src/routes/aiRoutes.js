import { Router } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { generateAdvocateBio, generateConsultationBrief } from '../agents/profileAndConsultationAgent.js'
import { extractDocument, normalizeAttachment } from '../services/documentExtraction.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
})

const bioRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  practiceAreas: z.array(z.string().trim().min(1).max(100)).min(1).max(20),
  yearsExperience: z.number().int().min(0).max(60),
  jurisdictions: z.array(z.string().trim().min(1).max(100)).max(20).default([]),
  city: z.string().trim().max(120).default(''),
  languages: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  remote: z.boolean().default(false),
  notes: z.string().trim().max(1200).default(''),
})

const briefRequestSchema = z.object({
  clientConcern: z.string().trim().min(10).max(6000),
  assistantContext: z.string().max(1500).default(''),
  aiProcessingConsent: z.literal('true'),
})

router.post('/advocate-bio', async (req, res, next) => {
  try {
    const { data: profile, error } = await req.supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single()
    if (error) throw new Error(`Could not verify advocate profile: ${error.message}`)
    if (profile?.role !== 'advocate') {
      return res.status(403).json({ error: { code: 'ADVOCATE_ONLY', message: 'Only advocate accounts can generate a profile biography.' } })
    }

    const parsed = bioRequestSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'INVALID_BIO_REQUEST', message: 'Provide a name, at least one practice area, and valid profile details.' } })
    }
    const bio = await generateAdvocateBio(parsed.data)
    return res.json({ bio })
  } catch (error) {
    return next(error)
  }
})

router.post('/consultation-brief', (req, res, next) => {
  upload.single('attachment')(req, res, async (uploadError) => {
    if (uploadError) {
      const tooLarge = uploadError instanceof multer.MulterError && uploadError.code === 'LIMIT_FILE_SIZE'
      return res.status(tooLarge ? 413 : 400).json({
        error: {
          code: tooLarge ? 'FILE_TOO_LARGE' : 'INVALID_ATTACHMENT',
          message: tooLarge ? 'Documents must be 15 MB or smaller.' : 'The attachment could not be uploaded.',
        },
      })
    }

    try {
      const parsed = briefRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            code: 'INVALID_BRIEF_REQUEST',
            message: 'Confirm AI processing and provide a concern with at least 10 characters.',
          },
        })
      }

      const { data: profile, error: profileError } = await req.supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single()
      if (profileError) throw new Error(`Could not verify client profile: ${profileError.message}`)
      if (profile?.role !== 'citizen') {
        return res.status(403).json({ error: { code: 'CITIZEN_ONLY', message: 'Only client accounts can prepare a consultation brief.' } })
      }

      let document
      let documentAnalyzed = false
      const warnings = []
      if (req.file) {
        const attachment = normalizeAttachment(req.file)
        if (!attachment) {
          return res.status(415).json({ error: { code: 'UNSUPPORTED_ATTACHMENT', message: 'Attach a PDF, PNG, JPG, WEBP, or plain-text document.' } })
        }
        document = { fileName: attachment.originalname, text: '' }
        try {
          const extracted = await extractDocument(attachment)
          document.text = extracted.pages?.map((page) => `[PAGE ${page.page}]\n${page.text}`).join('\n') || ''
          documentAnalyzed = true
        } catch (error) {
          warnings.push('The attachment could not be read for the preliminary brief. It will still be shared with the advocate for review.')
          console.warn(JSON.stringify({
            code: 'CONSULTATION_DOCUMENT_EXTRACTION_FAILED',
            errorCode: error.code || null,
            status: error.status || null,
          }))
        }
      }

      try {
        const brief = await generateConsultationBrief({
          clientConcern: parsed.data.clientConcern,
          assistantContext: parsed.data.assistantContext,
          document,
        })
        return res.json({ brief, aiGenerated: true, documentAnalyzed, warnings })
      } catch (error) {
        warnings.push('An AI brief could not be generated right now. The client’s original concern and any attached document will still be sent.')
        console.warn(JSON.stringify({
          code: 'CONSULTATION_BRIEF_FALLBACK',
          errorCode: error.code || null,
          status: error.status || null,
        }))
        return res.json({
          brief: null,
          aiGenerated: false,
          documentAnalyzed,
          warnings,
        })
      }
    } catch (error) {
      return next(error)
    }
  })
})

export { router as aiRoutes }
