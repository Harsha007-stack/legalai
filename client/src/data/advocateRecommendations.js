import { advocates } from './mockData.js'

const practiceMatches = [
  { area: 'Employment', terms: ['employment', 'labour', 'labor', 'salary', 'wage', 'workplace', 'pay', 'employer'] },
  { area: 'Labour', terms: ['employment', 'labour', 'labor', 'salary', 'wage', 'workplace', 'pay', 'employer'] },
  { area: 'Family', terms: ['family', 'divorce', 'custody', 'marriage', 'maintenance'] },
  { area: 'Civil', terms: ['civil', 'rental', 'rent', 'deposit', 'tenant', 'landlord', 'property', 'noise', 'neighbour', 'neighbor', 'builder', 'registration', 'flat'] },
  { area: 'Property', terms: ['property', 'rental', 'rent', 'deposit', 'tenant', 'landlord', 'builder', 'registration', 'flat'] },
  { area: 'Consumer', terms: ['consumer', 'refund', 'defect', 'product', 'service', 'builder'] },
]

const MAX_RECOMMENDATIONS = 4

const normalizeText = (value) => String(value ?? '').toLowerCase()
const normalizePlace = (value) => normalizeText(value).replace(/[^a-z]/g, '')
const samePlace = (left, right) => {
  const a = normalizePlace(left)
  const b = normalizePlace(right)
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)))
}

export function recommendAdvocates(category = '', query = '', location = null, candidates = advocates) {
  const categoryText = normalizeText(category)
  const queryText = normalizeText(query)
  const wantedState = location?.state || ''
  const wantedCity = location?.city || ''

  let pool = candidates
  if (wantedState) {
    const local = candidates.filter((advocate) => samePlace(advocate.state, wantedState))
    if (!local.length) return []
    pool = local
  }

  const ranked = pool
    .map((advocate) => {
      const listedAreas = advocate.practiceAreas.map((area) => area.toLowerCase())
      const practiceScore = practiceMatches.reduce((total, match) => {
        if (!listedAreas.some((area) => area.includes(match.area.toLowerCase()) || match.area.toLowerCase().includes(area))) return total
        const categoryMatch = match.terms.some((term) => categoryText.includes(term))
        const queryMatches = match.terms.filter((term) => queryText.includes(term)).length
        return total + (categoryMatch ? 5 : 0) + queryMatches
      }, 0)
      const cityBonus = wantedCity && samePlace(advocate.city, wantedCity) ? 3 : 0
      return { advocate, score: practiceScore + cityBonus }
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ advocate }) => advocate)

  if (!ranked.length && !categoryText && !wantedState) return []

  const selected = [...ranked]
  for (const advocate of pool) {
    if (selected.length >= MAX_RECOMMENDATIONS) break
    if (!selected.some((item) => item.id === advocate.id)) selected.push(advocate)
  }
  return selected.slice(0, MAX_RECOMMENDATIONS)
}
