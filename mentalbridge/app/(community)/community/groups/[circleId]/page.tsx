import CommunityCircles from '@/features/community/components/CommunityCircles'
export default async function CommunityGroupPage({
  params,
}: {
  params: Promise<{ circleId: string }>
}) {
  const { circleId } = await params
  return <CommunityCircles key={circleId} selectedId={circleId} />
}
