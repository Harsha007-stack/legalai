import test from 'node:test'
import assert from 'node:assert/strict'
import { recommendAdvocates } from './advocateRecommendations.js'

test('ranks the employment profile first and returns four choices', () => {
  const matches = recommendAdvocates('Employment', 'My salary has been delayed')
  assert.equal(matches.length, 4)
  assert.equal(matches[0].id, 'ananya-rao')
})

test('ranks the consumer profile first for refund concerns', () => {
  const matches = recommendAdvocates('Consumer', 'I need a refund')
  assert.equal(matches.length, 4)
  assert.equal(matches[0].id, 'meera-iyer')
})

test('fills the remaining choices with other sample profiles', () => {
  const matches = recommendAdvocates('Family', 'I need help with a divorce')
  assert.equal(matches.length, 4)
  assert.equal(matches[0].id, 'kabir-mehta')
})

test('returns no profiles when no supported practice area matches and no category is known', () => {
  assert.deepEqual(recommendAdvocates('', 'I need a visa'), [])
})

test('only recommends advocates in the detected state and prefers the detected city', () => {
  const matches = recommendAdvocates('Civil', 'property registration', { state: 'Maharashtra', city: 'Mumbai' })
  assert.equal(matches.length, 4)
  assert.ok(matches.every((advocate) => advocate.state === 'Maharashtra'))
  assert.equal(matches[0].id, 'kabir-mehta')
})

test('does not fall back to other states when the detected state has no profiles', () => {
  assert.deepEqual(recommendAdvocates('Civil', 'property', { state: 'Sikkim', city: 'Gangtok' }), [])
})

test('uses the supplied published directory when recommending advocates', () => {
  const dora = {
    id: 'dora-profile',
    name: 'Dora Advocate',
    practiceAreas: ['Employment'],
    state: 'Karnataka',
    city: 'Bengaluru',
  }
  const matches = recommendAdvocates('Employment', 'unpaid salary', null, [dora])
  assert.deepEqual(matches, [dora])
})

test('matches custom practice-area labels case-insensitively', () => {
  const dora = {
    id: 'dora-profile',
    name: 'Dora Advocate',
    practiceAreas: ['employment law'],
    state: 'Karnataka',
    city: 'Bengaluru',
  }
  assert.equal(recommendAdvocates('Employment', 'unpaid salary', null, [dora])[0], dora)
})

test('handles null category and query from assistant responses', () => {
  assert.doesNotThrow(() => recommendAdvocates(null, null))
  assert.deepEqual(recommendAdvocates(null, null), [])
})

test('handles null location fields when matching advocates', () => {
  const dora = {
    id: 'dora-profile',
    name: 'Dora Advocate',
    practiceAreas: ['Employment'],
    state: null,
    city: null,
  }
  assert.deepEqual(
    recommendAdvocates(null, null, { state: null, city: null }, [dora]),
    [],
  )
})
