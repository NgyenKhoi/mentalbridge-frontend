import CommunityPostDetail from '@/features/community/components/CommunityPostDetail'

import '../community.css'

type Props = Readonly<{ params: Promise<{ postId: string }> }>

export default async function CommunityPostPage({ params }: Props) {
  const { postId } = await params
  return <CommunityPostDetail postId={postId} />
}
