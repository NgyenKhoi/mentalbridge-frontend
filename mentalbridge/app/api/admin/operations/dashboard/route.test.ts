import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  authenticate: vi.fn(),
  authenticationFailure: vi.fn(),
  carrySession: vi.fn(),
}))

const identity = vi.hoisted(() => ({
  getAccountsSummary: vi.fn(),
}))

const consultation = vi.hoisted(() => ({
  getOperationsSummary: vi.fn(),
}))

const contentAdmin = vi.hoisted(() => ({
  getNotificationOperationsSummary: vi.fn(),
}))

const community = vi.hoisted(() => ({
  moderationCases: vi.fn(),
  operationsSummary: vi.fn(),
}))

vi.mock('@/lib/consultation/authenticated-actor', () => ({
  authenticatedConsultationActor: auth.authenticate,
  consultationAuthenticationFailure: auth.authenticationFailure,
  carryConsultationSession: auth.carrySession,
}))

vi.mock('@/lib/auth/identity-client', () => ({
  identityClient: identity,
}))

vi.mock('@/lib/consultation/consultation-client', () => ({
  consultationClient: consultation,
}))

vi.mock('@/lib/content/content-client', () => ({
  contentAdminClient: contentAdmin,
}))

vi.mock('@/lib/community/community-client', () => ({
  communityClient: community,
}))

import { GET } from './route'

function request() {
  return new NextRequest('http://localhost/api/admin/operations/dashboard')
}

describe('GET /api/admin/operations/dashboard BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.authenticate.mockResolvedValue({
      accessToken: 'admin-access-token',
      rotatedTokens: undefined,
    })
    auth.carrySession.mockImplementation((res: NextResponse) => res)
    auth.authenticationFailure.mockImplementation((error: unknown) => {
      const status =
        typeof error === 'object' && error && 'status' in error
          ? (error as { status: number }).status
          : 401
      return NextResponse.json({ code: 'UNAUTHORIZED' }, { status })
    })

    const freshAsOf = new Date().toISOString()

    identity.getAccountsSummary.mockResolvedValue({
      source: 'IDENTITY',
      asOf: freshAsOf,
      totalAccounts: 120,
      activeAccounts: 100,
      pendingVerificationAccounts: 15,
      disabledAccounts: 5,
      deletionPendingAccounts: 0,
      byRole: {
        users: 95,
        specialists: 20,
        admins: 5,
      },
    })

    consultation.getOperationsSummary.mockResolvedValue({
      source: 'CONSULTATION',
      asOf: freshAsOf,
      specialists: {
        total: 20,
        pendingReview: 3,
        active: 15,
        rejected: 1,
        suspended: 1,
      },
      appointments: {
        total: 50,
        requested: 5,
        confirmed: 20,
        inProgress: 5,
        sessionEnded: 2,
        completed: 15,
        cancelled: 2,
        rejected: 1,
        expired: 0,
        userNoShow: 0,
        specialistNoShow: 0,
        bothNoShow: 0,
      },
    })

    contentAdmin.getNotificationOperationsSummary.mockResolvedValue({
      source: 'CONTENT_NOTIFICATION',
      asOf: freshAsOf,
      inApp: {
        total: 200,
        delivered: 180,
        pending: 10,
        failed: 5,
        cancelled: 5,
        unread: 60,
        read: 120,
      },
      emailReminders: {
        total: 80,
        pending: 5,
        processing: 2,
        delivered: 70,
        failed: 1,
        suppressed: 1,
        invalidated: 1,
      },
    })

    community.operationsSummary.mockResolvedValue({
      source: 'COMMUNITY',
      asOf: freshAsOf,
      openModerationCases: 2,
      totalModerationCases: 10,
    })
  })

  it('fails closed when authentication fails (401)', async () => {
    auth.authenticate.mockRejectedValueOnce(new Error('no session'))
    auth.authenticationFailure.mockReturnValueOnce(
      NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 }),
    )

    const response = await GET(request())
    expect(response.status).toBe(401)
  })

  it('fails closed when actor is not ADMIN (403)', async () => {
    auth.authenticate.mockRejectedValueOnce({ status: 403, code: 'FORBIDDEN' })
    auth.authenticationFailure.mockReturnValueOnce(
      NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 }),
    )

    const response = await GET(request())
    expect(response.status).toBe(403)
  })

  it('returns 200 with all available authoritative blocks and provenance metadata', async () => {
    const response = await GET(request())
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload.identity.status).toBe('AVAILABLE')
    expect(payload.identity.source).toBe('IDENTITY')
    expect(payload.identity.data.total).toBe(120)

    expect(payload.consultation.status).toBe('AVAILABLE')
    expect(payload.consultation.source).toBe('CONSULTATION')
    expect(payload.consultation.data.specialists.active).toBe(15)

    expect(payload.notifications.status).toBe('AVAILABLE')
    expect(payload.notifications.source).toBe('CONTENT_NOTIFICATION')

    expect(payload.community.status).toBe('AVAILABLE')
    expect(payload.community.source).toBe('COMMUNITY')
    expect(payload.community.asOf).toBeTruthy()
    expect(payload.community.data.openModerationCases).toBe(2)
    expect(payload.community.data.totalModerationCases).toBe(10)

    expect(payload.unintegrated.length).toBeGreaterThan(0)
    for (const item of payload.unintegrated) {
      expect(item.status).toBe('UNAVAILABLE')
      expect(item.rationale).toBeTruthy()
    }

    const unintegratedById = Object.fromEntries(
      payload.unintegrated.map((item: { id: string }) => [item.id, item]),
    )
    expect(unintegratedById['uptime-sla'].status).toBe('UNAVAILABLE')
    expect(unintegratedById['platform-security-score'].status).toBe(
      'UNAVAILABLE',
    )
    expect(unintegratedById['platform-revenue'].status).toBe('UNAVAILABLE')

    const serializedPayload = JSON.stringify(payload)
    expect(serializedPayload).not.toContain('99.98')
    expect(serializedPayload).not.toContain('96/100')

    // Assert strictly aggregate facts - no sensitive fields exist
    expect(payload).not.toHaveProperty('journal')
    expect(payload).not.toHaveProperty('notes')
    expect(payload).not.toHaveProperty('chatBody')
    expect(payload).not.toHaveProperty('password')
  })

  it('evaluates a source timestamp against the time after downstream requests settle', async () => {
    const identitySummary = await identity.getAccountsSummary()
    let currentEpoch = Date.now()
    const startEpoch = currentEpoch
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => currentEpoch)

    try {
      identity.getAccountsSummary.mockImplementationOnce(async () => {
        currentEpoch = startEpoch + 120_000
        return {
          ...identitySummary,
          asOf: new Date(currentEpoch).toISOString(),
        }
      })

      const response = await GET(request())
      const payload = await response.json()

      expect(payload.identity.status).toBe('AVAILABLE')
      expect(payload.identity.asOf).toBe(new Date(currentEpoch).toISOString())
      expect(payload.consultation.status).toBe('AVAILABLE')
      expect(payload.notifications.status).toBe('AVAILABLE')
      expect(payload.community.status).toBe('AVAILABLE')
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('gracefully degrades to UNAVAILABLE when a downstream service is down without demo fallback', async () => {
    consultation.getOperationsSummary.mockRejectedValueOnce(
      new Error('Connection refused'),
    )

    const response = await GET(request())
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload.consultation.status).toBe('UNAVAILABLE')
    expect(payload.consultation.data).toBeNull()
    expect(payload.consultation.error).toContain('unreachable')

    // Remaining services remain available
    expect(payload.identity.status).toBe('AVAILABLE')
    expect(payload.identity.data.total).toBe(120)
  })

  it('classifies upstream source as STALE when asOf is older than 5 minutes while preserving real data and provenance', async () => {
    const staleTime = new Date(Date.now() - 360_000).toISOString() // 6 minutes ago
    identity.getAccountsSummary.mockResolvedValueOnce({
      source: 'IDENTITY',
      asOf: staleTime,
      totalAccounts: 120,
      activeAccounts: 100,
      pendingVerificationAccounts: 15,
      disabledAccounts: 5,
      deletionPendingAccounts: 0,
      byRole: { users: 95, specialists: 20, admins: 5 },
    })

    const response = await GET(request())
    expect(response.status).toBe(200)

    const payload = await response.json()
    expect(payload.identity.status).toBe('STALE')
    expect(payload.identity.source).toBe('IDENTITY')
    expect(payload.identity.asOf).toBe(staleTime)
    expect(payload.identity.data).not.toBeNull()
    expect(payload.identity.data.total).toBe(120)
    expect(payload.identity.error).toContain('exceeds max-age threshold')

    // Other sources remain independently evaluated and AVAILABLE
    expect(payload.consultation.status).toBe('AVAILABLE')
    expect(payload.notifications.status).toBe('AVAILABLE')
    expect(payload.community.status).toBe('AVAILABLE')
  })

  it('classifies upstream source as STALE fail-closed when asOf is invalid, empty, or implausibly in future', async () => {
    // Consultation with empty string asOf
    consultation.getOperationsSummary.mockResolvedValueOnce({
      source: 'CONSULTATION',
      asOf: '',
      specialists: {
        total: 20,
        pendingReview: 3,
        active: 15,
        rejected: 1,
        suspended: 1,
      },
      appointments: {
        total: 50,
        requested: 5,
        confirmed: 20,
        inProgress: 5,
        sessionEnded: 2,
        completed: 15,
        cancelled: 2,
        rejected: 1,
        expired: 0,
        userNoShow: 0,
        specialistNoShow: 0,
        bothNoShow: 0,
      },
    })

    // Community with implausibly future asOf (> 60s skew tolerance)
    const futureTime = new Date(Date.now() + 120_000).toISOString()
    community.operationsSummary.mockResolvedValueOnce({
      source: 'COMMUNITY',
      asOf: futureTime,
      openModerationCases: 2,
      totalModerationCases: 10,
    })

    const response = await GET(request())
    expect(response.status).toBe(200)

    const payload = await response.json()

    // Consultation is STALE fail-closed but preserves data
    expect(payload.consultation.status).toBe('STALE')
    expect(payload.consultation.data.specialists.active).toBe(15)
    expect(payload.consultation.error).toContain('missing or empty asOf')

    // Community is STALE fail-closed due to clock skew drift but preserves data
    expect(payload.community.status).toBe('STALE')
    expect(payload.community.data.openModerationCases).toBe(2)
    expect(payload.community.error).toContain('implausibly in the future')

    // Identity remains AVAILABLE
    expect(payload.identity.status).toBe('AVAILABLE')
  })

  it('demonstrates recovery when a previously stale source returns a fresh timestamp', async () => {
    const staleTime = new Date(Date.now() - 400_000).toISOString()
    identity.getAccountsSummary.mockResolvedValueOnce({
      source: 'IDENTITY',
      asOf: staleTime,
      totalAccounts: 120,
      activeAccounts: 100,
      pendingVerificationAccounts: 15,
      disabledAccounts: 5,
      deletionPendingAccounts: 0,
      byRole: { users: 95, specialists: 20, admins: 5 },
    })

    // First call: STALE
    const firstResponse = await GET(request())
    const firstPayload = await firstResponse.json()
    expect(firstPayload.identity.status).toBe('STALE')

    // Second call: restored fresh timestamp
    const freshTime = new Date().toISOString()
    identity.getAccountsSummary.mockResolvedValueOnce({
      source: 'IDENTITY',
      asOf: freshTime,
      totalAccounts: 125,
      activeAccounts: 105,
      pendingVerificationAccounts: 15,
      disabledAccounts: 5,
      deletionPendingAccounts: 0,
      byRole: { users: 100, specialists: 20, admins: 5 },
    })

    const secondResponse = await GET(request())
    const secondPayload = await secondResponse.json()
    expect(secondPayload.identity.status).toBe('AVAILABLE')
    expect(secondPayload.identity.error).toBeNull()
    expect(secondPayload.identity.data.total).toBe(125)
  })
})
