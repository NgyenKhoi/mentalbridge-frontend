import { create, type AxiosAdapter } from 'axios'
import { createCircleApi } from './community-circle-api'

const circleId = '11111111-1111-4111-8111-111111111111'
const key = '22222222-2222-4222-8222-222222222222'
const entry = {
  id: key,
  author: null,
  text: 'Một chia sẻ trong nhóm',
  createdAt: '2026-11-16T08:00:00Z',
  canDelete: true,
}

it('reads only the authenticated member group page using the published cursor', async () => {
  const adapter: AxiosAdapter = jest.fn(async (config) => ({
    config,
    data: { items: [], nextCursor: null },
    status: 200,
    statusText: 'OK',
    headers: {},
  }))
  const api = createCircleApi(create({ adapter }))
  await api.list(circleId)
  expect(adapter).toHaveBeenCalledWith(
    expect.objectContaining({
      url: '/api/v1/community/circles',
      params: { limit: 10, cursor: circleId },
    }),
  )
})

it('sends a group post with its stable command key and rejects oversized content', async () => {
  const adapter: AxiosAdapter = jest.fn(async (config) => ({
    config,
    data: entry,
    status: 201,
    statusText: 'Created',
    headers: {},
  }))
  const api = createCircleApi(create({ adapter }))
  await expect(api.publish(circleId, entry.text, key)).resolves.toEqual(entry)
  expect(adapter).toHaveBeenCalledWith(
    expect.objectContaining({
      url: `/api/v1/community/circles/${circleId}/posts`,
      data: JSON.stringify({ text: entry.text }),
      headers: expect.objectContaining({ 'Idempotency-Key': key }),
    }),
  )
  await expect(api.publish(circleId, 'x'.repeat(5001), key)).rejects.toThrow()
  expect(adapter).toHaveBeenCalledTimes(1)
})
