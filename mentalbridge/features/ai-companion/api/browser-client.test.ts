import { afterEach, describe, expect, it, vi } from 'vitest'
import { companionBrowserClient } from './browser-client'

const id = '11111111-1111-4111-8111-111111111111'
const reply = (body: BodyInit | null, status: number) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(body, { status })),
  )
const send = () =>
  companionBrowserClient.send(id, { message: 'Xin chào' }, 'key-0000000000001')

describe('companion browser client outcome codes', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['a 2xx body that cannot be parsed', '{ not json', 201],
    ['a 2xx body that is not a send result', '{"ok":true}', 201],
    ['a gateway error without a problem document', '<html>', 502],
  ])('reports an unknown send outcome for %s', async (_name, body, status) => {
    reply(body, status)
    await expect(send()).rejects.toMatchObject({
      code: 'COMPANION_OUTCOME_UNKNOWN',
    })
  })

  it.each([
    ['401 HTML page', '<html>', 401],
    ['429 with an unreadable body', '', 429],
    ['400 with an unreadable body', '{ not json', 400],
  ])(
    'keeps a definite failure for an unreadable %s',
    async (_n, body, status) => {
      reply(body, status)
      await expect(send()).rejects.toMatchObject({
        code: 'COMPANION_UNAVAILABLE',
        status,
      })
    },
  )

  it('treats an unreadable 409 as an unknown outcome (no in-progress code to read)', async () => {
    reply('<html>', 409)
    await expect(send()).rejects.toMatchObject({
      code: 'COMPANION_OUTCOME_UNKNOWN',
      status: 409,
    })
  })

  it('keeps the code of a parsed send problem', async () => {
    reply(
      JSON.stringify({ code: 'CHAT_PROVIDER_UNAVAILABLE', title: 'Gián đoạn' }),
      503,
    )
    await expect(send()).rejects.toMatchObject({
      code: 'CHAT_PROVIDER_UNAVAILABLE',
      status: 503,
    })
  })

  it('leaves other calls reporting COMPANION_UNAVAILABLE for an unreadable body', async () => {
    reply('<html>', 502)
    await expect(companionBrowserClient.get(id)).rejects.toMatchObject({
      code: 'COMPANION_UNAVAILABLE',
    })
  })
})
