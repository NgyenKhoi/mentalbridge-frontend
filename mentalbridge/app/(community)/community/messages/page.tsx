import CommunityChatWorkspace from '@/features/community-chat/components/CommunityChatWorkspace'
import { UUID_PATTERN } from '@/features/community-chat/api/community-chat-contract'

export default async function CommunityMessagesPage({
  searchParams,
}: PageProps<'/community/messages'>) {
  const query = await searchParams
  const recipient =
    typeof query.to === 'string' && UUID_PATTERN.test(query.to)
      ? query.to
      : undefined
  const consentTarget = [query.requestId, query.invitationId].find(
    (value): value is string =>
      typeof value === 'string' && UUID_PATTERN.test(value),
  )
  return (
    <CommunityChatWorkspace
      key={consentTarget ?? 'conversations'}
      recipientCommunityProfileId={recipient}
      initialTab={consentTarget ? 'requests' : 'conversations'}
    />
  )
}
