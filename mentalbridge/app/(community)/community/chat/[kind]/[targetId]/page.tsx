import { notFound, redirect } from 'next/navigation'

import { UUID_PATTERN } from '@/features/community-chat/api/community-chat-contract'

export default async function CommunityChatNotificationTarget({
  params,
}: PageProps<'/community/chat/[kind]/[targetId]'>) {
  const { kind, targetId } = await params
  if (!UUID_PATTERN.test(targetId)) notFound()
  if (kind === 'conversations') redirect(`/community/messages/${targetId}`)
  if (kind === 'requests') redirect(`/community/messages?requestId=${targetId}`)
  if (kind === 'invitations')
    redirect(`/community/messages?invitationId=${targetId}`)
  notFound()
}
