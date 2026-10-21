export type ChatPeer =
  | Readonly<{
      state: 'AVAILABLE'
      communityProfileId: string
      displayName: string
    }>
  | Readonly<{ state: 'UNAVAILABLE' }>

export type ChatPrivacy = Readonly<{
  directMessagePolicy: 'ANYONE' | 'APPROVAL_REQUIRED'
  presenceVisible: boolean
  invisible: boolean
  typingVisible: boolean
  readReceiptsVisible: boolean
}>

export type ChatPrivacyView = Readonly<{
  version: string
  preferences: ChatPrivacy
}>

export type DirectConversationResult =
  | Readonly<{ state: 'ACTIVE'; conversationId: string }>
  | Readonly<{ state: 'PENDING'; requestId: string }>

export type ChatRequest = Readonly<{
  requestId: string
  requester: ChatPeer
  state: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'BLOCKED' | 'EXPIRED'
  createdAt: string
  expiresAt: string
  version: string
}>

export type ChatDirectConversation = Readonly<{
  conversationId: string
  kind: 'DIRECT'
  state: 'ACTIVE' | 'READ_ONLY'
  peers: ChatPeer[]
  unreadCount: number
  version: string
}>

export type ChatGroupConversation = Readonly<{
  conversationId: string
  kind: 'GROUP'
  state: 'ACTIVE' | 'ARCHIVED'
  groupName: string
  viewerRole: 'OWNER' | 'ADMIN' | 'MEMBER'
  peers: ChatPeer[]
  unreadCount: number
  version: string
}>

export type ChatConversation = ChatDirectConversation | ChatGroupConversation

export type ChatGroup = Readonly<{
  conversationId: string
  kind: 'GROUP'
  name: string
  state: 'ACTIVE' | 'ARCHIVED'
  memberLimit: number
  version: string
}>

export type ChatGroupInvitation = Readonly<{
  invitationId: string
  conversationId: string
  groupName: string
  inviter: ChatPeer
  state: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED'
  expiresAt: string
  version: string
}>

export type ChatGroupMember = Readonly<{
  peer: ChatPeer
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  joinedAt: string
}>

export type ChatMessage = Readonly<{
  messageId: string
  conversationId: string
  clientMessageId: string
  sender: ChatPeer
  content: string
  createdAt: string
}>

export type ChatPage<T> = Readonly<{
  items: T[]
  nextCursor: string | null
}>

export type ChatSendResult = Readonly<{
  message: ChatMessage
  persistence: 'SAVED'
  delivery: 'UNCONFIRMED'
}>

export type ChatReadResult = Readonly<{
  lastReadMessageId: string | null
  unreadCount: number
}>

export type ChatReportReason =
  | 'HARASSMENT'
  | 'SPAM'
  | 'PRIVACY_CONCERN'
  | 'SELF_HARM_OR_CRISIS_CONCERN'
  | 'OTHER'

export type ChatReportInput = Readonly<{
  messageId: string
  reasonCode: ChatReportReason
  details?: string
}>

export type ChatReportResult = Readonly<{
  caseId: string
  state: 'RECEIVED'
}>

export const UUID_PATTERN =
  /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i
const VERSION_PATTERN = /^(0|[1-9]\d{0,18})$/

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort()
  return (
    actual.length === keys.length &&
    actual.every((key, index) => key === [...keys].sort()[index])
  )
}

function dateTime(value: unknown) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

export function parseChatPeer(value: unknown): ChatPeer | null {
  const item = record(value)
  if (!item) return null
  if (item.state === 'UNAVAILABLE' && exactKeys(item, ['state']))
    return { state: 'UNAVAILABLE' }
  if (
    item.state === 'AVAILABLE' &&
    exactKeys(item, ['state', 'communityProfileId', 'displayName']) &&
    typeof item.communityProfileId === 'string' &&
    UUID_PATTERN.test(item.communityProfileId) &&
    typeof item.displayName === 'string' &&
    [...item.displayName].length >= 1 &&
    [...item.displayName].length <= 80
  )
    return item as ChatPeer
  return null
}

export function parseChatPrivacy(value: unknown): ChatPrivacy | null {
  const item = record(value)
  if (
    !item ||
    !exactKeys(item, [
      'directMessagePolicy',
      'presenceVisible',
      'invisible',
      'typingVisible',
      'readReceiptsVisible',
    ]) ||
    !['ANYONE', 'APPROVAL_REQUIRED'].includes(
      String(item.directMessagePolicy),
    ) ||
    typeof item.presenceVisible !== 'boolean' ||
    typeof item.invisible !== 'boolean' ||
    typeof item.typingVisible !== 'boolean' ||
    typeof item.readReceiptsVisible !== 'boolean'
  )
    return null
  return item as ChatPrivacy
}

export function parseChatPrivacyView(value: unknown): ChatPrivacyView | null {
  const item = record(value)
  const preferences = item ? parseChatPrivacy(item.preferences) : null
  return item &&
    exactKeys(item, ['version', 'preferences']) &&
    typeof item.version === 'string' &&
    VERSION_PATTERN.test(item.version) &&
    preferences
    ? { version: item.version, preferences }
    : null
}

export function parseDirectConversationResult(
  value: unknown,
): DirectConversationResult | null {
  const item = record(value)
  if (!item) return null
  if (
    item.state === 'ACTIVE' &&
    exactKeys(item, ['state', 'conversationId']) &&
    typeof item.conversationId === 'string' &&
    UUID_PATTERN.test(item.conversationId)
  )
    return item as DirectConversationResult
  if (
    item.state === 'PENDING' &&
    exactKeys(item, ['state', 'requestId']) &&
    typeof item.requestId === 'string' &&
    UUID_PATTERN.test(item.requestId)
  )
    return item as DirectConversationResult
  return null
}

export function parseChatRequest(value: unknown): ChatRequest | null {
  const item = record(value)
  const requester = item ? parseChatPeer(item.requester) : null
  if (
    !item ||
    !exactKeys(item, [
      'requestId',
      'requester',
      'state',
      'createdAt',
      'expiresAt',
      'version',
    ]) ||
    typeof item.requestId !== 'string' ||
    !UUID_PATTERN.test(item.requestId) ||
    !requester ||
    !['PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED', 'EXPIRED'].includes(
      String(item.state),
    ) ||
    !dateTime(item.createdAt) ||
    !dateTime(item.expiresAt) ||
    typeof item.version !== 'string' ||
    !VERSION_PATTERN.test(item.version)
  )
    return null
  return { ...(item as Omit<ChatRequest, 'requester'>), requester }
}

export function parseChatConversation(value: unknown): ChatConversation | null {
  const item = record(value)
  if (!item || !Array.isArray(item.peers)) return null
  const commonValid =
    typeof item.conversationId === 'string' &&
    UUID_PATTERN.test(item.conversationId) &&
    item.peers.every((peer) => parseChatPeer(peer)) &&
    Number.isInteger(item.unreadCount) &&
    Number(item.unreadCount) >= 0 &&
    typeof item.version === 'string' &&
    VERSION_PATTERN.test(item.version)
  if (item.kind === 'DIRECT') {
    if (
      !exactKeys(item, [
        'conversationId',
        'kind',
        'state',
        'peers',
        'unreadCount',
        'version',
      ]) ||
      !commonValid ||
      item.peers.length > 2 ||
      !['ACTIVE', 'READ_ONLY'].includes(String(item.state))
    )
      return null
    return item as ChatDirectConversation
  }

  if (
    item.kind !== 'GROUP' ||
    !exactKeys(item, [
      'conversationId',
      'kind',
      'state',
      'groupName',
      'viewerRole',
      'peers',
      'unreadCount',
      'version',
    ]) ||
    !commonValid ||
    item.peers.length > 30 ||
    !['ACTIVE', 'ARCHIVED'].includes(String(item.state)) ||
    typeof item.groupName !== 'string' ||
    [...item.groupName].length < 1 ||
    [...item.groupName].length > 80 ||
    !['OWNER', 'ADMIN', 'MEMBER'].includes(String(item.viewerRole))
  )
    return null
  return item as ChatGroupConversation
}

export function parseChatMessage(value: unknown): ChatMessage | null {
  const item = record(value)
  const sender = item ? parseChatPeer(item.sender) : null
  if (
    !item ||
    !exactKeys(item, [
      'messageId',
      'conversationId',
      'clientMessageId',
      'sender',
      'content',
      'createdAt',
    ]) ||
    !['messageId', 'conversationId', 'clientMessageId'].every(
      (key) =>
        typeof item[key] === 'string' && UUID_PATTERN.test(String(item[key])),
    ) ||
    !sender ||
    typeof item.content !== 'string' ||
    [...item.content].length < 1 ||
    [...item.content].length > 4000 ||
    !dateTime(item.createdAt)
  )
    return null
  return { ...(item as Omit<ChatMessage, 'sender'>), sender }
}

export function parseChatPage<T>(
  value: unknown,
  parseItem: (item: unknown) => T | null,
): ChatPage<T> | null {
  const page = record(value)
  if (
    !page ||
    !exactKeys(page, ['items', 'nextCursor']) ||
    !Array.isArray(page.items) ||
    page.items.length > 50 ||
    !(
      page.nextCursor === null ||
      (typeof page.nextCursor === 'string' && page.nextCursor.length <= 1024)
    )
  )
    return null
  const items = page.items.map(parseItem)
  return items.every((item): item is T => item !== null)
    ? { items, nextCursor: page.nextCursor }
    : null
}

export const parseConversationPage = (value: unknown) =>
  parseChatPage(value, parseChatConversation)
export const parseRequestPage = (value: unknown) =>
  parseChatPage(value, parseChatRequest)
export const parseMessagePage = (value: unknown) =>
  parseChatPage(value, parseChatMessage)

export function parseChatGroup(value: unknown): ChatGroup | null {
  const item = record(value)
  return item &&
    exactKeys(item, [
      'conversationId',
      'kind',
      'name',
      'state',
      'memberLimit',
      'version',
    ]) &&
    typeof item.conversationId === 'string' &&
    UUID_PATTERN.test(item.conversationId) &&
    item.kind === 'GROUP' &&
    typeof item.name === 'string' &&
    [...item.name].length >= 1 &&
    [...item.name].length <= 80 &&
    ['ACTIVE', 'ARCHIVED'].includes(String(item.state)) &&
    Number.isInteger(item.memberLimit) &&
    Number(item.memberLimit) >= 20 &&
    Number(item.memberLimit) <= 30 &&
    typeof item.version === 'string' &&
    VERSION_PATTERN.test(item.version)
    ? (item as ChatGroup)
    : null
}

export function parseChatGroupInvitation(
  value: unknown,
): ChatGroupInvitation | null {
  const item = record(value)
  const inviter = item ? parseChatPeer(item.inviter) : null
  if (
    !item ||
    !exactKeys(item, [
      'invitationId',
      'conversationId',
      'groupName',
      'inviter',
      'state',
      'expiresAt',
      'version',
    ]) ||
    typeof item.invitationId !== 'string' ||
    !UUID_PATTERN.test(item.invitationId) ||
    typeof item.conversationId !== 'string' ||
    !UUID_PATTERN.test(item.conversationId) ||
    typeof item.groupName !== 'string' ||
    [...item.groupName].length < 1 ||
    [...item.groupName].length > 80 ||
    !inviter ||
    !['PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED'].includes(
      String(item.state),
    ) ||
    !dateTime(item.expiresAt) ||
    typeof item.version !== 'string' ||
    !VERSION_PATTERN.test(item.version)
  )
    return null
  return { ...(item as Omit<ChatGroupInvitation, 'inviter'>), inviter }
}

export function parseChatGroupMember(value: unknown): ChatGroupMember | null {
  const item = record(value)
  const peer = item ? parseChatPeer(item.peer) : null
  return item &&
    exactKeys(item, ['peer', 'role', 'joinedAt']) &&
    peer &&
    ['OWNER', 'ADMIN', 'MEMBER'].includes(String(item.role)) &&
    dateTime(item.joinedAt)
    ? { ...(item as Omit<ChatGroupMember, 'peer'>), peer }
    : null
}

export const parseGroupInvitationPage = (value: unknown) =>
  parseChatPage(value, parseChatGroupInvitation)
export const parseGroupMemberPage = (value: unknown) =>
  parseChatPage(value, parseChatGroupMember)

export function parseChatSendResult(value: unknown): ChatSendResult | null {
  const item = record(value)
  const message = item ? parseChatMessage(item.message) : null
  return item &&
    exactKeys(item, ['message', 'persistence', 'delivery']) &&
    message &&
    item.persistence === 'SAVED' &&
    item.delivery === 'UNCONFIRMED'
    ? { message, persistence: 'SAVED', delivery: 'UNCONFIRMED' }
    : null
}

export function parseChatReadResult(value: unknown): ChatReadResult | null {
  const item = record(value)
  return item &&
    exactKeys(item, ['lastReadMessageId', 'unreadCount']) &&
    (item.lastReadMessageId === null ||
      (typeof item.lastReadMessageId === 'string' &&
        UUID_PATTERN.test(item.lastReadMessageId))) &&
    Number.isInteger(item.unreadCount) &&
    Number(item.unreadCount) >= 0
    ? (item as ChatReadResult)
    : null
}

export function parseStartDirectInput(value: unknown) {
  const item = record(value)
  return item &&
    exactKeys(item, ['recipientCommunityProfileId']) &&
    typeof item.recipientCommunityProfileId === 'string' &&
    UUID_PATTERN.test(item.recipientCommunityProfileId)
    ? { recipientCommunityProfileId: item.recipientCommunityProfileId }
    : null
}

export function parseDecisionInput(value: unknown) {
  const item = record(value)
  return item &&
    exactKeys(item, ['decision']) &&
    ['ACCEPT', 'DECLINE', 'BLOCK'].includes(String(item.decision))
    ? { decision: item.decision as 'ACCEPT' | 'DECLINE' | 'BLOCK' }
    : null
}

export function parseCreateGroupInput(value: unknown) {
  const item = record(value)
  return item &&
    exactKeys(item, ['name']) &&
    typeof item.name === 'string' &&
    item.name.trim() === item.name &&
    [...item.name].length >= 1 &&
    [...item.name].length <= 80
    ? { name: item.name }
    : null
}

export function parseGroupInviteInput(value: unknown) {
  const item = record(value)
  return item &&
    exactKeys(item, ['inviteeCommunityProfileId']) &&
    typeof item.inviteeCommunityProfileId === 'string' &&
    UUID_PATTERN.test(item.inviteeCommunityProfileId)
    ? { inviteeCommunityProfileId: item.inviteeCommunityProfileId }
    : null
}

export function parseGroupDecisionInput(value: unknown) {
  const item = record(value)
  return item &&
    exactKeys(item, ['decision']) &&
    ['ACCEPT', 'DECLINE'].includes(String(item.decision))
    ? { decision: item.decision as 'ACCEPT' | 'DECLINE' }
    : null
}

export function parseSetGroupRoleInput(value: unknown) {
  const item = record(value)
  return item &&
    exactKeys(item, ['role']) &&
    ['ADMIN', 'MEMBER'].includes(String(item.role))
    ? { role: item.role as 'ADMIN' | 'MEMBER' }
    : null
}

export function parseTransferGroupOwnerInput(value: unknown) {
  const item = record(value)
  return item &&
    exactKeys(item, ['newOwnerCommunityProfileId']) &&
    typeof item.newOwnerCommunityProfileId === 'string' &&
    UUID_PATTERN.test(item.newOwnerCommunityProfileId)
    ? { newOwnerCommunityProfileId: item.newOwnerCommunityProfileId }
    : null
}

export function parseSendInput(value: unknown) {
  const item = record(value)
  return item &&
    exactKeys(item, ['clientMessageId', 'content']) &&
    typeof item.clientMessageId === 'string' &&
    UUID_PATTERN.test(item.clientMessageId) &&
    typeof item.content === 'string' &&
    /\S/u.test(item.content) &&
    [...item.content].length <= 4000
    ? { clientMessageId: item.clientMessageId, content: item.content }
    : null
}

export function parseReadInput(value: unknown) {
  const item = record(value)
  return item &&
    exactKeys(item, ['lastReadMessageId']) &&
    typeof item.lastReadMessageId === 'string' &&
    UUID_PATTERN.test(item.lastReadMessageId)
    ? { lastReadMessageId: item.lastReadMessageId }
    : null
}

const CHAT_REPORT_REASONS: ChatReportReason[] = [
  'HARASSMENT',
  'SPAM',
  'PRIVACY_CONCERN',
  'SELF_HARM_OR_CRISIS_CONCERN',
  'OTHER',
]

export function parseChatReportInput(value: unknown): ChatReportInput | null {
  const item = record(value)
  if (
    !item ||
    !exactKeys(
      item,
      item.details === undefined
        ? ['messageId', 'reasonCode']
        : ['messageId', 'reasonCode', 'details'],
    ) ||
    typeof item.messageId !== 'string' ||
    !UUID_PATTERN.test(item.messageId) ||
    !CHAT_REPORT_REASONS.includes(item.reasonCode as ChatReportReason) ||
    (item.details !== undefined &&
      (typeof item.details !== 'string' || [...item.details].length > 1000))
  )
    return null
  return item as ChatReportInput
}

export function parseChatReportResult(value: unknown): ChatReportResult | null {
  const item = record(value)
  return item &&
    exactKeys(item, ['caseId', 'state']) &&
    typeof item.caseId === 'string' &&
    UUID_PATTERN.test(item.caseId) &&
    item.state === 'RECEIVED'
    ? (item as ChatReportResult)
    : null
}
