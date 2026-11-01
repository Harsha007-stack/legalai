export const AI_CASE_BRIEF_MARKER = 'AI-GENERATED PRELIMINARY CASE SUMMARY (review; not a legal conclusion):'
export const FALLBACK_CASE_NOTE_MARKER = 'PRELIMINARY INTAKE NOTE (AI brief unavailable; not a legal conclusion):'

export function formatConsultationCaseSummary(clientConcern, assistantContext, brief, {
  aiGenerated = true,
  documentName = '',
  documentAnalyzed = false,
  warnings = [],
} = {}) {
  const sections = [
    `Client concern:\n${clientConcern.trim()}`,
    assistantContext?.trim() ? `Details from the assistant conversation:\n${assistantContext.trim()}` : '',
  ]
  if (!aiGenerated || !brief) {
    const note = [
      'The original concern is included above. No AI-generated case conclusions are available; the advocate should review the concern and confirm details directly with the client.',
      documentName ? `Attached document for advocate review: ${documentName}${documentAnalyzed ? ' (text extraction completed; not independently verified).' : ' (not analyzed; not independently verified).'}` : '',
      ...warnings,
    ].filter(Boolean)
    sections.push(`${FALLBACK_CASE_NOTE_MARKER}\n${note.join('\n\n')}`)
    return sections.filter(Boolean).join('\n\n').slice(0, 12_000)
  }

  const briefLines = [
    `Issue reported: ${brief.issue_title}`,
    brief.preliminary_summary,
    brief.client_goal ? `Client's stated goal: ${brief.client_goal}` : '',
    brief.key_facts.length ? `Facts reported by the client:\n${brief.key_facts.map((fact) => `- ${fact}`).join('\n')}` : '',
    brief.document_points.length ? `Observations from the attached document (not verified):\n${brief.document_points.map((point) => `- ${point}`).join('\n')}` : '',
    brief.questions_to_confirm.length ? `Questions to confirm:\n${brief.questions_to_confirm.map((question) => `- ${question}`).join('\n')}` : '',
    documentName && !documentAnalyzed ? `Attached document for advocate review: ${documentName} (text extraction failed; not analyzed or independently verified).` : '',
    ...warnings,
  ].filter(Boolean)
  sections.push(`${AI_CASE_BRIEF_MARKER}\n${briefLines.join('\n\n')}`)
  return sections.filter(Boolean).join('\n\n').slice(0, 12_000)
}

export function splitConsultationCaseSummary(caseSummary = '') {
  const marker = caseSummary.includes(AI_CASE_BRIEF_MARKER)
    ? AI_CASE_BRIEF_MARKER
    : caseSummary.includes(FALLBACK_CASE_NOTE_MARKER) ? FALLBACK_CASE_NOTE_MARKER : ''
  if (!marker) return { clientContext: caseSummary, aiBrief: '', aiGenerated: false }
  const markerIndex = caseSummary.indexOf(marker)
  return {
    clientContext: caseSummary.slice(0, markerIndex).trim(),
    aiBrief: caseSummary.slice(markerIndex + marker.length).trim(),
    aiGenerated: marker === AI_CASE_BRIEF_MARKER,
  }
}
