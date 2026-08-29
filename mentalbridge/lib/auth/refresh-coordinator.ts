import 'server-only'

import { createHash } from 'node:crypto'

import { ApiError } from '@/lib/api/api-error'
import type { TokenPair } from '@/features/auth/api/identity-contract'

import { identityClient } from './identity-client'

type RefreshExecutor = (
  refreshToken: string,
  idempotencyKey: string,
  correlationId: string,
) => Promise<TokenPair>

type RefreshEntry = Readonly<{
  expiresAt: number
  promise: Promise<TokenPair>
}>

type RefreshCoordinatorOptions = Readonly<{
  replayWindowMs?: number
  maxAttempts?: number
  now?: () => number
  createIdempotencyKey?: (refreshToken: string) => string
}>

function refreshTokenKey(refreshToken: string) {
  return createHash('sha256').update(refreshToken).digest('base64url')
}

function stableIdempotencyKey(refreshToken: string) {
  return `refresh-${refreshTokenKey(refreshToken)}`
}

function canRetry(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.code === 'IDENTITY_TIMEOUT' || error.code === 'IDENTITY_UNAVAILABLE')
  )
}

export class RefreshCoordinator {
  private readonly entries = new Map<string, RefreshEntry>()
  private readonly replayWindowMs: number
  private readonly maxAttempts: number
  private readonly now: () => number
  private readonly createIdempotencyKey: (refreshToken: string) => string

  constructor(
    private readonly executeRefresh: RefreshExecutor,
    options: RefreshCoordinatorOptions = {},
  ) {
    this.replayWindowMs = options.replayWindowMs ?? 5_000
    this.maxAttempts = options.maxAttempts ?? 2
    this.now = options.now ?? Date.now
    this.createIdempotencyKey =
      options.createIdempotencyKey ?? stableIdempotencyKey
  }

  refresh(refreshToken: string, correlationId: string) {
    const now = this.now()
    this.removeExpired(now)

    const key = refreshTokenKey(refreshToken)
    const existing = this.entries.get(key)

    if (existing && existing.expiresAt > now) return existing.promise

    const idempotencyKey = this.createIdempotencyKey(refreshToken)
    const promise = this.executeWithRetry(
      refreshToken,
      idempotencyKey,
      correlationId,
    )

    this.entries.set(key, {
      expiresAt: now + this.replayWindowMs,
      promise,
    })
    this.scheduleRemoval(key, promise)

    return promise
  }

  private async executeWithRetry(
    refreshToken: string,
    idempotencyKey: string,
    correlationId: string,
  ) {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await this.executeRefresh(
          refreshToken,
          idempotencyKey,
          correlationId,
        )
      } catch (error) {
        if (attempt === this.maxAttempts || !canRetry(error)) throw error
      }
    }

    throw new Error('Refresh attempts exhausted unexpectedly.')
  }

  private removeExpired(now: number) {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key)
    }
  }

  private scheduleRemoval(key: string, promise: Promise<TokenPair>) {
    const timeout = setTimeout(() => {
      if (this.entries.get(key)?.promise === promise) this.entries.delete(key)
    }, this.replayWindowMs)

    timeout.unref()
  }
}

export const refreshCoordinator = new RefreshCoordinator(
  (refreshToken, idempotencyKey, correlationId) =>
    identityClient.refresh(refreshToken, idempotencyKey, correlationId),
)
