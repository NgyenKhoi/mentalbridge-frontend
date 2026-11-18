const { getDefaultConfig } = require('expo/metro-config')
const { request } = require('node:http')

const config = getDefaultConfig(__dirname)
const originalMiddleware = config.server.enhanceMiddleware
const web = 'http://127.0.0.1:3000'
const publicPages = new Set(['/privacy', '/terms', '/safety-directory'])
const publicAssets = new Set([
  '/favicon.ico',
  '/images/emotional-journal.png',
  '/videos/openhero/cloud-forest-sanctuaries.mp4',
])
const forwardedHeaders = [
  'accept',
  'accept-language',
  'range',
  'if-none-match',
  'if-modified-since',
  'rsc',
  'next-router-state-tree',
  'next-router-prefetch',
  'next-router-segment-prefetch',
]

function landingRequestPath(req) {
  if (!['GET', 'HEAD'].includes(req.method)) return null
  if (
    !req.url?.startsWith('/') ||
    req.url.startsWith('//') ||
    /%2f|%5c|%2e|%25|\\/i.test(req.url.split('?')[0])
  )
    return null
  const url = new URL(req.url, web)
  if (url.origin !== web) return null
  if (url.pathname === '/mentalbridge-landing') return '/' + url.search
  if (
    publicPages.has(url.pathname) ||
    publicAssets.has(url.pathname) ||
    url.pathname.startsWith('/_next/static/')
  )
    return url.pathname + url.search
  if (
    url.pathname === '/_next/image' &&
    url.searchParams.getAll('url').length === 1 &&
    url.searchParams.get('url') === '/images/emotional-journal.png'
  )
    return url.pathname + url.search
  return null
}

config.server.enhanceMiddleware = (middleware, server) => {
  const metro = originalMiddleware(middleware, server)
  return (req, res, next) => {
    const path = landingRequestPath(req)
    if (path === null) return metro(req, res, next)
    const headers = {}
    for (const name of forwardedHeaders) {
      if (req.headers[name] !== undefined) headers[name] = req.headers[name]
    }
    const upstream = request(
      web + path,
      { method: req.method, headers, timeout: 25000 },
      (incoming) => {
        res.writeHead(incoming.statusCode, incoming.headers)
        incoming.pipe(res)
      },
    )
    upstream.on('timeout', () => upstream.destroy())
    upstream.on('error', () => {
      if (!res.headersSent)
        res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('MentalBridge web is unavailable')
    })
    res.on('close', () => upstream.destroy())
    upstream.end()
  }
}

module.exports = config
