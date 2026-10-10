import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'

function origin(path) {
  if (path.startsWith('/api/v1/auth/') || path === '/api/v1/account')
    return 'http://127.0.0.1:8080'
  if (path.startsWith('/api/v1/community/')) return 'http://127.0.0.1:8084'
  return undefined
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
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = Buffer.concat(chunks)
    const headers = new Headers()
    for (const name of [
      'accept',
      'authorization',
      'content-type',
      'idempotency-key',
      'if-match',
      'x-correlation-id',
    ]) {
      if (typeof request.headers[name] === 'string')
        headers.set(name, request.headers[name])
    }
    const upstream = await fetch(
      `${upstreamOrigin}${url.pathname}${url.search}`,
      {
        method: request.method,
        headers,
        redirect: 'error',
        ...(body.length ? { body } : {}),
      },
    )
    const returnedHeaders = {
      'content-type':
        upstream.headers.get('content-type') ?? 'application/json',
    }
    const etag = upstream.headers.get('etag')
    if (etag) returnedHeaders.etag = etag
    response.writeHead(upstream.status, returnedHeaders)
    response.end(Buffer.from(await upstream.arrayBuffer()))
    console.log(
      `${request.method} ${url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id')} -> ${upstream.status}`,
    )
  } catch {
    console.error('upstream_unavailable')
    response.writeHead(502)
    response.end()
  }
}).listen(8088, '0.0.0.0')
