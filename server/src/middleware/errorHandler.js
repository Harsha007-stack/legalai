export function notFoundHandler(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' } })
}

export function errorHandler(error, req, res, _next) {
  const status = Number.isInteger(error.status) ? error.status : 500
  const code = error.code || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR')
  const message = status === 500 ? 'Something went wrong. Please try again.' : error.message
  if (status >= 500) console.error(JSON.stringify({
    requestId: req.id,
    code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  }))
  res.status(status).json({ error: { code, message, requestId: req.id } })
}
