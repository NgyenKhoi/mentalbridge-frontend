import type { AxiosInstance } from 'axios'
import { z } from 'zod'
import { ApiError } from '@/api/api-error'
import * as c from './community-chat-contract'

const base = '/api/v1/community/chat'
const id = (value: string) => c.chatId.parse(value)
const revision = (value: string) => ({ 'If-Match': c.chatEtag.parse(value) })
const command = (value: string) => ({ 'Idempotency-Key': id(value) })
const params = (cursor?: string) => ({
  limit: 50,
  ...(cursor ? { cursor: z.string().min(1).max(1024).parse(cursor) } : {}),
})
export function chatMismatch(): never {
  throw new ApiError({
    code: 'COMMUNITY_CHAT_CONTRACT_MISMATCH',
    status: 502,
    message: 'Community chat response is inconsistent.',
  })
}
function versioned<T extends { version: string }>(
  value: T,
  header: unknown,
  allowBodyRevision = false,
): c.Versioned<T> {
  const etag =
    header === undefined && allowBodyRevision
      ? `"${value.version}"`
      : c.chatEtag.parse(header)
  if (etag !== `"${value.version}"`) chatMismatch()
  return { value, etag }
}
function continuation<T extends { nextCursor: string | null }>(
  value: T,
  cursor?: string,
): T {
  if (cursor && value.nextCursor === cursor) chatMismatch()
  return value
}
export function createCommunityChatApi(client: AxiosInstance) {
  return {
    async privacy() {
      const r = await client.get(`${base}/privacy`)
      return versioned(c.privacyViewSchema.parse(r.data), r.headers.etag, true)
    },
    async savePrivacy(value: c.ChatPrivacy, etag: string) {
      const r = await client.put(
        `${base}/privacy`,
        c.privacySchema.parse(value),
        { headers: revision(etag) },
      )
      return versioned(c.privacyViewSchema.parse(r.data), r.headers.etag)
    },
    async conversations(cursor?: string) {
      return continuation(
        c.conversationsSchema.parse(
          (
            await client.get(`${base}/conversations`, {
              params: params(cursor),
            })
          ).data,
        ),
        cursor,
      )
    },
    async conversation(conversationId: string) {
      const expected = id(conversationId),
        r = await client.get(`${base}/conversations/${expected}`)
      const value = c.conversationSchema.parse(r.data)
      if (value.conversationId !== expected) chatMismatch()
      return versioned(value, r.headers.etag, true)
    },
    async startDirect(profileId: string, key: string) {
      return c.directResultSchema.parse(
        (
          await client.post(
            `${base}/direct-conversations`,
            { recipientCommunityProfileId: id(profileId) },
            { headers: command(key) },
          )
        ).data,
      )
    },
    async requests(cursor?: string) {
      return continuation(
        c.requestsSchema.parse(
          (await client.get(`${base}/requests`, { params: params(cursor) }))
            .data,
        ),
        cursor,
      )
    },
    async decideRequest(
      requestId: string,
      decision: 'ACCEPT' | 'DECLINE' | 'BLOCK',
      etag: string,
    ) {
      const r = await client.post(
        `${base}/requests/${id(requestId)}/decision`,
        { decision: z.enum(['ACCEPT', 'DECLINE', 'BLOCK']).parse(decision) },
        { headers: revision(etag) },
      )
      if (decision !== 'ACCEPT') {
        if (r.status !== 204) chatMismatch()
        return null
      }
      return c.acceptedDirectSchema.parse(r.data)
    },
    async messages(conversationId: string, cursor?: string) {
      const expected = id(conversationId)
      const value = continuation(
        c.messagesSchema.parse(
          (
            await client.get(`${base}/conversations/${expected}/messages`, {
              params: params(cursor),
            })
          ).data,
        ),
        cursor,
      )
      if (value.items.some((item) => item.conversationId !== expected))
        chatMismatch()
      return value
    },
    async send(
      conversationId: string,
      clientMessageId: string,
      content: string,
      key: string,
    ) {
      const expected = id(conversationId),
        body = c.sendSchema.parse({ clientMessageId, content })
      const value = c.savedSchema.parse(
        (
          await client.post(
            `${base}/conversations/${expected}/messages`,
            body,
            { headers: command(key) },
          )
        ).data,
      )
      if (
        value.message.conversationId !== expected ||
        value.message.clientMessageId !== body.clientMessageId ||
        value.message.content !== body.content
      )
        chatMismatch()
      return value
    },
    async retract(conversationId: string, messageId: string) {
      const expectedConversation = id(conversationId)
      const expectedMessage = id(messageId)
      const value = c.retractedMessageSchema.parse(
        (
          await client.delete(
            `${base}/conversations/${expectedConversation}/messages/${expectedMessage}`,
          )
        ).data,
      )
      if (
        value.conversationId !== expectedConversation ||
        value.messageId !== expectedMessage
      )
        chatMismatch()
      return value
    },
    async read(conversationId: string, messageId: string) {
      return c.readSchema.parse(
        (
          await client.put(
            `${base}/conversations/${id(conversationId)}/read-cursor`,
            { lastReadMessageId: id(messageId) },
          )
        ).data,
      )
    },
    async createGroup(name: string, key: string) {
      const r = await client.post(
        `${base}/groups`,
        { name: c.groupNameSchema.parse(name) },
        { headers: command(key) },
      )
      return versioned(c.groupSchema.parse(r.data), r.headers.etag)
    },
    async members(conversationId: string, cursor?: string) {
      return continuation(
        c.membersSchema.parse(
          (
            await client.get(`${base}/groups/${id(conversationId)}/members`, {
              params: params(cursor),
            })
          ).data,
        ),
        cursor,
      )
    },
    async invitations(cursor?: string) {
      return continuation(
        c.invitationsSchema.parse(
          (await client.get(`${base}/invitations`, { params: params(cursor) }))
            .data,
        ),
        cursor,
      )
    },
    async invite(
      conversationId: string,
      profileId: string,
      etag: string,
      key: string,
    ) {
      const expected = id(conversationId)
      const r = await client.post(
        `${base}/groups/${expected}/invitations`,
        { inviteeCommunityProfileId: id(profileId) },
        { headers: { ...revision(etag), ...command(key) } },
      )
      const value = c.invitationSchema.parse(r.data)
      if (value.conversationId !== expected) chatMismatch()
      c.chatEtag.parse(r.headers.etag)
      return value
    },
    async decideInvitation(
      invitationId: string,
      conversationId: string,
      decision: 'ACCEPT' | 'DECLINE',
      etag: string,
    ) {
      const r = await client.post(
        `${base}/invitations/${id(invitationId)}/decision`,
        { decision: z.enum(['ACCEPT', 'DECLINE']).parse(decision) },
        { headers: revision(etag) },
      )
      if (decision === 'DECLINE') {
        if (r.status !== 204) chatMismatch()
        return null
      }
      const value = c.groupSchema.parse(r.data)
      if (value.conversationId !== id(conversationId)) chatMismatch()
      return versioned(value, r.headers.etag)
    },
    async setRole(
      conversationId: string,
      profileId: string,
      role: 'ADMIN' | 'MEMBER',
      etag: string,
    ) {
      const r = await client.put(
        `${base}/groups/${id(conversationId)}/members/${id(profileId)}/role`,
        { role: z.enum(['ADMIN', 'MEMBER']).parse(role) },
        { headers: revision(etag) },
      )
      const value = c.memberSchema.parse(r.data)
      if (
        value.peer.state !== 'AVAILABLE' ||
        value.peer.communityProfileId !== profileId ||
        value.role !== role
      )
        chatMismatch()
      c.chatEtag.parse(r.headers.etag)
      return value
    },
    async removeMember(
      conversationId: string,
      profileId: string,
      etag: string,
    ) {
      const r = await client.delete(
        `${base}/groups/${id(conversationId)}/members/${id(profileId)}`,
        { headers: revision(etag) },
      )
      if (r.status !== 204) chatMismatch()
    },
    async transfer(conversationId: string, profileId: string, etag: string) {
      const expected = id(conversationId)
      const r = await client.post(
        `${base}/groups/${expected}/ownership`,
        { newOwnerCommunityProfileId: id(profileId) },
        { headers: revision(etag) },
      )
      const value = c.groupSchema.parse(r.data)
      if (value.conversationId !== expected) chatMismatch()
      return versioned(value, r.headers.etag)
    },
    async archive(conversationId: string, etag: string) {
      const r = await client.delete(`${base}/groups/${id(conversationId)}`, {
        headers: revision(etag),
      })
      if (r.status !== 204) chatMismatch()
    },
    async credential() {
      return c.credentialSchema.parse(
        (await client.post('/api/v1/community/socket-credentials')).data,
      )
    },
    async report(
      messageId: string,
      reasonCode:
        | 'HARASSMENT'
        | 'SPAM'
        | 'PRIVACY_CONCERN'
        | 'SELF_HARM_OR_CRISIS_CONCERN'
        | 'OTHER',
      key: string,
    ) {
      return z
        .strictObject({ caseId: c.chatId, state: z.literal('RECEIVED') })
        .parse(
          (
            await client.post(
              `${base}/reports`,
              {
                messageId: id(messageId),
                reasonCode: z
                  .enum([
                    'HARASSMENT',
                    'SPAM',
                    'PRIVACY_CONCERN',
                    'SELF_HARM_OR_CRISIS_CONCERN',
                    'OTHER',
                  ])
                  .parse(reasonCode),
              },
              { headers: command(key) },
            )
          ).data,
        )
    },
  }
}
export type CommunityChatApi = ReturnType<typeof createCommunityChatApi>
