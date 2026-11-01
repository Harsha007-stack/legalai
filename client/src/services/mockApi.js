const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

export async function sendDemoMessage(message) {
  await wait(650)
  const text = message.toLowerCase()
  const category = /salary|wage|employment|workplace|labour|labor/.test(text)
    ? 'Employment'
    : /family|divorce|custody|marriage/.test(text)
      ? 'Family'
      : /rent|rental|deposit|tenant|landlord|property|builder|flat|noise/.test(text)
        ? 'Civil'
        : /consumer|refund|defect|product/.test(text)
          ? 'Consumer'
          : null
  return {
    text: `Thanks for sharing that. From what you have described, the first step is to put the facts and any records in one place so the options are easier to see. A qualified advocate can confirm which route fits your situation.\n\nYou mentioned: “${message.trim()}”`,
    category,
    query: message.trim(),
    summary: 'A short summary based only on what you shared.',
    followUps: [
      { question: 'Where did this happen (city and state)?', type: 'text', required: true },
      { question: 'Do you have written records or messages about this?', type: 'yes_no_not_sure', required: true },
      { question: 'Has this happened more than once?', type: 'yes_no', required: false },
    ],
    facts: ['Concern described by you — not independently verified'],
    missing: ['Location', 'Relevant dates', 'Supporting records'],
    nextSteps: [
      'Collect the documents and messages that relate to the issue.',
      'Write a short timeline of what happened and when.',
      'Send a written request to the other side if it is safe to do so.',
      'Discuss your situation with a qualified advocate before taking formal action.',
    ],
  }
}

export async function saveDemoDraft(content) {
  await wait(350)
  return { content, savedAt: new Date().toISOString() }
}
