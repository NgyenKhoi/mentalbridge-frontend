import GuidedInitialCheck from '@/features/initial-check/components/GuidedInitialCheck'

export default async function InitialCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ purpose?: string; returnTo?: string }>
}) {
  const params = await searchParams
  const purpose =
    params.purpose === 'reassessment' ? 'REASSESSMENT' : 'INITIAL_CHECK'
  return (
    <main className="initial-check-page">
      <GuidedInitialCheck
        purpose={purpose}
        planReview={params.returnTo === 'plan-review'}
      />
    </main>
  )
}
