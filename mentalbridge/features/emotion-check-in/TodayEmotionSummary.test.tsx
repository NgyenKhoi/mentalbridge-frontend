import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import type { Emotion, EmotionCheckIn } from '@/lib/emotion-check-in/contract'
import { emotionPresentation } from '@/lib/emotion-check-in/presentation'
import { getEmotionCheckIn } from './api/browser-emotion-check-in'
import { TodayEmotionSummary } from './TodayEmotionSummary'

vi.mock('./api/browser-emotion-check-in', () => ({
  getEmotionCheckIn: vi.fn(),
}))

const get = vi.mocked(getEmotionCheckIn)

function record(emotion: Emotion): EmotionCheckIn {
  return {
    id: '40000000-0000-4000-8000-000000000001',
    localDate: '2026-09-26',
    timezone: 'Asia/Ho_Chi_Minh',
    emotion,
    intensity: 4,
    factors: [],
    note: null,
    sourceLabel: 'SELF_REPORTED_EMOTION',
    clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
    revision: 1,
    recordedAt: '2026-09-26T02:00:00.000Z',
    createdAt: '2026-09-26T02:00:00.000Z',
    updatedAt: '2026-09-26T02:00:00.000Z',
  }
}

describe('TodayEmotionSummary', () => {
  beforeEach(() => get.mockReset())

  for (const emotion of Object.keys(emotionPresentation) as Emotion[]) {
    it(`renders the canonical ${emotion} presentation with exact source metadata`, async () => {
      get.mockResolvedValue(record(emotion))
      render(<TodayEmotionSummary />)

      expect(
        await screen.findByText(emotionPresentation[emotion].label),
      ).toBeVisible()
      expect(screen.getByText('Mức cảm nhận 4/5')).toBeVisible()
      expect(
        screen.getByText('26/09/2026 · Múi giờ Asia/Ho_Chi_Minh'),
      ).toBeVisible()
    })
  }

  it('distinguishes an absent day from an unavailable source and retries', async () => {
    get
      .mockRejectedValueOnce(
        new ApiError({ message: 'offline', code: 'UNAVAILABLE', status: 503 }),
      )
      .mockRejectedValueOnce(
        new ApiError({ message: 'absent', code: 'NOT_FOUND', status: 404 }),
      )
    render(<TodayEmotionSummary />)

    expect(
      await screen.findByText('Chưa thể xác nhận ghi nhận hôm nay.'),
    ).toBeVisible()
    expect(
      screen.queryByText('Hôm nay chưa có ghi nhận cảm xúc.'),
    ).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(
      await screen.findByText('Hôm nay chưa có ghi nhận cảm xúc.'),
    ).toBeVisible()
  })

  it('reloads when the authoritative record changes elsewhere', async () => {
    get
      .mockResolvedValueOnce(record('GOOD'))
      .mockResolvedValueOnce(record('LOW'))
    render(<TodayEmotionSummary />)
    expect(await screen.findByText('Tốt')).toBeVisible()

    act(() => {
      window.dispatchEvent(new CustomEvent('mb:emotion-check-in-updated'))
    })

    expect(await screen.findByText('Không tốt')).toBeVisible()
  })
})
