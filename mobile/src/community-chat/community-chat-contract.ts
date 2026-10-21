import { z } from 'zod'

export const chatId = z.uuid()
export const chatVersion = z.string().regex(/^(0|[1-9][0-9]{0,18})$/)
export const chatEtag = z.string().regex(/^"(0|[1-9][0-9]{0,18})"$/)
const instant = z.iso.datetime({ offset: true })
const boundedText = (max: number) =>
  z
    .string()
    .refine((value) => [...value].length > 0 && [...value].length <= max)
export const groupNameSchema = boundedText(80).refine(
  (value) => value === value.trim() && Boolean(value.trim()),
)
export const peerSchema = z.discriminatedUnion('state', [
  z.strictObject({
    state: z.literal('AVAILABLE'),
    communityProfileId: chatId,
    displayName: boundedText(80),
  }),
  z.strictObject({ state: z.literal('UNAVAILABLE') }),
])
export const privacySchema = z.strictObject({
  directMessagePolicy: z.enum(['ANYONE', 'APPROVAL_REQUIRED']),
  presenceVisible: z.boolean(),
  invisible: z.boolean(),
  typingVisible: z.boolean(),
  readReceiptsVisible: z.boolean(),
})
export const privacyViewSchema = z.strictObject({
  version: chatVersion,
  preferences: privacySchema,
})
export const conversationSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    conversationId: chatId,
    kind: z.literal('DIRECT'),
    state: z.enum(['ACTIVE', 'READ_ONLY']),
    peers: z.array(peerSchema).max(2),
    unreadCount: z.number().int().nonnegative(),
    version: chatVersion,
  }),
  z.strictObject({
    conversationId: chatId,
    kind: z.literal('GROUP'),
    state: z.enum(['ACTIVE', 'ARCHIVED']),
    groupName: boundedText(80),
    viewerRole: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
    peers: z.array(peerSchema).max(30),
    unreadCount: z.number().int().nonnegative(),
    version: chatVersion,
  }),
])
export const messageSchema = z.strictObject({
  messageId: chatId,
  conversationId: chatId,
  clientMessageId: chatId,
  sender: peerSchema,
  content: boundedText(4000),
  createdAt: instant,
})
export const requestSchema = z.strictObject({
  requestId: chatId,
  requester: peerSchema,
  state: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED', 'EXPIRED']),
  createdAt: instant,
  expiresAt: instant,
  version: chatVersion,
})
export const invitationSchema = z.strictObject({
  invitationId: chatId,
  conversationId: chatId,
  groupName: boundedText(80),
  inviter: peerSchema,
  state: z.enum(['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED']),
  expiresAt: instant,
  version: chatVersion,
})
export const groupSchema = z.strictObject({
  conversationId: chatId,
  kind: z.literal('GROUP'),
  name: boundedText(80),
  state: z.enum(['ACTIVE', 'ARCHIVED']),
  memberLimit: z.number().int().min(20).max(30),
  version: chatVersion,
})
export const memberSchema = z.strictObject({
  peer: peerSchema,
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
  joinedAt: instant,
})
const page = <T extends z.ZodType>(item: T) =>
  z.strictObject({
    items: z.array(item).max(50),
    nextCursor: z.string().min(1).max(1024).nullable(),
  })
export const conversationsSchema = page(conversationSchema)
export const messagesSchema = page(messageSchema)
export const requestsSchema = page(requestSchema)
export const invitationsSchema = page(invitationSchema)
export const membersSchema = page(memberSchema)
export const acceptedDirectSchema = z.strictObject({
  state: z.literal('ACTIVE'),
  conversationId: chatId,
})
export const directResultSchema = z.discriminatedUnion('state', [
  acceptedDirectSchema,
  z.strictObject({ state: z.literal('PENDING'), requestId: chatId }),
])
export const messageContentSchema = boundedText(4000).refine((value) =>
  /\S/u.test(value),
)
export const sendSchema = z.strictObject({
  clientMessageId: chatId,
  content: messageContentSchema,
})
export const savedSchema = z.strictObject({
  message: messageSchema,
  persistence: z.literal('SAVED'),
  delivery: z.literal('UNCONFIRMED'),
})
export const readSchema = z.strictObject({
  lastReadMessageId: chatId.nullable(),
  unreadCount: z.number().int().nonnegative(),
})
export const credentialSchema = z.strictObject({
  schemaVersion: z.literal(1),
  namespace: z.literal('/community'),
  credential: z.string().min(32).max(512),
  expiresAt: instant,
})
const event = {
  schemaVersion: z.literal(1),
  eventId: chatId,
  correlationId: chatId,
  occurredAt: instant,
}
export const eventSchema = z.discriminatedUnion('eventType', [
  z.strictObject({
    ...event,
    eventType: z.literal('community.message.created'),
    payload: z.strictObject({ message: messageSchema }),
  }),
  z.strictObject({
    ...event,
    eventType: z.literal('community.conversation.invalidated'),
    payload: z.strictObject({ conversationId: chatId }),
  }),
  z.strictObject({
    ...event,
    eventType: z.literal('community.resync.required'),
    payload: z.strictObject({ conversationId: chatId }),
  }),
  z.strictObject({
    ...event,
    eventType: z.literal('community.read-state.changed'),
    payload: readSchema.extend({ conversationId: chatId }),
  }),
  z.strictObject({
    ...event,
    eventType: z.literal('community.presence.changed'),
    payload: z.strictObject({
      communityProfileId: chatId,
      state: z.enum(['ONLINE', 'OFFLINE', 'UNKNOWN']),
    }),
  }),
  z.strictObject({
    ...event,
    eventType: z.literal('community.command.ack'),
    payload: z.strictObject({
      commandId: chatId,
      status: z.literal('ACCEPTED'),
    }),
  }),
  z.strictObject({
    ...event,
    eventType: z.literal('community.command.error'),
    payload: z.strictObject({
      commandId: chatId,
      code: z.enum([
        'INVALID_COMMAND',
        'UNAUTHENTICATED',
        'TARGET_UNAVAILABLE',
        'RATE_LIMITED',
        'DEPENDENCY_UNAVAILABLE',
      ]),
      retryable: z.boolean(),
    }),
  }),
])
export type CommunityConversation = z.infer<typeof conversationSchema>
export type CommunityMessage = z.infer<typeof messageSchema>
export type ChatPeer = z.infer<typeof peerSchema>
export type ChatPrivacy = z.infer<typeof privacySchema>
export type ChatRequest = z.infer<typeof requestSchema>
export type ChatInvitation = z.infer<typeof invitationSchema>
export type ChatMember = z.infer<typeof memberSchema>
export type ChatEvent = z.infer<typeof eventSchema>
export type Versioned<T> = Readonly<{ value: T; etag: string }>
