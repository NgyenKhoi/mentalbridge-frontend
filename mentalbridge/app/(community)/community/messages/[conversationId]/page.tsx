import CommunityChatWorkspace from '@/features/community-chat/components/CommunityChatWorkspace'

export default async function CommunityConversationPage({
  params,
}: PageProps<'/community/messages/[conversationId]'>) {
  const { conversationId } = await params
  return <CommunityChatWorkspace initialConversationId={conversationId} />
}
