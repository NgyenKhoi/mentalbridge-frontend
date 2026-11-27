import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'

if (process.env.PROVIDER_EVIDENCE !== 'protected-controlled-real-contract')
  throw new Error('Disposable controlled provider required.')
createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:8088')
  if (url.pathname === '/health/ready') {
    response.writeHead(200).end('ready')
    return
  }
  const identity =
    url.pathname.startsWith('/api/v1/auth/') ||
    url.pathname === '/api/v1/account'
  const discovery =
    url.pathname === '/api/v1/specialists' ||
    /^\/api\/v1\/specialists\/[0-9a-f-]{36}$/i.test(url.pathname)
  const appointments =
    process.env.MOBILE_EVIDENCE_FEATURE === 'appointments' &&
    process.env.CI === 'true' &&
    ((request.method === 'GET' &&
      [
        '/api/v1/appointments',
        '/api/v1/service-credits',
        '/api/v1/bookable-slots',
      ].includes(url.pathname)) ||
      (request.method === 'POST' &&
        (url.pathname === '/api/v1/appointments' ||
          /^\/api\/v1\/appointments\/[0-9a-f-]{36}\/cancel$/i.test(
            url.pathname,
          ))))
  if (
    (!identity && !discovery && !appointments) ||
    (discovery && request.method !== 'GET')
  ) {
    response.writeHead(404).end()
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
      'x-correlation-id',
      'idempotency-key',
      'if-match',
    ]) {
      if (typeof request.headers[name] === 'string')
        headers.set(name, request.headers[name])
    }
    const upstream = await fetch(
      `${identity ? 'http://127.0.0.1:8080' : 'http://127.0.0.1:8082'}${url.pathname}${url.search}`,
      {
        method: request.method,
        headers,
        redirect: 'error',
        ...(body.length ? { body } : {}),
      },
    )
    response.writeHead(upstream.status, {
      'content-type':
        upstream.headers.get('content-type') ?? 'application/json',
    })
    response.end(Buffer.from(await upstream.arrayBuffer()))
    console.log(
      `${request.method} ${url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id')} -> ${upstream.status}`,
    )
  } catch {
    response.writeHead(502).end()
    console.error('upstream_unavailable')
  }
}).listen(8088, '0.0.0.0')
