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
  return <CommunityChatWorkspace recipientCommunityProfileId={recipient} />
}
