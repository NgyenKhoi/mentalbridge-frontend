import { describe, expect, it } from 'vitest'

import {
  parseChatConversation,
  parseChatReportInput,
  parseChatReportResult,
  parseConversationPage,
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
})
