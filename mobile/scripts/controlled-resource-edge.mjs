import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'

const identityOrigin = 'http://127.0.0.1:8080'
const contentOrigin = 'http://127.0.0.1:3003'

function upstreamOrigin(pathname) {
  if (pathname.startsWith('/api/v1/auth/') || pathname === '/api/v1/account') {
    return identityOrigin
  }
  if (
    pathname === '/api/v1/resources' ||
    pathname.startsWith('/api/v1/resources/') ||
    pathname === '/api/v1/resource-progress' ||
    pathname.startsWith('/api/v1/resource-progress/')
  ) {
    return contentOrigin
  }
  return undefined
}

function requestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1:8088')
    if (requestUrl.pathname === '/health/ready') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end('{"status":"ok"}')
      return
    }

    const origin = upstreamOrigin(requestUrl.pathname)
    if (!origin) {
      response.writeHead(404, { 'content-type': 'application/json' })
      response.end('{"error":"route_not_found"}')
      return
    }

    const body = await requestBody(request)
    const headers = new Headers()
    for (const name of [
      'accept',
      'authorization',
      'content-type',
      'idempotency-key',
      'x-correlation-id',
    ]) {
      const value = request.headers[name]
      if (typeof value === 'string') headers.set(name, value)
    }

    const upstream = await fetch(
      `${origin}${requestUrl.pathname}${requestUrl.search}`,
      {
        method: request.method,
        headers,
        ...(body.length > 0 ? { body } : {}),
      },
    )
    const responseBody = Buffer.from(await upstream.arrayBuffer())
    const responseHeaders = {
      'content-type':
        upstream.headers.get('content-type') ?? 'application/json',
    }
    const correlationId = upstream.headers.get('x-correlation-id')
    if (correlationId) responseHeaders['x-correlation-id'] = correlationId
    console.log(
      `${request.method} ${requestUrl.pathname} -> ${upstream.status}`,
    )
    response.writeHead(upstream.status, responseHeaders)
    response.end(responseBody)
  } catch (error) {
    console.error(
      `${request.method} ${request.url ?? '/'} -> upstream_unavailable`,
      error instanceof Error ? error.name : 'UnknownError',
    )
    response.writeHead(502, { 'content-type': 'application/json' })
    response.end('{"error":"upstream_unavailable"}')
  }
})

server.listen(8088, '0.0.0.0')
