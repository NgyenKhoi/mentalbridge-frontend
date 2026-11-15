import { notFound } from 'next/navigation'
import { socialUuid } from '@/features/community/api/community-social'
import CommunityMemberProfile from '@/features/community/components/CommunityMemberProfile'

export default async function CommunityMemberPage({
  params,
}: PageProps<'/community/members/[profileId]'>) {
  const { profileId } = await params
  if (!socialUuid.test(profileId)) notFound()
  return <CommunityMemberProfile key={profileId} profileId={profileId} />
}
