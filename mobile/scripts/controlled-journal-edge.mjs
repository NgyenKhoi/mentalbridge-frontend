import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'

// Routing only. Every auth, Journal, consent and analysis decision comes from
// the unmodified real provider services. Internal paths are not exposed.
function origin(path) {
  if (path.startsWith('/api/v1/auth/') || path === '/api/v1/account')
    return 'http://127.0.0.1:8080'
  if (
    path === '/api/v1/journals' ||
    path.startsWith('/api/v1/journals/') ||
    path.startsWith('/api/v1/analysis-jobs/') ||
    path === '/api/v1/longitudinal-analysis-jobs' ||
    path.startsWith('/api/v1/longitudinal-analysis-jobs/')
  )
    return 'http://127.0.0.1:3000'
  if (
    path === '/api/v1/consent-decisions' ||
    path === '/api/v1/consents/ai-processing/authorization' ||
    path === '/api/v1/ai-processing-disclosures/current'
  )
    return 'http://127.0.0.1:8081'
  return undefined
}
function bodyOf(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}
createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:8088')
  if (url.pathname === '/health/ready') {
    response.writeHead(200)
    response.end('ready')
    return
  }
  const upstreamOrigin = origin(url.pathname)
  if (!upstreamOrigin) {
    response.writeHead(404)
    response.end()
    return
  }
  try {
    const body = await bodyOf(request)
    const headers = new Headers()
    for (const name of [
      'accept',
      'authorization',
      'content-type',
      'idempotency-key',
      'if-match-revision',
      'x-correlation-id',
    ]) {
      if (typeof request.headers[name] === 'string')
        headers.set(name, request.headers[name])
    }
    const upstream = await fetch(
      `${upstreamOrigin}${url.pathname}${url.search}`,
      { method: request.method, headers, ...(body.length ? { body } : {}) },
    )
    response.writeHead(upstream.status, {
      'content-type':
        upstream.headers.get('content-type') ?? 'application/json',
    })
    response.end(Buffer.from(await upstream.arrayBuffer()))
    // No bodies, credentials, subject IDs, entry IDs, or job IDs in evidence.
    console.log(
      `${request.method} ${url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id')} -> ${upstream.status}`,
    )
  } catch {
    console.error('upstream_unavailable')
    response.writeHead(502)
    response.end()
  }
}).listen(8088, '0.0.0.0')
