'use client'
import { browserApiClient } from '@/lib/api/browser-client'
import type {
  Circle,
  CirclePage,
  CircleDetail,
  EntryPage,
  CircleEntry,
} from './community-circles'
import type { components } from '@/contracts/community.generated'
const base = '/community/circles'
export async function listCircles(cursor?: string) {
  return (
    await browserApiClient.get<CirclePage>(base, {
      params: { limit: 10, ...(cursor ? { cursor } : {}) },
    })
  ).data
}
export async function getCircle(id: string) {
  return (await browserApiClient.get<CircleDetail>(`${base}/${id}`)).data
}
export async function createCircle(
  input: components['schemas']['CreateCommunityCircle'],
  key: string,
) {
  return (
    await browserApiClient.post<Circle>(base, input, {
      headers: { 'Idempotency-Key': key },
    })
  ).data
}
export async function circleEntries(
  id: string,
  parent?: string,
  cursor?: string,
) {
  return (
    await browserApiClient.get<EntryPage>(
      `${base}/${id}/posts${parent ? '/' + parent + '/comments' : ''}`,
      { params: { limit: 10, ...(cursor ? { cursor } : {}) } },
    )
  ).data
}
export async function publishCircleEntry(
  id: string,
  text: string,
  key: string,
  parent?: string,
) {
  return (
    await browserApiClient.post<CircleEntry>(
      `${base}/${id}/posts${parent ? '/' + parent + '/comments' : ''}`,
      { text },
      { headers: { 'Idempotency-Key': key } },
    )
  ).data
}
export async function decideCircle(id: string, decision: 'ACCEPT' | 'DECLINE') {
  await browserApiClient.post(`${base}/${id}/decision`, { decision })
}
export async function inviteCircle(id: string, profileId: string) {
  await browserApiClient.post(`${base}/${id}/invitations`, { profileId })
}
export async function removeCircleMember(id: string, profileId: string) {
  await browserApiClient.delete(`${base}/${id}/members/${profileId}`)
}
export async function archiveCircle(id: string) {
  await browserApiClient.delete(`${base}/${id}`)
}
export async function deleteCircleEntry(
  id: string,
  entryId: string,
  comment = false,
) {
  await browserApiClient.delete(
    `${base}/${id}/${comment ? 'comments' : 'posts'}/${entryId}`,
  )
}
