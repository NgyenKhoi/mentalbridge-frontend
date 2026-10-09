import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { PublicResourceDetail } from '../api/browser-resources'
import { ProblemSolvingResourceDetail } from './ProblemSolvingResourceDetail'

const mockResource = {
  id: '00000000-0000-4000-8000-000000000209',
  title: 'Giải quyết một vấn đề theo từng bước',
  category: 'VIDEO',
  interactionType: 'VIDEO_TRANSCRIPT',
  summary:
    'Sắp xếp và phân tách vấn đề thành từng bước nhỏ có thể hành động để giảm cảm giác quá tải và lấy lại quyền kiểm soát.',
  contentBody: 'Nội dung chi tiết...',
  contentVersion: '2026.10',
  repeatability: 'REPEATABLE',
  status: 'PUBLISHED',
  resourceKind: 'LEARNING',
  durationMinutes: 6,
  difficulty: 'EASY',
  publishedAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
} as unknown as PublicResourceDetail

describe('ProblemSolvingResourceDetail', () => {
  it('renders breadcrumb, chips, roadmap steps, practice card and CBT tips', () => {
    const onRecord = vi.fn().mockResolvedValue(true)
    const onRetryProgress = vi.fn()

    render(
      <ProblemSolvingResourceDetail
        resource={mockResource}
        backHref="/resources"
        backLabel="Quay lại Tài nguyên"
        status="IN_PROGRESS"
        progressLoadState="ready"
        saving={false}
        message=""
        onRetryProgress={onRetryProgress}
        onRecord={onRecord}
      />,
    )

    // 1. Breadcrumb (single navigation, no duplicate "Quay lại Tài nguyên" button)
    expect(screen.getByRole('link', { name: 'Tài nguyên' })).toHaveAttribute(
      'href',
      '/resources',
    )
    expect(
      screen.getAllByText('Giải quyết một vấn đề theo từng bước').length,
    ).toBeGreaterThanOrEqual(2)
    expect(
      screen.getByRole('heading', {
        name: 'Giải quyết một vấn đề theo từng bước',
      }),
    ).toBeInTheDocument()

    // 2. Chips
    expect(screen.getByText('Video hướng dẫn')).toBeInTheDocument()
    expect(screen.getByText('Nhẹ nhàng')).toBeInTheDocument()
    expect(screen.getByText('Kỹ năng tư duy CBT')).toBeInTheDocument()

    // 3. Roadmap steps (5 CBT steps)
    expect(
      screen.getByRole('heading', {
        name: /Lộ trình 5 bước tư duy có hệ thống/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Gọi tên vấn đề')).toBeInTheDocument()
    expect(screen.getByText('Liệt kê phương án')).toBeInTheDocument()
    expect(screen.getByText('Đánh giá ưu & nhược')).toBeInTheDocument()
    expect(screen.getByText('Chọn 1 hành động')).toBeInTheDocument()
    expect(screen.getByText('Xem lại & ghi nhận')).toBeInTheDocument()

    // 4. Quick Practice Notepad
    expect(
      screen.getByRole('heading', {
        name: /Bảng thực hành nhanh: Hành động nhỏ hôm nay/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('+15 XP Tinh Thần')).toBeInTheDocument()
    const textarea = screen.getByRole('textbox', {
      name: /Nội dung thực hành giải quyết vấn đề/i,
    })
    expect(textarea).toBeInTheDocument()

    // Typing in practice textarea updates counter
    fireEvent.change(textarea, { target: { value: 'Vấn đề của tôi là...' } })
    expect(screen.getByText('20/500')).toBeInTheDocument()

    // 5. CBT Tips & PDF Card
    expect(
      screen.getByRole('heading', {
        name: /Gợi ý từ chuyên gia trị liệu CBT/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Biểu mẫu 5 bước (PDF)')).toBeInTheDocument()

    // 6. Footer Citation
    expect(
      screen.getByText(
        /Biên soạn theo tài liệu Problem Solving – NHS Every Mind Matters/i,
      ),
    ).toBeInTheDocument()

    // 7. Gate on recording button (disabled initially)
    const recordBtn = screen.getByRole('button', {
      name: /Ghi nhận vào Kế hoạch hỗ trợ/i,
    })
    expect(recordBtn).toBeDisabled()
    expect(
      screen.getByText(/Xem thêm 90% video để ghi nhận/i),
    ).toBeInTheDocument()
  })

  it('enables recording button and calls onRecord when status is already COMPLETED', async () => {
    const onRecord = vi.fn().mockResolvedValue(true)
    const onRetryProgress = vi.fn()

    render(
      <ProblemSolvingResourceDetail
        resource={mockResource}
        backHref="/resources"
        backLabel="Quay lại Tài nguyên"
        status="COMPLETED"
        progressLoadState="ready"
        saving={false}
        message=""
        onRetryProgress={onRetryProgress}
        onRecord={onRecord}
      />,
    )

    const recordBtn = screen.getByRole('button', {
      name: /Đã ghi nhận vào Kế hoạch hỗ trợ/i,
    })
    expect(recordBtn).toBeDisabled()
  })
})
