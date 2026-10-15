import {
  create,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'
import { createNotificationApi } from './notification-api'
import { notificationSchema } from './notification-contract'
import {
  date,
  notification,
  notificationId,
  page,
  preferences,
  targetId,
} from './notification-fixtures'
function setup(data: unknown, etag?: string) {
  const requests: InternalAxiosRequestConfig[] = []
  const adapter: AxiosAdapter = async (config) => {
    requests.push(config)
    return {
      config,
      data,
      status: 200,
      statusText: 'OK',
      headers: AxiosHeaders.from(etag === undefined ? {} : { etag }),
    }
  }
  return { api: createNotificationApi(create({ adapter })), requests }
}
it('lists a bounded owner inbox using only the opaque server cursor', async () => {
  const { api, requests } = setup(page())
  await api.list('opaque_cursor')
  expect(requests[0]?.url).toBe('/api/v1/notifications')
  expect(requests[0]?.params).toEqual({ limit: 20, cursor: 'opaque_cursor' })
  expect(requests[0]?.data).toBeUndefined()
})
it('marks one notification read without actor, body or new idempotency protocol', async () => {
  const { api, requests } = setup(notification({ read: true, readAt: date }))
  await api.markRead(notificationId)
  expect(requests[0]?.url).toBe(`/api/v1/notifications/${notificationId}/read`)
  expect(requests[0]?.method).toBe('patch')
  expect(requests[0]?.data).toBeUndefined()
  expect(requests[0]?.headers.get('Idempotency-Key')).toBeUndefined()
})
it('uses only the mark-all owner command and server count', async () => {
  const { api, requests } = setup({ updatedCount: 8 })
  expect(await api.markAllRead()).toEqual({ updatedCount: 8 })
  expect(requests[0]?.url).toBe('/api/v1/notifications/mark-all-read')
  expect(requests[0]?.method).toBe('post')
  expect(requests[0]?.data).toBeUndefined()
})
it.each([
  { id: targetId, read: true, readAt: date },
  { read: false, readAt: null },
])('rejects wrong identity or unconfirmed read response', async (drift) => {
  const { api } = setup(notification(drift))
  await expect(api.markRead(notificationId)).rejects.toMatchObject({
    code: 'NOTIFICATION_CONTRACT_MISMATCH',
  })
})
it('fails closed on hidden payload fields and retired lifecycle records', () => {
  expect(
    notificationSchema.safeParse({
      ...notification(),
      rawJournal: 'must not cache',
    }).success,
  ).toBe(false)
  expect(
    notificationSchema.safeParse({
      ...notification(),
      lifecycleState: 'DELETED',
    }).success,
  ).toBe(false)
})
it('rejects an inconsistent or repeating pagination cursor', async () => {
  await expect(setup({ ...page(), hasMore: true }).api.list()).rejects.toThrow()
  await expect(
    setup(page([], 'repeat')).api.list('repeat'),
  ).rejects.toMatchObject({ code: 'NOTIFICATION_CONTRACT_MISMATCH' })
})
it('loads and saves versioned preferences with exact If-Match and minimal patch', async () => {
  const value = preferences(3)
  const { api, requests } = setup(value.preferences, value.etag)
  expect(await api.preferences()).toEqual(value)
  await api.savePreferences(
    {
      channels: { push: true },
      contentGroups: { communityInteraction: false },
    },
    '"2"',
  )
  expect(requests[1]?.url).toBe('/api/v1/notification-preferences')
  expect(requests[1]?.headers.get('If-Match')).toBe('"2"')
  expect(JSON.parse(requests[1]?.data)).toEqual({
    channels: { push: true },
    contentGroups: { communityInteraction: false },
  })
})
it.each([undefined, 'W/"0"', '"1"'])(
  'rejects missing, weak or mismatched preference ETag %s',
  async (etag) => {
    await expect(
      setup(preferences().preferences, etag).api.preferences(),
    ).rejects.toThrow()
  },
)
