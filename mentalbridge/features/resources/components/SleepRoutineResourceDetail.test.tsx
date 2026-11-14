import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PublicResourceDetail } from '../api/browser-resources'
import { SleepRoutineResourceDetail } from './SleepRoutineResourceDetail'

const mockResource = {
  id: '00000000-0000-4000-8000-000000000207',
  title: 'Chuẩn bị một nhịp ngủ dễ chịu hơn',
  category: 'VIDEO',
  interactionType: 'VIDEO_TRANSCRIPT',
  summary:
    'Phương pháp tiếp cận hành vi không dùng thuốc. Xem video ngắn, điều chỉnh nhịp sinh học và hoàn thành 3 bước nhỏ trước khi tắt đèn.',
  contentBody: 'Nội dung chi tiết...',
  contentVersion: '2026.10',
  repeatability: 'REPEATABLE',
  status: 'PUBLISHED',
  resourceKind: 'EXERCISE',
  durationMinutes: 12,
  difficulty: 'EASY',
  publishedAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
} as unknown as PublicResourceDetail

describe('SleepRoutineResourceDetail', () => {
  beforeEach(() => {
    window.HTMLMediaElement.prototype.play = vi
      .fn()
      .mockImplementation(() => Promise.resolve())
    window.HTMLMediaElement.prototype.pause = vi.fn()
  })

  it('renders title, micro-practice badge, and routine steps properly', () => {
    const onConfirmCompletion = vi.fn().mockResolvedValue(true)
    render(
      <SleepRoutineResourceDetail
        resource={mockResource}
        backHref="/support-plan"
        status="IN_PROGRESS"
        progressLoadState="ready"
        saving={false}
        message=""
        onConfirmCompletion={onConfirmCompletion}
      />,
    )

    expect(
      screen.getByRole('heading', {
        name: /Chuẩn bị một nhịp ngủ dễ chịu hơn/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Micro-practice/i)).toBeInTheDocument()
    expect(screen.getByText(/Nhịp sinh học 30 phút/i)).toBeInTheDocument()
    expect(screen.getByText(/22:30 • Tắt màn hình xanh/i)).toBeInTheDocument()
    expect(screen.getByText(/22:40 • Trút bỏ lo âu/i)).toBeInTheDocument()
    expect(screen.getByText(/22:50 • Hạ nhịp thở sâu/i)).toBeInTheDocument()
  })

  it('updates progress count and checks items when checklist is toggled', () => {
    const onConfirmCompletion = vi.fn().mockResolvedValue(true)
    render(
      <SleepRoutineResourceDetail
        resource={mockResource}
        backHref="/support-plan"
        status="IN_PROGRESS"
        progressLoadState="ready"
        saving={false}
        message=""
        onConfirmCompletion={onConfirmCompletion}
      />,
    )

    expect(screen.getByText('0/3 hoàn thành')).toBeInTheDocument()

    const step1 = screen.getByText(/Tối ưu phòng ngủ/i)
    fireEvent.click(step1)

    expect(screen.getByText('1/3 hoàn thành')).toBeInTheDocument()
  })

  it('calls onConfirmCompletion when mark complete button is clicked', async () => {
    const onConfirmCompletion = vi.fn().mockResolvedValue(true)
    render(
      <SleepRoutineResourceDetail
        resource={mockResource}
        backHref="/support-plan"
        status="IN_PROGRESS"
        progressLoadState="ready"
        saving={false}
        message=""
        onConfirmCompletion={onConfirmCompletion}
      />,
    )

    const completeBtn = screen.getByRole('button', {
      name: /Đánh dấu hoàn thành/i,
    })
    fireEvent.click(completeBtn)

    expect(onConfirmCompletion).toHaveBeenCalledTimes(1)
  })

  it('renders step tracker bar and allows jumping between steps', async () => {
    const onConfirmCompletion = vi.fn().mockResolvedValue(true)
    render(
      <SleepRoutineResourceDetail
        resource={mockResource}
        backHref="/support-plan"
        status="IN_PROGRESS"
        progressLoadState="ready"
        saving={false}
        message=""
        onConfirmCompletion={onConfirmCompletion}
      />,
    )

    expect(
      screen.getByText(/Thanh tiến trình 3 bước nhịp ngủ/i),
    ).toBeInTheDocument()

    const step1Btn = screen.getByRole('button', {
      name: /Chuyển đến Bước 1/i,
    })
    const step2Btn = screen.getByRole('button', {
      name: /Chuyển đến Bước 2/i,
    })
    const step3Btn = screen.getByRole('button', {
      name: /Chuyển đến Bước 3/i,
    })

    expect(step1Btn).toBeInTheDocument()
    expect(step2Btn).toBeInTheDocument()
    expect(step3Btn).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(step2Btn)
    })
  })
})
