import { describe, expect, it } from 'vitest'

import {
  parseChatConversation,
  parseChatGroup,
  parseChatGroupInvitation,
  parseChatGroupMember,
  parseChatMessage,
  parseChatReportInput,
  parseChatReportResult,
  parseConversationPage,
  parseCreateGroupInput,
  parseGroupDecisionInput,
  parseGroupInviteInput,
  parseSetGroupRoleInput,
  parseTransferGroupOwnerInput,
} from './community-chat-contract'

const peer = {
  state: 'AVAILABLE',
  communityProfileId: '10000000-0000-4000-8000-000000000001',
  displayName: 'Mầm Nắng',
}

function direct(index: number) {
  return {
    conversationId: `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    kind: 'DIRECT',
    state: 'ACTIVE',
    peers: [peer],
    unreadCount: index,
    version: '1',
  }
}

const group = {
  conversationId: '20000000-0000-4000-8000-000000000099',
  kind: 'GROUP',
  state: 'ACTIVE',
  groupName: 'Nhóm đồng hành',
  viewerRole: 'MEMBER',
  peers: [peer],
  unreadCount: 2,
  version: '2',
}

describe('community chat contract', () => {
  it('parses the canonical DIRECT and GROUP conversation union in mixed order', () => {
    const result = parseConversationPage({
      items: [direct(1), group, direct(2)],
      nextCursor: 'opaque-next',
    })

    expect(result?.items.map((item) => item.kind)).toEqual([
      'DIRECT',
      'GROUP',
      'DIRECT',
    ])
    expect(result?.nextCursor).toBe('opaque-next')
    expect(parseChatConversation(group)).toMatchObject({
      kind: 'GROUP',
      groupName: 'Nhóm đồng hành',
      viewerRole: 'MEMBER',
    })
  })

  it('keeps the cursor on a valid group-only page', () => {
    expect(
      parseConversationPage({ items: [group], nextCursor: 'find-direct-next' }),
    ).toMatchObject({ nextCursor: 'find-direct-next' })
  })

  it('strictly validates exact-message report input and response', () => {
    const input = {
      messageId: '40000000-0000-4000-8000-000000000001',
      reasonCode: 'SELF_HARM_OR_CRISIS_CONCERN',
      details: 'Please review this exact message.',
    }
    expect(parseChatReportInput(input)).toEqual(input)
    expect(
      parseChatReportInput({ ...input, actorId: peer.communityProfileId }),
    ).toBeNull()
    expect(
      parseChatReportInput({ ...input, details: 'x'.repeat(1001) }),
    ).toBeNull()
    expect(
      parseChatReportResult({
        caseId: '60000000-0000-4000-8000-000000000001',
        state: 'RECEIVED',
      }),
    ).not.toBeNull()
  })

  it('accepts structured active and retracted messages without leaking tombstone content', () => {
    const base = {
      messageId: '40000000-0000-4000-8000-000000000001',
      conversationId: '20000000-0000-4000-8000-000000000001',
      clientMessageId: '50000000-0000-4000-8000-000000000001',
      sender: peer,
      createdAt: '2026-10-20T08:00:00Z',
    }
    expect(
      parseChatMessage({ ...base, state: 'ACTIVE', content: 'Một lời chào.' }),
    ).toMatchObject({ state: 'ACTIVE', content: 'Một lời chào.' })
    expect(
      parseChatMessage({
        ...base,
        state: 'RETRACTED',
        retractedAt: '2026-10-20T08:01:00Z',
      }),
    ).toMatchObject({ state: 'RETRACTED' })
    expect(
      parseChatMessage({
        ...base,
        state: 'RETRACTED',
        content: 'must not survive',
        retractedAt: '2026-10-20T08:01:00Z',
      }),
    ).toBeNull()
  })

  it('strictly validates private-group results and commands', () => {
    expect(
      parseChatGroup({
        conversationId: group.conversationId,
        kind: 'GROUP',
        name: group.groupName,
        state: 'ACTIVE',
        memberLimit: 30,
        version: '2',
      }),
    ).not.toBeNull()
    expect(
      parseChatGroupInvitation({
        invitationId: '30000000-0000-4000-8000-000000000001',
        conversationId: group.conversationId,
        groupName: group.groupName,
        inviter: peer,
        state: 'PENDING',
        expiresAt: '2026-10-28T00:00:00Z',
        version: '1',
      }),
    ).not.toBeNull()
    expect(
      parseChatGroupMember({
        peer,
        role: 'ADMIN',
        joinedAt: '2026-10-20T00:00:00Z',
      }),
    ).not.toBeNull()
    expect(parseCreateGroupInput({ name: 'Góc bình yên' })).toEqual({
      name: 'Góc bình yên',
    })
    expect(parseCreateGroupInput({ name: ' Gắn khoảng trắng ' })).toBeNull()
    expect(
      parseGroupInviteInput({
        inviteeCommunityProfileId: peer.communityProfileId,
      }),
    ).not.toBeNull()
    expect(parseGroupDecisionInput({ decision: 'BLOCK' })).toBeNull()
    expect(parseSetGroupRoleInput({ role: 'OWNER' })).toBeNull()
    expect(
      parseTransferGroupOwnerInput({
        newOwnerCommunityProfileId: peer.communityProfileId,
      }),
    ).not.toBeNull()
  })

  it('rejects extra group fields to prevent client-authored authority', () => {
    expect(
      parseCreateGroupInput({
        name: 'Góc bình yên',
        ownerId: peer.communityProfileId,
      }),
    ).toBeNull()
    expect(
      parseGroupInviteInput({
        inviteeCommunityProfileId: peer.communityProfileId,
        role: 'ADMIN',
      }),
    ).toBeNull()
  })
})
