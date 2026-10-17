import GuidedInitialCheck from '@/features/initial-check/components/GuidedInitialCheck'

export default async function InitialCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ purpose?: string }>
}) {
  const purpose =
    (await searchParams).purpose === 'reassessment'
      ? 'REASSESSMENT'
      : 'INITIAL_CHECK'
  return (
    <main className="initial-check-page">
      <GuidedInitialCheck purpose={purpose} />
    </main>
  )
}
