import type { AxiosInstance } from 'axios'
import { z } from 'zod'

import { authorSchema } from './community-contract'

const circle = z.strictObject({
  id: z.uuid(),
  name: z.string().min(1).max(80),
  description: z.string().max(500),
  membership: z.enum(['ACTIVE', 'PENDING']),
  role: z.enum(['OWNER', 'MEMBER']),
  memberCount: z.number().int().min(1),
  createdAt: z.iso.datetime({ offset: true }),
})
const circlePage = z.strictObject({
  items: z.array(circle).max(10),
  nextCursor: z.uuid().nullable(),
})
const entry = z.strictObject({
  id: z.uuid(),
  author: authorSchema.nullable(),
  text: z.string().min(1).max(5000),
  createdAt: z.iso.datetime({ offset: true }),
  canDelete: z.boolean(),
})
const entries = z.strictObject({
  items: z.array(entry).max(10),
  nextCursor: z.uuid().nullable(),
})
const root = '/api/v1/community/circles'
export type CommunityCircle = z.infer<typeof circle>
export type CircleApi = ReturnType<typeof createCircleApi>

export function createCircleApi(client: AxiosInstance) {
  return {
    async list(cursor?: string) {
      return circlePage.parse(
        (
          await client.get(root, {
            params: {
              limit: 10,
              ...(cursor ? { cursor: z.uuid().parse(cursor) } : {}),
            },
          })
        ).data,
      )
    },
    async posts(id: string, cursor?: string) {
      return entries.parse(
        (
          await client.get(`${root}/${z.uuid().parse(id)}/posts`, {
            params: {
              limit: 10,
              ...(cursor ? { cursor: z.uuid().parse(cursor) } : {}),
            },
          })
        ).data,
      )
    },
    async publish(id: string, text: string, key: string) {
      return entry.parse(
        (
          await client.post(
            `${root}/${z.uuid().parse(id)}/posts`,
            { text: z.string().trim().min(1).max(5000).parse(text) },
            { headers: { 'Idempotency-Key': z.uuid().parse(key) } },
          )
        ).data,
      )
    },
    async decide(id: string, decision: 'ACCEPT' | 'DECLINE') {
      await client.post(`${root}/${z.uuid().parse(id)}/decision`, { decision })
    },
  }
}
