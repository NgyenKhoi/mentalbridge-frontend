import Link from 'next/link'
import { notFound } from 'next/navigation'

import AssessmentFlow from '@/features/assessment/components/AssessmentFlow'
import { requireCurrentAccount } from '@/lib/auth/dal'

import '../anonymous/assessment.css'

export default async function AssessmentPage({
  params,
}: PageProps<'/assessment/[type]'>) {
  const { type } = await params
  if (type !== 'phq9') notFound()
  await requireCurrentAccount(['USER'])

  return (
    <main className="anonymous-assessment authenticated-assessment">
      <div className="assessment-breathing-zone" aria-hidden="true" />
      <Link href="/assessments" className="assessment-flow-back">
        ← Tất cả bài đánh giá
      </Link>
      <AssessmentFlow mode="authenticated" />
    </main>
  )
}
