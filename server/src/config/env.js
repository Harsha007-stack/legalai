import dotenv from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') })

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
  GEMINI_OPENAI_BASE_URL: z.string().url().default('https://generativelanguage.googleapis.com/v1beta/openai'),
  GROQ_API_KEY: z.string().optional().default(''),
  GROQ_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  GROQ_DOCUMENT_MODEL: z.string().min(1).default('qwen/qwen3.8-27b'),
  OPENCODE_API_KEY: z.string().optional().default(''),
  OPENCODE_BASE_URL: z.string().url().default('https://opencode.ai/inference/openai/v1'),
  OPENCODE_DOCUMENT_MODEL: z.string().min(1).default('deepseek-v4.1-flash'),
  KIMI_API_KEY: z.string().optional().default(''),
  KIMI_BASE_URL: z.string().url().default('https://api.moonshot.ai/v1'),
  KIMI_DOCUMENT_MODEL: z.string().min(1).default('kimi-k3.1-pro'),
  DOCUMENT_AI_PROVIDER: z.enum(['groq', 'opencode', 'gemini']).default('groq'),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')
  throw new Error(`Invalid server environment configuration: ${missing}`)
}

export const env = parsed.data
