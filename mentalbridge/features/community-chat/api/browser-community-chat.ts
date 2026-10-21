import { browserApiClient } from '@/lib/api/browser-client'

import type {
  ChatConversation,
  ChatMessage,
  ChatPage,
  ChatPrivacy,
  ChatPrivacyView,
  ChatReadResult,
  ChatReportInput,
  ChatReportResult,
  ChatRequest,
  ChatSendResult,
  DirectConversationResult,
} from './community-chat-contract'

export type {
  ChatConversation,
  ChatDirectConversation,
  ChatGroupConversation,
  ChatMessage,
  ChatPrivacy,
  ChatPrivacyView,
  ChatReportInput,
  ChatReportReason,
  ChatReportResult,
  ChatRequest,
  DirectConversationResult,
} from './community-chat-contract'

export async function getChatPrivacy() {
  const response = await browserApiClient.get<ChatPrivacyView>(
    '/community/chat/privacy',
  )
  return response.data
}

export async function putChatPrivacy(input: ChatPrivacy, version: string) {
  const response = await browserApiClient.put<ChatPrivacyView>(
    '/community/chat/privacy',
    input,
    { headers: { 'If-Match': `"${version}"` } },
  )
  return response.data
}

export async function startDirectConversation(
  recipientCommunityProfileId: string,
  idempotencyKey: string,
) {
  const response = await browserApiClient.post<DirectConversationResult>(
    '/community/chat/direct-conversations',
    { recipientCommunityProfileId },
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
  return response.data
}

export async function getChatConversations(cursor?: string) {
  const response = await browserApiClient.get<ChatPage<ChatConversation>>(
    '/community/chat/conversations',
    { params: { limit: 20, ...(cursor ? { cursor } : {}) } },
  )
  return response.data
}

export async function getChatConversation(conversationId: string) {
  const response = await browserApiClient.get<ChatConversation>(
    `/community/chat/conversations/${encodeURIComponent(conversationId)}`,
  )
  return response.data
}

export async function getChatRequests(cursor?: string) {
  const response = await browserApiClient.get<ChatPage<ChatRequest>>(
    '/community/chat/requests',
    { params: { limit: 20, ...(cursor ? { cursor } : {}) } },
  )
  return response.data
}

export async function decideChatRequest(
  requestId: string,
  decision: 'ACCEPT' | 'DECLINE' | 'BLOCK',
  version: string,
) {
  const response = await browserApiClient.post<
    DirectConversationResult | undefined
  >(
    `/community/chat/requests/${encodeURIComponent(requestId)}/decision`,
    { decision },
    { headers: { 'If-Match': `"${version}"` } },
  )
  return response.data
}

export async function getChatMessages(conversationId: string, cursor?: string) {
  const response = await browserApiClient.get<ChatPage<ChatMessage>>(
    `/community/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    { params: { limit: 50, ...(cursor ? { cursor } : {}) } },
  )
  return response.data
}

export async function sendChatMessage(
  conversationId: string,
  content: string,
  clientMessageId: string,
) {
  const response = await browserApiClient.post<ChatSendResult>(
    `/community/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    { clientMessageId, content },
    { headers: { 'Idempotency-Key': clientMessageId } },
  )
  return response.data
}

export async function advanceChatReadCursor(
  conversationId: string,
  lastReadMessageId: string,
) {
  const response = await browserApiClient.put<ChatReadResult>(
    `/community/chat/conversations/${encodeURIComponent(conversationId)}/read-cursor`,
    { lastReadMessageId },
  )
  return response.data
}

export async function reportChatMessage(
  input: ChatReportInput,
  idempotencyKey: string,
) {
  const response = await browserApiClient.post<ChatReportResult>(
    '/community/chat/reports',
    input,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
  return response.data
}
