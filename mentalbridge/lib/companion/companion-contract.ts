export type CompanionContextKind =
  'JOURNAL' | 'SUPPORT_PLAN' | 'REASSESSMENT' | 'RESOURCE'

export type CompanionContextSources = Readonly<{
  plan: boolean
  diary: boolean
  screening: boolean
  resourceIds: string[]
}>

export type CompanionConversationContext = Readonly<{
  sources: CompanionContextSources
  updatedAt: string
}>

export type CompanionMessage = Readonly<{
  messageId: string
  role: 'USER' | 'ASSISTANT'
  content: string
  createdAt: string
  contextKinds: CompanionContextKind[]
}>

export type CompanionConversation = Readonly<{
  conversationId: string
  title: string
  context: CompanionConversationContext
  messages: CompanionMessage[]
  createdAt: string
  updatedAt: string
  expiresAt: string
}>

export type CompanionConversationSummary = Readonly<{
  conversationId: string
  title: string
  createdAt: string
  updatedAt: string
  expiresAt: string
}>

export type CompanionQuota = Readonly<{
  plan: 'FREE' | 'PLUS' | 'PREMIUM'
  policyVersion: 'companion-quota-v1'
  remaining: number | null
  resetAt: string
  limitDisplayed: boolean
}>

export type CompanionSend = Readonly<{
  conversationId: string
  userMessageId: string
  assistantMessageId: string
  assistant: string
  createdAt: string
  contextKinds: CompanionContextKind[]
  quota: CompanionQuota
}>

export type CompanionSendInput = Readonly<{
  message: string
}>

export type CompanionContextInput = Readonly<{
  sources: CompanionContextSources
}>
