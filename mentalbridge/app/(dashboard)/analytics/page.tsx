import { redirect } from 'next/navigation'

// The look-back by chapter replaced the analytics page.
export default function AnalyticsPage() {
  redirect('/nhin-lai')
}
