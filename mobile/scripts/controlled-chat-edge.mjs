import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import { connect } from 'node:net'

if (
  process.env.CI !== 'true' ||
  process.env.PROVIDER_EVIDENCE !== 'protected-controlled-real-contract' ||
  process.env.MOBILE_EVIDENCE_FEATURE !== 'chat'
)
  throw new Error('Disposable protected chat edge required.')
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:8088')
  if (url.pathname === '/health/ready') {
    response.writeHead(200).end('ready')
    return
  }
  const identity =
    url.pathname.startsWith('/api/v1/auth/') ||
    url.pathname === '/api/v1/account'
  const consultation =
    request.method === 'GET' &&
    (['/api/v1/appointments', '/api/v1/specialist/appointments'].includes(
      url.pathname,
    ) ||
      /^\/internal\/v1\/appointments\/[0-9a-f-]{36}\/chat-eligibility$/i.test(
        url.pathname,
      ))
  const realtime =
    (request.method === 'POST' &&
      url.pathname === '/internal/v1/socket-credentials') ||
    (request.method === 'GET' &&
      /^\/api\/v1\/conversations\/[0-9a-f-]{36}\/messages$/i.test(url.pathname))
  if (!identity && !consultation && !realtime) {
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
    ])
      if (typeof request.headers[name] === 'string')
        headers.set(name, request.headers[name])
    const upstream = await fetch(
      `http://127.0.0.1:${identity ? 8080 : consultation ? 8082 : 3004}${url.pathname}${url.search}`,
      {
        method: request.method,
        headers,
        redirect: 'error',
        ...(body.length ? { body } : {}),
      },
    )
    response
      .writeHead(upstream.status, {
        'content-type':
          upstream.headers.get('content-type') ?? 'application/json',
      })
      .end(Buffer.from(await upstream.arrayBuffer()))
    console.log(
      `${request.method} ${url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id')} -> ${upstream.status}`,
    )
  } catch {
    response.writeHead(502).end()
    console.error('upstream_unavailable')
  }
})
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:8088')
  if (
    url.pathname !== '/socket.io/' ||
    request.headers.upgrade?.toLowerCase() !== 'websocket'
  ) {
    socket.destroy()
    return
  }
  // Opaque infrastructure relay. No credential, frame, message or query logging.
  const upstream = connect(3004, '127.0.0.1', () => {
    const headers = Object.entries(request.headers)
      .filter(([name]) => name !== 'host')
      .map(
        ([name, value]) =>
          `${name}: ${Array.isArray(value) ? value.join(', ') : value}`,
      )
      .join('\r\n')
    upstream.write(
      `GET ${request.url} HTTP/1.1\r\nHost: 127.0.0.1:3004\r\n${headers}\r\n\r\n`,
    )
    if (head.length) upstream.write(head)
    socket.pipe(upstream)
    upstream.pipe(socket)
  })
  socket.on('error', () => upstream.destroy())
  upstream.on('error', () => socket.destroy())
  socket.on('close', () => upstream.destroy())
  upstream.on('close', () => socket.destroy())
})
server.listen(8088, '0.0.0.0')
