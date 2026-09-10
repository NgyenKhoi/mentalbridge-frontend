import Link from 'next/link'
import { notFound } from 'next/navigation'

import AssessmentFlow from '@/features/assessment/components/AssessmentFlow'
import type { Instrument } from '@/features/assessment/api/care-contract'
import { requireCurrentAccount } from '@/lib/auth/dal'

import '../anonymous/assessment.css'

export default async function AssessmentPage({
  params,
  searchParams,
}: PageProps<'/assessment/[type]'>) {
  const { type } = await params
  const { assessmentId } = await searchParams
  const instruments: Readonly<Record<string, Instrument>> = {
    phq9: 'PHQ9',
    gad7: 'GAD7',
  }
  const instrument = instruments[type]
  if (!instrument) notFound()
  await requireCurrentAccount(['USER'])

  return (
    <main className="anonymous-assessment authenticated-assessment">
      <div className="assessment-breathing-zone" aria-hidden="true" />
      <Link href="/assessments" className="assessment-flow-back">
        ← Tất cả bài đánh giá
      </Link>
      <AssessmentFlow
        mode="authenticated"
        instrument={instrument}
        initialAssessmentId={
          typeof assessmentId === 'string' ? assessmentId : undefined
        }
      />
    </main>
  )
}
