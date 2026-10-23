import { create } from 'axios'
import { ApiError } from '@/api/api-error'
import {
  createReminderSource,
  reminderResponseSchema,
  toReminderOverview,
} from './reminder-api'
import { reminderUiFixtureResponse } from './reminder-test-fixtures'
import contract from './reminder-overview-v1.contract.json'

function clientFixture(data: unknown = reminderUiFixtureResponse()) {
  const adapter = jest.fn().mockResolvedValue({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  })
  const client = create({ baseURL: 'https://edge.test.invalid', adapter })
  return { adapter, client, source: createReminderSource(client) }
}
it('reads the single edge path with cancellation and no actor/date override', async () => {
  const value = clientFixture(),
    signal = new AbortController().signal
  expect(await value.source.read(signal)).toMatchObject({
    state: 'ready',
    today: [
      { status: 'due', destination: 'journal' },
      { status: 'completed', destination: 'emotion' },
    ],
    upcoming: [],
  })
  expect(value.adapter.mock.calls[0]?.[0]).toMatchObject({
    method: 'get',
    url: '/api/v1/reminder-overview',
    signal,
  })
  expect(value.adapter.mock.calls[0]?.[0].params).toBeUndefined()
})
it('aligns consumer states and required properties with the exported provider contract', () => {
  const properties = contract.schema.properties
  expect(contract.apiVersion).toBe('1.10.0')
  expect(Object.keys(reminderResponseSchema.shape).sort()).toEqual(
    [...contract.schema.required].sort(),
  )
  expect(
    reminderResponseSchema.shape.today.element.shape.status.options,
  ).toEqual(properties.today.items.properties.status.enum)
  expect(
    reminderResponseSchema.shape.previews.element.shape.state.options,
  ).toEqual(properties.previews.items.properties.state.enum)
  expect(
    reminderResponseSchema.shape.previews.element.shape.kind.options,
  ).toEqual(properties.previews.items.properties.kind.enum)
})
it('tolerates additive fields without displaying them', async () => {
  const raw = reminderUiFixtureResponse()
  const value = clientFixture({
    ...raw,
    futureField: 'not displayed',
    preferences: { ...raw.preferences, futureField: true },
  })
  expect(
    JSON.stringify(await value.source.read(new AbortController().signal)),
  ).not.toContain('futureField')
})
it.each([
  ['version', { schemaVersion: '2.0' }],
  ['timezone', { timeZone: 'Invalid/Zone' }],
  ['date', { localDate: '2026-10-21' }],
  [
    'foreign date',
    {
      today: [
        {
          id: 'JOURNAL:2026-10-21',
          category: 'JOURNAL',
          status: 'DUE',
          action: 'OPEN_JOURNAL',
        },
      ],
    },
  ],
  [
    'action mismatch',
    {
      today: [
        {
          id: 'JOURNAL:2026-10-22',
          category: 'JOURNAL',
          status: 'DUE',
          action: 'OPEN_EMOTION_CHECK_IN',
        },
      ],
    },
  ],
  [
    'duplicate activity',
    { today: Array(2).fill(reminderUiFixtureResponse().today[0]) },
  ],
  [
    'unknown status',
    {
      today: [
        { ...reminderUiFixtureResponse().today[0], status: 'PROVIDER_UNKNOWN' },
      ],
    },
  ],
  [
    'guaranteed send',
    {
      previews: [
        { ...reminderUiFixtureResponse().previews[0], estimate: false },
      ],
    },
  ],
  [
    'past preview',
    {
      previews: [
        {
          ...reminderUiFixtureResponse().previews[0],
          nextEligibleAt: '2026-10-21T23:00:00Z',
        },
      ],
    },
  ],
  [
    'future day preview',
    {
      previews: [
        {
          ...reminderUiFixtureResponse().previews[0],
          nextEligibleAt: '2026-10-23T03:00:00Z',
        },
      ],
    },
  ],
  [
    'wrong channel',
    {
      previews: [
        { ...reminderUiFixtureResponse().previews[0], channel: 'EMAIL' },
      ],
    },
  ],
  [
    'unsupported push',
    {
      previews: [
        { ...reminderUiFixtureResponse().previews[0], channel: 'PUSH' },
      ],
    },
  ],
  [
    'duplicate preview',
    { previews: Array(2).fill(reminderUiFixtureResponse().previews[0]) },
  ],
] as const)('fails closed for %s', async (_label, patch) => {
  const value = clientFixture({ ...reminderUiFixtureResponse(), ...patch })
  await expect(
    value.source.read(new AbortController().signal),
  ).rejects.toMatchObject({ code: 'REMINDER_CONTRACT_MISMATCH', status: 502 })
})
it.each([401, 403, 409, 503])(
  'preserves HTTP %s without fake rows',
  async (status) => {
    const value = clientFixture(),
      error = new ApiError({
        code: `HTTP_${status}`,
        status,
        message: 'safe error',
      })
    value.adapter.mockRejectedValue(error)
    await expect(value.source.read(new AbortController().signal)).rejects.toBe(
      error,
    )
  },
)
it.each([404, 501])(
  'reports unavailable during rollout for HTTP %s',
  async (status) => {
    const value = clientFixture()
    value.adapter.mockRejectedValue(
      new ApiError({ code: `HTTP_${status}`, status, message: 'not deployed' }),
    )
    expect(await value.source.read(new AbortController().signal)).toEqual({
      state: 'unavailable',
    })
  },
)
it('does not request after cancellation', async () => {
  const value = clientFixture(),
    controller = new AbortController()
  controller.abort()
  await expect(value.source.read(controller.signal)).rejects.toBeTruthy()
  expect(value.adapter).not.toHaveBeenCalled()
})
it('maps pause as an owner fact without removing activities or promising sends', () => {
  const raw = reminderUiFixtureResponse()
  const result = toReminderOverview(
    reminderResponseSchema.parse({
      ...raw,
      preferences: { ...raw.preferences, notificationsEnabled: false },
      previews: raw.previews.map((item) => ({
        ...item,
        state: 'PAUSED',
        nextEligibleAt: null,
      })),
    }),
  )
  expect(result).toMatchObject({
    delivery: { state: 'paused' },
    today: [{ status: 'due' }, { status: 'completed' }],
  })
})
