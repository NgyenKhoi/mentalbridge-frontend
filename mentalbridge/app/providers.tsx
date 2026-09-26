'use client'

import type { ReactNode } from 'react'

import { FeedbackProvider } from '@/components/ui/FeedbackProvider'
import { QueryProvider } from '@/lib/query/query-provider'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <FeedbackProvider>{children}</FeedbackProvider>
    </QueryProvider>
  )
}
