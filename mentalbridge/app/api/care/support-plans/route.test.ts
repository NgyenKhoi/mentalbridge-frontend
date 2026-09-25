import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({
  currentScreeningEpisode: vi.fn(),
  history: vi.fn(),
  evaluateSupportV2: vi.fn(),
  proposeSupportPlanDraft: vi.fn(),
  currentSupportPlanDraft: vi.fn(),
}))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/care/care-client', () => ({ careClient: careMocks }))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET, POST } from './route'

const phq9 = '10000000-0000-4000-8000-000000000372'
const gad7 = '20000000-0000-4000-8000-000000000372'
const evaluationId = '30000000-0000-4000-8000-000000000372'

function request(method: 'GET' | 'POST', purpose?: string) {
  const cookies = [`${ACCESS_COOKIE_NAME}=identity-access-secret`]
  const query = purpose ? `?purpose=${purpose}` : ''
  return new NextRequest(`http://localhost/api/care/support-plans${query}`, {
    method,
    headers: {
      cookie: cookies.join('; '),
      ...(method === 'POST'
        ? { 'idempotency-key': 'support-plan-browser-0372' }
        : {}),
    },
  })
}

describe('/api/care/support-plans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '40000000-0000-4000-8000-000000000372',
        status: 'ACTIVE',
        roles: ['USER'],
        emailVerified: true,
      },
    })
    careMocks.currentScreeningEpisode.mockResolvedValue({
      status: 'COMPLETED',
      phq9AssessmentId: phq9,
      gad7AssessmentId: gad7,
      supportEvaluationId: evaluationId,
    })
    careMocks.history.mockResolvedValue({ items: [], nextCursor: null, hasMore: false })
  })

  it('proposes from the evaluation persisted by the completed episode', async () => {
    careMocks.proposeSupportPlanDraft.mockResolvedValue({ supportPlanId: '50000000-0000-4000-8000-000000000372' })
    const response = await POST(request('POST'))
    expect(response.status).toBe(201)
    expect(careMocks.currentScreeningEpisode).toHaveBeenCalledWith('identity-access-secret', 'INITIAL_CHECK', expect.any(String))
    expect(careMocks.history).not.toHaveBeenCalled()
    expect(careMocks.proposeSupportPlanDraft).toHaveBeenCalledWith('identity-access-secret', { sourceSupportEvaluationId: evaluationId }, 'support-plan-browser-0372', expect.any(String))
  })

  it('uses the completed reassessment episode for a replacement draft', async () => {
    careMocks.proposeSupportPlanDraft.mockResolvedValue({ supportPlanId: '50000000-0000-4000-8000-000000000373' })
    const response = await POST(request('POST', 'REASSESSMENT'))
    expect(response.status).toBe(201)
    expect(careMocks.currentScreeningEpisode).toHaveBeenCalledWith('identity-access-secret', 'REASSESSMENT', expect.any(String))
    expect(careMocks.history).not.toHaveBeenCalled()
  })

  it('reuses completed PHQ-9 and GAD-7 history when no initial-check episode is complete', async () => {
    careMocks.currentScreeningEpisode.mockResolvedValue({ status: 'IN_PROGRESS', supportEvaluationId: null })
    careMocks.history.mockResolvedValue({
      items: [
        { assessmentId: gad7, instrument: 'GAD7' },
        { assessmentId: phq9, instrument: 'PHQ9' },
      ],
      nextCursor: null,
      hasMore: false,
    })
    careMocks.evaluateSupportV2.mockResolvedValue({ supportEvaluationId: evaluationId })
    careMocks.proposeSupportPlanDraft.mockResolvedValue({ supportPlanId: '50000000-0000-4000-8000-000000000372' })
    const response = await POST(request('POST'))
    expect(response.status).toBe(201)
    expect(careMocks.history).toHaveBeenCalledWith('identity-access-secret', undefined, 50, expect.any(String))
    expect(careMocks.evaluateSupportV2).toHaveBeenCalledWith(
      'identity-access-secret',
      { phq9AssessmentId: phq9, gad7AssessmentId: gad7 },
      `support-plan-evaluation:${phq9}:${gad7}`,
      expect.any(String),
    )
    expect(careMocks.proposeSupportPlanDraft).toHaveBeenCalledWith('identity-access-secret', { sourceSupportEvaluationId: evaluationId }, 'support-plan-browser-0372', expect.any(String))
  })

  it('fails closed when history is missing either required instrument', async () => {
    careMocks.currentScreeningEpisode.mockResolvedValue({ status: 'IN_PROGRESS', supportEvaluationId: null })
    careMocks.history.mockResolvedValue({ items: [{ assessmentId: gad7, instrument: 'GAD7' }], nextCursor: null, hasMore: false })
    const response = await POST(request('POST'))
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'INITIAL_CHECK_INCOMPLETE',
      title: 'Cần có kết quả PHQ-9 và GAD-7 đã hoàn tất trước khi tạo kế hoạch hỗ trợ.',
    })
    expect(careMocks.evaluateSupportV2).not.toHaveBeenCalled()
    expect(careMocks.proposeSupportPlanDraft).not.toHaveBeenCalled()
  })

  it('keeps reassessment bound to one completed screening episode', async () => {
    careMocks.currentScreeningEpisode.mockResolvedValue({ status: 'IN_PROGRESS', supportEvaluationId: null })
    const response = await POST(request('POST', 'REASSESSMENT'))
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'REASSESSMENT_INCOMPLETE',
      title: 'Cần hoàn tất PHQ-9 và GAD-7 trong cùng lượt đánh giá lại trước khi tạo kế hoạch thay thế.',
    })
    expect(careMocks.history).not.toHaveBeenCalled()
    expect(careMocks.proposeSupportPlanDraft).not.toHaveBeenCalled()
  })

  it('reloads the persisted current draft without creating dependencies', async () => {
    careMocks.currentSupportPlanDraft.mockResolvedValue({ supportPlanId: '50000000-0000-4000-8000-000000000372' })
    const response = await GET(request('GET'))
    expect(response.status).toBe(200)
    expect(careMocks.currentSupportPlanDraft).toHaveBeenCalledWith('identity-access-secret', expect.any(String))
    expect(careMocks.currentScreeningEpisode).not.toHaveBeenCalled()
    expect(careMocks.proposeSupportPlanDraft).not.toHaveBeenCalled()
  })
})
