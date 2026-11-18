import { create, type AxiosAdapter } from 'axios'

import { createCompanionApi } from './companion-api'

const id = '11111111-1111-4111-8111-111111111111'
const timestamp = '2026-11-15T12:00:00Z'

it('sends the message with its retry key through the authenticated conversation endpoint', async () => {
  const adapter: AxiosAdapter = async (config) => {
    expect(config.url).toBe(
      '/api/v1/ai-companion/conversations/' + id + '/messages',
    )
    expect(config.headers.get('Idempotency-Key')).toBe('stable-turn-key')
    expect(JSON.parse(config.data)).toEqual({ message: 'Xin chào' })
    return {
      config,
      status: 201,
      statusText: 'Created',
      headers: {},
      data: {
        conversationId: id,
        userMessageId: '22222222-2222-4222-8222-222222222222',
        assistantMessageId: '33333333-3333-4333-8333-333333333333',
        assistant: 'Mình đang nghe bạn.',
        createdAt: timestamp,
        suggestion: null,
      },
    }
  }
  await expect(
    createCompanionApi(create({ adapter })).send(
      id,
      ' Xin chào ',
      'stable-turn-key',
    ),
  ).resolves.toMatchObject({
    conversationId: id,
    assistant: 'Mình đang nghe bạn.',
  })
})

it('rejects a response belonging to a different conversation', async () => {
  const adapter: AxiosAdapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: {
      conversationId: '22222222-2222-4222-8222-222222222222',
      title: 'Phiên khác',
      createdAt: timestamp,
      messages: [],
    },
  })
  await expect(
    createCompanionApi(create({ adapter })).detail(id),
  ).rejects.toMatchObject({ code: 'COMPANION_RESPONSE_MISMATCH' })
})
