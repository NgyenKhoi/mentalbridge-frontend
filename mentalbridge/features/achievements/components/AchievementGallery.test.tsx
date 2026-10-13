import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AchievementCollection } from '../api/browser-achievements'
import AchievementGallery from './AchievementGallery'

const api = vi.hoisted(() => ({
  getAchievements: vi.fn(),
  setAchievementVisibility: vi.fn(),
}))

vi.mock('../api/browser-achievements', () => api)

function collection(
  visibilityState: 'VISIBLE' | 'HIDDEN' = 'VISIBLE',
): AchievementCollection {
  const definition = (
    definitionId: string,
    domain: 'JOURNAL' | 'EMOTION_CHECK_IN' | 'RESOURCE',
    status: 'EARNED' | 'UNEARNED' | 'SOURCE_UNAVAILABLE',
  ) => ({
    definitionId,
    domain,
    kind: definitionId.includes('first')
      ? ('MILESTONE' as const)
      : ('CONSISTENCY' as const),
    tier: definitionId.includes('first')
      ? ('FIRST_STEP' as const)
      : ('STEADY_STEP' as const),
    title: definitionId,
    description: 'Mô tả dữ liệu đã lưu.',
    status,
    evidenceClass: 'OWNER_SOURCE_FACT' as const,
    unlockedAt: status === 'EARNED' ? '2026-10-12T05:00:00.000Z' : null,
    ruleVersion: 'achievement-rules-v1' as const,
    privacy: 'PRIVATE' as const,
    progress:
      status === 'SOURCE_UNAVAILABLE'
        ? null
        : {
            current: status === 'EARNED' ? 1 : 0,
            target: 1,
            unit: 'EVENT' as const,
          },
  })
  return {
    visibilityState,
    preferenceVersion: visibilityState === 'VISIBLE' ? '0' : '1',
    policyVersion: 'achievement-rules-v1',
    calculatedAt: '2026-10-13T05:00:00.000Z',
    sources: [
      {
        domain: 'JOURNAL',
        availability: 'AVAILABLE',
        asOfLocalDate: '2026-10-13',
      },
      {
        domain: 'EMOTION_CHECK_IN',
        availability: 'UNAVAILABLE',
        asOfLocalDate: null,
      },
      { domain: 'RESOURCE', availability: 'AVAILABLE', asOfLocalDate: null },
      { domain: 'JOURNEY', availability: 'DEFERRED', asOfLocalDate: null },
    ],
    items: [
      definition('journal.first-entry', 'JOURNAL', 'EARNED'),
      definition('journal.streak-3-days', 'JOURNAL', 'EARNED'),
      definition('journal.streak-7-days', 'JOURNAL', 'UNEARNED'),
      definition(
        'emotion.first-check-in',
        'EMOTION_CHECK_IN',
        'SOURCE_UNAVAILABLE',
      ),
      definition(
        'emotion.streak-3-days',
        'EMOTION_CHECK_IN',
        'SOURCE_UNAVAILABLE',
      ),
      definition(
        'emotion.streak-7-days',
        'EMOTION_CHECK_IN',
        'SOURCE_UNAVAILABLE',
      ),
      definition('resource.first-completion', 'RESOURCE', 'EARNED'),
      definition('resource.variety-3', 'RESOURCE', 'UNEARNED'),
      definition('resource.practice-3-days', 'RESOURCE', 'EARNED'),
      definition('resource.practice-7-days', 'RESOURCE', 'UNEARNED'),
      {
        definitionId: 'journey.new-chapter',
        domain: 'JOURNEY',
        kind: 'JOURNEY',
        tier: 'JOURNEY',
        title: 'Một chương mới',
        description: 'Chỉ mở sau xác nhận chủ động.',
        status: 'DEFERRED',
        evidenceClass: 'USER_CONFIRMED_JOURNEY',
        unlockedAt: null,
        ruleVersion: 'achievement-rules-v1',
        privacy: 'PRIVATE',
        progress: null,
      },
    ],
  }
}

describe('AchievementGallery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getAchievements.mockResolvedValue({
      collection: collection(),
      etag: '"0"',
    })
  })

  it('renders factual earned, unavailable, and deferred states without clinical claims', async () => {
    render(<AchievementGallery />)
    expect(
      await screen.findByRole('heading', { name: 'Bộ sưu tập hành trình' }),
    ).toBeVisible()
    expect(screen.getByLabelText('4 dấu mốc đã ghi nhận')).toBeVisible()
    const emotion = screen
      .getByRole('heading', { name: 'Check-in cảm xúc' })
      .closest('section')
    expect(emotion).not.toBeNull()
    expect(within(emotion!).getAllByText('Chưa thể xác minh')).toHaveLength(3)
    expect(
      screen.getByRole('heading', { name: 'Một chương mới' }),
    ).toBeVisible()
    expect(screen.getByText('Chưa mở trong phiên bản này')).toBeVisible()
    expect(screen.getByText(/PHQ-9\/GAD-7/)).toBeVisible()
    expect(
      screen.queryByText(/điểm điều trị|đã hồi phục|hạng nhất/i),
    ).not.toBeInTheDocument()
  })

  it('retries unavailable sources and never renders stale source progress', async () => {
    const user = userEvent.setup()
    render(<AchievementGallery />)
    const retry = await screen.findByRole('button', { name: 'Thử lại kết nối' })
    expect(screen.queryByText(/0\/1.*cảm xúc/i)).not.toBeInTheDocument()
    await user.click(retry)
    expect(api.getAchievements).toHaveBeenCalledTimes(2)
  })

  it('hides and restores the gallery without changing source access', async () => {
    const user = userEvent.setup()
    api.setAchievementVisibility.mockResolvedValue({
      collection: collection('HIDDEN'),
      etag: '"1"',
    })
    render(<AchievementGallery />)
    const toggle = await screen.findByRole('switch', {
      name: 'Hiện bộ sưu tập',
    })
    await user.click(toggle)
    expect(api.setAchievementVisibility).toHaveBeenCalledWith(
      expect.any(String),
      'HIDDEN',
      '"0"',
    )
    expect(
      await screen.findByRole('heading', { name: 'Bộ sưu tập đang được ẩn' }),
    ).toBeVisible()
    expect(screen.getByText(/không ảnh hưởng đến Nhật ký/)).toBeVisible()
  })
})
