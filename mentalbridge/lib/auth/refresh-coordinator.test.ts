import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import type { TokenPair } from '@/features/auth/api/identity-contract'

import { RefreshCoordinator } from './refresh-coordinator'

const tokenPair: TokenPair = {
  accessToken: 'access-token',
  tokenType: 'Bearer',
  expiresIn: 900,
  refreshToken: 'n'.repeat(43),
  refreshExpiresAt: '2026-09-01T00:00:00Z',
}

describe('RefreshCoordinator', () => {
  it('shares one rotation across concurrent and exact replay requests', async () => {
    let complete: ((value: TokenPair) => void) | undefined
    const execute = vi.fn(
      () =>
        new Promise<TokenPair>((resolve) => {
          complete = resolve
        }),
    )
    const coordinator = new RefreshCoordinator(execute, {
      createIdempotencyKey: () => 'stable-idempotency-key',
    })

    const first = coordinator.refresh('r'.repeat(43), 'correlation-one')
    const second = coordinator.refresh('r'.repeat(43), 'correlation-two')

    expect(execute).toHaveBeenCalledTimes(1)
    complete?.(tokenPair)

    await expect(first).resolves.toBe(tokenPair)
    await expect(second).resolves.toBe(tokenPair)
    await expect(
      coordinator.refresh('r'.repeat(43), 'correlation-three'),
    ).resolves.toBe(tokenPair)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('keeps one idempotency key across a bounded transient retry', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError({
          message: 'timed out',
          code: 'IDENTITY_TIMEOUT',
          status: 504,
        }),
      )
      .mockResolvedValueOnce(tokenPair)
    const coordinator = new RefreshCoordinator(execute, {
      createIdempotencyKey: () => 'stable-idempotency-key',
    })

    await expect(
      coordinator.refresh('s'.repeat(43), 'correlation-id'),
    ).resolves.toBe(tokenPair)
    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute.mock.calls[0]?.[1]).toBe('stable-idempotency-key')
    expect(execute.mock.calls[1]?.[1]).toBe('stable-idempotency-key')
  })

  it('derives the same replay key across coordinator instances', async () => {
    const firstExecutor = vi.fn().mockResolvedValue(tokenPair)
    const secondExecutor = vi.fn().mockResolvedValue(tokenPair)
    const refreshToken = 'u'.repeat(43)

    await new RefreshCoordinator(firstExecutor).refresh(
      refreshToken,
      'correlation-one',
    )
    await new RefreshCoordinator(secondExecutor).refresh(
      refreshToken,
      'correlation-two',
    )

    expect(firstExecutor.mock.calls[0]?.[1]).toMatch(/^refresh-[A-Za-z0-9_-]+$/)
    expect(secondExecutor.mock.calls[0]?.[1]).toBe(
      firstExecutor.mock.calls[0]?.[1],
    )
  })

  it('does not loop after a failed refresh', async () => {
    const failure = new ApiError({
      message: 'invalid session',
      code: 'INVALID_SESSION',
      status: 401,
    })
    const execute = vi.fn().mockRejectedValue(failure)
    const coordinator = new RefreshCoordinator(execute)

    await expect(
      coordinator.refresh('t'.repeat(43), 'correlation-id'),
    ).rejects.toBe(failure)
    await expect(
      coordinator.refresh('t'.repeat(43), 'correlation-id'),
    ).rejects.toBe(failure)
    expect(execute).toHaveBeenCalledTimes(1)
  })
})
