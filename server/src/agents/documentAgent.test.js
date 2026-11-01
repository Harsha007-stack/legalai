import test from 'node:test'
import assert from 'node:assert/strict'
import { providerChain } from './documentAgent.js'

const providerSettings = {
  DOCUMENT_AI_PROVIDER: 'groq',
  GROQ_API_KEY: 'groq-key',
  GROQ_BASE_URL: 'https://groq.example/v1',
  GROQ_DOCUMENT_MODEL: 'groq-model',
  GEMINI_API_KEY: 'gemini-key',
  GEMINI_OPENAI_BASE_URL: 'https://gemini.example/v1',
  GEMINI_MODEL: 'gemini-model',
  KIMI_API_KEY: 'kimi-key',
  KIMI_BASE_URL: 'https://kimi.example/v1',
  KIMI_DOCUMENT_MODEL: 'kimi-model',
  OPENCODE_API_KEY: 'opencode-key',
  OPENCODE_BASE_URL: 'https://opencode.example/v1',
  OPENCODE_DOCUMENT_MODEL: 'opencode-model',
}

test('uses Groq, Gemini, then Kimi for document AI fallback', () => {
  assert.deepEqual(providerChain(providerSettings).map(({ name }) => name), ['groq', 'gemini', 'kimi'])
})

test('skips document AI providers without configured keys', () => {
  const settings = { ...providerSettings, GROQ_API_KEY: '', KIMI_API_KEY: '' }
  assert.deepEqual(providerChain(settings).map(({ name }) => name), ['gemini'])
})

test('keeps explicitly selected OpenCode ahead of the Groq, Gemini, and Kimi fallbacks', () => {
  const settings = { ...providerSettings, DOCUMENT_AI_PROVIDER: 'opencode' }
  assert.deepEqual(providerChain(settings).map(({ name }) => name), ['opencode', 'groq', 'gemini', 'kimi'])
})
