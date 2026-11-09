import { requireCurrentAccount } from '@/lib/auth/dal'
import OnboardingAssessmentJourney from '@/features/initial-check/components/OnboardingAssessmentJourney'

export default async function InitialCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ purpose?: string; returnTo?: string }>
}) {
  await requireCurrentAccount(['USER'])
  const params = await searchParams
  const purpose =
    params.purpose === 'reassessment' ? 'REASSESSMENT' : 'INITIAL_CHECK'
  return (
    <OnboardingAssessmentJourney
      purpose={purpose}
      planReview={params.returnTo === 'plan-review'}
    />
  )
}
