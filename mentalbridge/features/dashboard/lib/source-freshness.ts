import type { DataState } from '@/features/dashboard/types/admin-operations'

export interface FreshnessPolicyOptions {
  /** Maximum allowable age in milliseconds before a source is classified as STALE. Default 300_000ms (5 mins). */
  maxAgeMs?: number
  /** Clock-skew tolerance in milliseconds for future timestamps. Default 60_000ms (1 min). */
  maxClockSkewMs?: number
  /** Reference server time in ISO string or ms epoch. Default Date.now(). */
  now?: number | Date | string
}

export const DEFAULT_SOURCE_MAX_AGE_MS: Record<string, number> = {
  IDENTITY: 300_000, // 5 minutes: account aggregate projection
  CONSULTATION: 300_000, // 5 minutes: appointments and specialist review projection
  CONTENT_NOTIFICATION: 300_000, // 5 minutes: notification delivery and reminder queue projection
  COMMUNITY: 300_000, // 5 minutes: moderation incident projection
}

export const DEFAULT_MAX_CLOCK_SKEW_MS = 60_000 // 1 minute allowed future drift

/**
 * Evaluates whether a source's reported `asOf` timestamp is fresh (AVAILABLE) or expired (STALE).
 *
 * Rules:
 * - Missing, blank, or unparseable timestamps fail-closed to STALE (cannot be assumed fresh).
 * - Future timestamps beyond acceptable clock-skew tolerance fail-closed to STALE.
 * - Age <= maxAgeMs -> AVAILABLE.
 * - Age > maxAgeMs -> STALE.
 *
 * @param asOf ISO timestamp string provided by the upstream owner source.
 * @param source Identifier of the upstream source (IDENTITY, CONSULTATION, etc.).
 * @param options Freshness policy overrides.
 */
export function evaluateSourceFreshness(
  asOf: string | null | undefined,
  source: string,
  options: FreshnessPolicyOptions = {},
): { status: DataState; ageMs: number | null; rationale?: string } {
  const referenceTime =
    options.now !== undefined
      ? typeof options.now === 'number'
        ? options.now
        : new Date(options.now).getTime()
      : Date.now()

  if (!asOf || typeof asOf !== 'string' || asOf.trim() === '') {
    return {
      status: 'STALE',
      ageMs: null,
      rationale: `Source ${source} provided missing or empty asOf timestamp. Classified STALE fail-closed.`,
    }
  }

  const parsed = Date.parse(asOf)
  if (Number.isNaN(parsed)) {
    return {
      status: 'STALE',
      ageMs: null,
      rationale: `Source ${source} provided invalid unparseable asOf timestamp ('${asOf}'). Classified STALE fail-closed.`,
    }
  }

  const maxClockSkewMs = options.maxClockSkewMs ?? DEFAULT_MAX_CLOCK_SKEW_MS
  const deltaMs = referenceTime - parsed

  // If timestamp is in the future beyond acceptable clock-skew tolerance:
  if (deltaMs < -maxClockSkewMs) {
    return {
      status: 'STALE',
      ageMs: deltaMs,
      rationale: `Source ${source} timestamp is implausibly in the future (${Math.abs(deltaMs)}ms ahead of BFF clock). Classified STALE fail-closed.`,
    }
  }

  // Treat acceptable small future drift within tolerance as age 0
  const ageMs = Math.max(0, deltaMs)

  const defaultMaxAge = DEFAULT_SOURCE_MAX_AGE_MS[source] ?? 300_000
  const envKey = `OPERATIONS_DASHBOARD_${source}_MAX_AGE_MS`
  const envVal =
    typeof process !== 'undefined' && process.env
      ? process.env[envKey]
      : undefined
  const parsedEnv = envVal ? Number(envVal) : NaN
  const configuredMaxAge =
    !Number.isNaN(parsedEnv) && parsedEnv > 0 ? parsedEnv : defaultMaxAge

  const maxAgeMs = options.maxAgeMs ?? configuredMaxAge

  if (ageMs > maxAgeMs) {
    return {
      status: 'STALE',
      ageMs,
      rationale: `Source ${source} asOf (${asOf}) age ${ageMs}ms exceeds max-age threshold of ${maxAgeMs}ms. Classified STALE.`,
    }
  }

  return {
    status: 'AVAILABLE',
    ageMs,
  }
}
