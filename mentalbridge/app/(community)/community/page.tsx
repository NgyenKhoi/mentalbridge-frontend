import CommunityFeed from '@/features/community/components/CommunityFeed'

import './community.css'

export default async function CommunityPage({
  searchParams,
}: PageProps<'/community'>) {
  const query = await searchParams
  return (
    <CommunityFeed
      search={typeof query.q === 'string' ? query.q.slice(0, 120) : ''}
    />
  )
}
