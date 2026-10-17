import { ApiError } from '@/api'

import { createQueryClient, shouldRetryQuery } from './query-client'

describe('mobile query client', () => {
  it('does not retry client failures and bounds transient retries', () => {
    expect(
      shouldRetryQuery(
        0,
        new ApiError({
          code: 'UNAUTHORIZED',
          message: 'Unauthorized',
          status: 401,
        }),
      ),
    ).toBe(false)
    expect(shouldRetryQuery(0, new Error('network'))).toBe(true)
    expect(shouldRetryQuery(2, new Error('network'))).toBe(false)
  })

  it('never retries mutations automatically', () => {
    const client = createQueryClient()

    expect(client.getDefaultOptions().mutations?.retry).toBe(false)
    expect(client.getDefaultOptions().queries?.staleTime).toBe(30_000)
  })
})
