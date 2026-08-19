import { QueryClient } from '@tanstack/react-query'

import { ApiError } from '@/lib/api'

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status && error.status < 500) {
    return false
  }

  return failureCount < 2
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: shouldRetry,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
