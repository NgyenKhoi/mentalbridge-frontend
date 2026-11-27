import type { AxiosInstance } from 'axios'
import { z } from 'zod'

import { ApiError } from '@/api/api-error'

const instant = z.iso.datetime({ offset: true })
const summary = z.object({
  conversationId: z.uuid(),
  title: z.string().min(1).max(80),
  createdAt: instant,
})
const suggestion = z.object({
  destination: z.enum([
    'RESOURCE',
    'RESOURCE_LIBRARY',
    'JOURNAL',
    'EMOTION_CHECK_IN',
    'SUPPORT_PLAN',
    'SPECIALIST_DISCOVERY',
  ]),
  resourceId: z.uuid().nullable(),
  resourceTitle: z.string().min(1).max(200).nullable(),
})
const message = z.object({
  messageId: z.uuid(),
  role: z.enum(['USER', 'ASSISTANT']),
  content: z.string().min(1).max(2000),
  createdAt: instant,
  suggestion: suggestion.nullable().optional(),
})
const conversation = summary.extend({ messages: z.array(message).max(400) })
const reply = z.object({
  conversationId: z.uuid(),
  userMessageId: z.uuid(),
  assistantMessageId: z.uuid(),
  assistant: z.string().min(1).max(1500),
  createdAt: instant,
  suggestion: suggestion.nullable().optional(),
})
const collection = '/api/v1/ai-companion/conversations'

export type CompanionSuggestion = z.infer<typeof suggestion>
export type CompanionConversation = z.infer<typeof conversation>

function requireMatchingId(actual: string, expected: string) {
  if (actual !== expected)
    throw new ApiError({
      code: 'COMPANION_RESPONSE_MISMATCH',
      status: 502,
      message: 'Companion response does not match the current conversation.',
    })
}

export function createCompanionApi(client: AxiosInstance) {
  return {
    async list() {
      return z
        .object({ items: z.array(summary).max(50) })
        .parse((await client.get(collection)).data).items
    },
    async create() {
      return conversation.parse((await client.post(collection, {})).data)
    },
    async detail(id: string) {
      const item = conversation.parse(
        (await client.get(collection + '/' + z.uuid().parse(id))).data,
      )
      requireMatchingId(item.conversationId, id)
      return item
    },
    async send(id: string, text: string, key: string) {
      const result = reply.parse(
        (
          await client.post(
            collection + '/' + z.uuid().parse(id) + '/messages',
            {
              message: z.string().trim().min(1).max(2000).parse(text),
            },
            { headers: { 'Idempotency-Key': key }, timeout: 28000 },
          )
        ).data,
      )
      requireMatchingId(result.conversationId, id)
      return result
    },
  }
}
