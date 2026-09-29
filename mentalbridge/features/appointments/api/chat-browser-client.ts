import { browserApiClient } from '@/lib/api/browser-client'
import {
  parseAppointmentChatEligibility,
  type AppointmentChatEligibility,
} from '@/lib/consultation/consultation-validation'

export type ChatMessage = Readonly<{
  messageId: string
  conversationId: string
  senderId: string
  clientMessageId: string
  type: 'TEXT'
  content: string
  sentAt: string
  schemaVersion: 1
}>

export async function chatEligibility(
  appointmentId: string,
  operation: 'subscribe' | 'send' | 'history',
): Promise<AppointmentChatEligibility> {
  const response = await browserApiClient.get(
    `/consultation/appointments/${encodeURIComponent(appointmentId)}/chat-eligibility`,
    { params: { operation } },
  )
  const parsed = parseAppointmentChatEligibility(response.data)
  if (!parsed) throw new Error('Chat eligibility response is invalid.')
  return parsed
}

export async function socketCredential() {
  const response = await browserApiClient.post<{
    accessToken: string
    expiresAt: string
    endpoint: string
  }>('/realtime/socket-credentials')
  return response.data
}

export async function chatHistory(conversationId: string) {
  const response = await browserApiClient.get<{
    items: ChatMessage[]
    nextCursor: string | null
    hasMore: boolean
  }>(`/realtime/conversations/${encodeURIComponent(conversationId)}/messages`, {
    params: { limit: 100 },
  })
  return response.data
}
