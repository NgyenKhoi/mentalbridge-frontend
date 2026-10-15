'use client'

import AdminReportsManager from '@/components/AdminReportsManager'
import { useFeedback } from '@/components/ui/FeedbackProvider'

export default function AdminReportsSection() {
  const { showActionToast } = useFeedback()
  return (
    <AdminReportsManager
      onNotice={(message) => showActionToast({ title: message })}
    />
  )
}
