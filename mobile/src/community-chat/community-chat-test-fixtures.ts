import type { CommunityChatApi } from './community-chat-api'
import type {
  CommunityConversation,
  CommunityMessage,
  ChatPrivacy,
} from './community-chat-contract'
export const chatFixtureId = '11111111-1111-4111-8111-111111111111'
export const chatFixtureOwnId = '22222222-2222-4222-8222-222222222222'
export const chatFixturePeerId = '33333333-3333-4333-8333-333333333333'
export const chatFixtureDate = '2026-10-21T01:00:00Z'
export const chatFixturePeer = {
  state: 'AVAILABLE' as const,
  communityProfileId: chatFixturePeerId,
  displayName: 'Mây',
}
export const chatFixturePrivacy: ChatPrivacy = {
  directMessagePolicy: 'APPROVAL_REQUIRED',
  presenceVisible: false,
  invisible: false,
  typingVisible: false,
  readReceiptsVisible: false,
}
export const chatFixtureConversation: CommunityConversation = {
  conversationId: chatFixtureId,
  kind: 'DIRECT',
  state: 'ACTIVE',
  peers: [chatFixturePeer],
  unreadCount: 2,
  version: '9007199254740993',
}
export const chatFixtureMessage: CommunityMessage = {
  messageId: chatFixtureId,
  conversationId: chatFixtureId,
  clientMessageId: chatFixtureId,
  sender: chatFixturePeer,
  state: 'ACTIVE',
  content: '<b>Lời chào an toàn</b>',
  createdAt: chatFixtureDate,
}
export function chatFixtureApi(): CommunityChatApi {
  return {
    privacy: jest.fn().mockResolvedValue({
      value: { version: '9007199254740993', preferences: chatFixturePrivacy },
      etag: '"9007199254740993"',
    }),
    savePrivacy: jest.fn(),
    conversations: jest.fn().mockResolvedValue({
      items: [chatFixtureConversation],
      nextCursor: null,
    }),
    conversation: jest.fn().mockResolvedValue({
      value: chatFixtureConversation,
      etag: '"9007199254740993"',
    }),
    clearConversation: jest.fn().mockResolvedValue(undefined),
    startDirect: jest
      .fn()
      .mockResolvedValue({ state: 'PENDING', requestId: chatFixtureId }),
    requests: jest.fn().mockResolvedValue({
      items: [
        {
          requestId: chatFixtureId,
          requester: chatFixturePeer,
          state: 'PENDING',
          createdAt: chatFixtureDate,
          expiresAt: '2099-01-01T00:00:00Z',
          version: '17',
        },
      ],
      nextCursor: null,
    }),
    decideRequest: jest.fn().mockResolvedValue(null),
    messages: jest
      .fn()
      .mockResolvedValue({ items: [chatFixtureMessage], nextCursor: null }),
    send: jest.fn().mockResolvedValue({
      message: chatFixtureMessage,
      persistence: 'SAVED',
      delivery: 'UNCONFIRMED',
    }),
    retract: jest.fn(),
    read: jest
      .fn()
      .mockResolvedValue({ lastReadMessageId: chatFixtureId, unreadCount: 0 }),
    createGroup: jest.fn(),
    members: jest.fn().mockResolvedValue({
      items: [
        {
          peer: {
            state: 'AVAILABLE',
            communityProfileId: chatFixtureOwnId,
            displayName: 'Tôi',
          },
          role: 'OWNER',
          joinedAt: chatFixtureDate,
        },
        { peer: chatFixturePeer, role: 'ADMIN', joinedAt: chatFixtureDate },
      ],
      nextCursor: null,
    }),
    invitations: jest.fn().mockResolvedValue({
      items: [
        {
          invitationId: chatFixtureId,
          conversationId: chatFixtureId,
          groupName: 'Khoảng xanh',
          inviter: chatFixturePeer,
          state: 'PENDING',
          expiresAt: '2099-01-01T00:00:00Z',
          version: '24',
        },
      ],
      nextCursor: null,
    }),
    invite: jest.fn(),
    decideInvitation: jest.fn().mockResolvedValue(null),
    setRole: jest.fn(),
    removeMember: jest.fn(),
    transfer: jest.fn(),
    archive: jest.fn(),
    credential: jest.fn().mockImplementation(async () => ({
      schemaVersion: 1,
      namespace: '/community',
      credential: 'x'.repeat(43),
      expiresAt: new Date(Date.now() + 30000).toISOString(),
    })),
    report: jest
      .fn()
      .mockResolvedValue({ caseId: chatFixtureId, state: 'RECEIVED' }),
  }
}
