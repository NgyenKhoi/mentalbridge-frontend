import SpecialistDiscovery from '@/features/specialist-discovery/components/SpecialistDiscovery'
import { isUuid } from '@/lib/care/care-validation'

type Props = Readonly<{
  searchParams: Promise<{
    from?: string | string[]
    supportGuideId?: string | string[]
  }>
}>

export default async function SpecialistsPage({ searchParams }: Props) {
  const query = await searchParams
  return (
    <SpecialistDiscovery
      returnSupportGuideId={
        query.from === 'support-guide' && isUuid(query.supportGuideId)
          ? query.supportGuideId
          : undefined
      }
    />
  )
}
