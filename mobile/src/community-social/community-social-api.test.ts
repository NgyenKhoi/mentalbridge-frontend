import type { AxiosInstance } from 'axios'

import { ApiError } from '@/api/api-error'

import { createCommunitySocialApi } from './community-social-api'
import {
  circle,
  circleDetail,
  circleId,
  entry,
  entryId,
  friendship,
  friendshipId,
  memberProfile,
  peer,
  peerId,
  secondPeerId,
} from './community-social-fixtures'

function setup() {
  const methods = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  }
  return {
    ...methods,
    api: createCommunitySocialApi(methods as unknown as AxiosInstance),
  }
}
const key = '99999999-9999-4999-8999-999999999999'
const base = '/api/v1/community'

describe('direct Community friends and member API', () => {
  it('lists a friendship view with a uuid cursor and member search with a bounded term', async () => {
    const { api, get } = setup()
    get.mockResolvedValue({
      data: { items: [friendship('FRIENDS')], nextCursor: null },
    })
    await api.friends('incoming', peerId)
    expect(get).toHaveBeenCalledWith(`${base}/chat/friends`, {
      params: { view: 'incoming', limit: 30, cursor: peerId },
    })
    get.mockResolvedValue({ data: { items: [peer], nextCursor: null } })
    await api.searchMembers('minh')
    expect(get).toHaveBeenLastCalledWith(`${base}/members`, {
      params: { q: 'minh', limit: 20 },
    })
    await expect(api.searchMembers('m')).rejects.toThrow()
    await expect(api.friends('accepted', 'bad')).rejects.toThrow()
  })

  it('requests, accepts and removes a friendship with empty bodies and no idempotency header', async () => {
    const { api, put, post, delete: remove } = setup()
    put.mockResolvedValue({ data: friendship('OUTGOING') })
    expect((await api.requestFriend(peerId)).state).toBe('OUTGOING')
    expect(put).toHaveBeenCalledWith(`${base}/chat/friends/${peerId}`, {})
    post.mockResolvedValue({ data: friendship('FRIENDS') })
    expect((await api.acceptFriend(friendshipId)).state).toBe('FRIENDS')
    expect(post).toHaveBeenCalledWith(
      `${base}/chat/friendships/${friendshipId}/accept`,
      {},
    )
    remove.mockResolvedValue({ status: 204 })
    await api.removeFriend(friendshipId)
    expect(remove).toHaveBeenCalledWith(
      `${base}/chat/friendships/${friendshipId}`,
    )
  })

  it('rejects an answer about another member or friendship', async () => {
    const { api, put, post, get } = setup()
    put.mockResolvedValue({ data: friendship('OUTGOING') })
    await expect(api.requestFriend(secondPeerId)).rejects.toMatchObject({
      code: 'COMMUNITY_CONTRACT_MISMATCH',
    })
    post.mockResolvedValue({ data: friendship('FRIENDS') })
    await expect(api.acceptFriend(secondPeerId)).rejects.toBeInstanceOf(
      ApiError,
    )
    get.mockResolvedValue({ data: memberProfile('NONE') })
    await expect(api.member(secondPeerId)).rejects.toBeInstanceOf(ApiError)
  })

  it('loads a member page with a feed cursor and rejects extra fields', async () => {
    const { api, get } = setup()
    get.mockResolvedValue({ data: memberProfile('FRIENDS') })
    expect((await api.member(peerId, 'opaque')).friendship.state).toBe(
      'FRIENDS',
    )
    expect(get).toHaveBeenCalledWith(`${base}/members/${peerId}`, {
      params: { limit: 12, cursor: 'opaque' },
    })
    get.mockResolvedValue({ data: { ...memberProfile('FRIENDS'), email: 'x' } })
    await expect(api.member(peerId)).rejects.toThrow()
  })

  it('propagates provider failures untouched so the screen can map them', async () => {
    const { api, get } = setup()
    const failure = new ApiError({ code: 'X', message: 'x', status: 503 })
    get.mockRejectedValue(failure)
    await expect(api.friends('accepted')).rejects.toBe(failure)
  })
})

describe('direct Community circles API', () => {
  it('lists circles at the contract limit and reads a detail by id', async () => {
    const { api, get } = setup()
    get.mockResolvedValue({ data: { items: [circle()], nextCursor: null } })
    await api.circles(peerId)
    expect(get).toHaveBeenCalledWith(`${base}/circles`, {
      params: { limit: 10, cursor: peerId },
    })
    get.mockResolvedValue({ data: circleDetail('OWNER') })
    expect((await api.circle(circleId)).group.role).toBe('OWNER')
    await expect(api.circle(peerId)).rejects.toMatchObject({
      code: 'COMMUNITY_CONTRACT_MISMATCH',
    })
  })

  it('creates with a uuid Idempotency-Key and rejects duplicate invitees', async () => {
    const { api, post } = setup()
    post.mockResolvedValue({ data: circle({ role: 'OWNER' }) })
    const body = { name: 'Nhóm', description: '', invitees: [peerId] }
    await api.createCircle(body, key)
    expect(post).toHaveBeenCalledWith(`${base}/circles`, body, {
      headers: { 'Idempotency-Key': key },
    })
    await expect(
      api.createCircle({ ...body, invitees: [peerId, peerId] }, key),
    ).rejects.toThrow()
    await expect(api.createCircle(body, 'not-a-uuid')).rejects.toThrow()
  })

  it('invites, decides, removes members and archives with the contract paths', async () => {
    const { api, post, delete: remove } = setup()
    post.mockResolvedValue({ status: 204 })
    remove.mockResolvedValue({ status: 204 })
    await api.invite(circleId, peerId)
    expect(post).toHaveBeenLastCalledWith(
      `${base}/circles/${circleId}/invitations`,
      { profileId: peerId },
    )
    await api.decide(circleId, 'DECLINE')
    expect(post).toHaveBeenLastCalledWith(
      `${base}/circles/${circleId}/decision`,
      { decision: 'DECLINE' },
    )
    await api.removeMember(circleId, peerId)
    expect(remove).toHaveBeenLastCalledWith(
      `${base}/circles/${circleId}/members/${peerId}`,
    )
    await api.archiveCircle(circleId)
    expect(remove).toHaveBeenLastCalledWith(`${base}/circles/${circleId}`)
  })

  it('publishes text entries and comments with keys and deletes each by its own path', async () => {
    const { api, get, post, delete: remove } = setup()
    get.mockResolvedValue({ data: { items: [entry()], nextCursor: null } })
    await api.entries(circleId)
    expect(get).toHaveBeenLastCalledWith(`${base}/circles/${circleId}/posts`, {
      params: { limit: 10 },
    })
    await api.comments(circleId, entryId, peerId)
    expect(get).toHaveBeenLastCalledWith(
      `${base}/circles/${circleId}/posts/${entryId}/comments`,
      { params: { limit: 10, cursor: peerId } },
    )
    post.mockResolvedValue({ data: entry() })
    await api.publish(circleId, 'Chào cả nhà', key)
    expect(post).toHaveBeenLastCalledWith(
      `${base}/circles/${circleId}/posts`,
      { text: 'Chào cả nhà' },
      { headers: { 'Idempotency-Key': key } },
    )
    await api.comment(circleId, entryId, 'Mình đây', key)
    expect(post).toHaveBeenLastCalledWith(
      `${base}/circles/${circleId}/posts/${entryId}/comments`,
      { text: 'Mình đây' },
      { headers: { 'Idempotency-Key': key } },
    )
    await expect(api.publish(circleId, '   ', key)).rejects.toThrow()
    remove.mockResolvedValue({ status: 204 })
    await api.deleteEntry(circleId, entryId)
    expect(remove).toHaveBeenLastCalledWith(
      `${base}/circles/${circleId}/posts/${entryId}`,
    )
    await api.deleteComment(circleId, entryId)
    expect(remove).toHaveBeenLastCalledWith(
      `${base}/circles/${circleId}/comments/${entryId}`,
    )
  })

  it('refuses a non-uuid path segment before any request', async () => {
    const { api, get, delete: remove } = setup()
    await expect(api.circle('../x')).rejects.toThrow()
    await expect(api.removeMember(circleId, 'x')).rejects.toThrow()
    expect(get).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })
})
