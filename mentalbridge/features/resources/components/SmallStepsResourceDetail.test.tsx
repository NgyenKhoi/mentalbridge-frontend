import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SmallStepsResourceDetail } from './SmallStepsResourceDetail'
import type { PublicResourceDetail } from '../api/browser-resources'

const mockResource = {
  id: '00000000-0000-4000-8000-000000000208',
  title: 'Bắt đầu bằng một hoạt động nhỏ',
  category: 'ARTICLE',
  difficulty: 'GENTLE',
  durationMinutes: 3,
  summary: 'Chia việc thành bước nhỏ để dễ bắt đầu, tăng cảm giác hoàn thành.',
  contentBody: 'Nội dung chi tiết...',
  author: 'MentalBridge Care',
  sourceUrl: null,
  tags: ['khoi-dong', 'hoat-dong-nho'],
  learningOutcomes: [],
  interactionType: 'BEHAVIORAL_ACTIVATION_PLANNER',
} as unknown as PublicResourceDetail

describe('SmallStepsResourceDetail', () => {
  it('renders studio badge, main title, quote and recommended duration', () => {
    render(<SmallStepsResourceDetail resource={mockResource} />)

    expect(screen.getByText('Studio Vi Mô Thực Hành')).toBeInTheDocument()
    expect(screen.getByText('Bắt đầu bằng một cử chỉ thật nhỏ.')).toBeInTheDocument()
    expect(screen.getByText(/Hôm nay chỉ cần 3 phút/i)).toBeInTheDocument()
    expect(screen.getByText('3 Phút Nhẹ Nhàng')).toBeInTheDocument()
  })

  it('renders audio player with Thuy Dung narrator and 432Hz subtitle', () => {
    render(<SmallStepsResourceDetail resource={mockResource} />)

    expect(screen.getByText('Giọng dẫn thiền • Chuyên viên Thuỳ Dung')).toBeInTheDocument()
    expect(screen.getByText('Tần số nhẹ 432Hz hạ áp lực hệ thần kinh')).toBeInTheDocument()
    expect(screen.getAllByText('03:12').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Audiobook • Giọng trầm ấm')).toBeInTheDocument()
  })

  it('renders 3 micro action choices and switches active action on click', () => {
    render(<SmallStepsResourceDetail resource={mockResource} />)

    const windowBtn = screen.getByRole('button', { name: /Mở cửa sổ đón gió/i })
    const waterBtn = screen.getByRole('button', { name: /Uống một ngụm nước ấm/i })
    const melodyBtn = screen.getByRole('button', { name: /Nghe một giai điệu dịu/i })

    expect(windowBtn).toBeInTheDocument()
    expect(waterBtn).toBeInTheDocument()
    expect(melodyBtn).toBeInTheDocument()

    // Click Uống một ngụm nước ấm
    fireEvent.click(waterBtn)

    // Hero title updates
    expect(screen.getByRole('heading', { level: 2, name: /UỐNG MỘT NGỤM NƯỚC ẤM/i })).toBeInTheDocument()

    // Timer updates
    expect(screen.getByText(/Thực hành:/i)).toHaveTextContent('Uống một ngụm nước ấm')
  })

  it('renders mindful timer and psychological reading insights', () => {
    const handleConfirm = vi.fn().mockResolvedValue(true)
    render(<SmallStepsResourceDetail resource={mockResource} onConfirmCompletion={handleConfirm} />)

    expect(screen.getByText('MINDFUL TIMER')).toBeInTheDocument()
    expect(screen.getByText('03:00')).toBeInTheDocument()
    expect(screen.getByText('Cơ chế tâm lý của một bước nhỏ')).toBeInTheDocument()

    // Click hoàn thành ngay
    const completeBtn = screen.getByRole('button', { name: /Hoàn thành ngay/i })
    fireEvent.click(completeBtn)

    expect(handleConfirm).toHaveBeenCalled()
  })
})
