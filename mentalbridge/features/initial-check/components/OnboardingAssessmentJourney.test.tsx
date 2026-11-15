import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import OnboardingAssessmentJourney, {
  PHQ9_QUESTIONS,
  GAD7_QUESTIONS,
} from './OnboardingAssessmentJourney'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}))

const mockShowActionToast = vi.fn()
vi.mock('@/components/ui/FeedbackProvider', () => ({
  useFeedback: () => ({
    showActionToast: mockShowActionToast,
  }),
}))

vi.mock('@/features/assessment/api/browser-care', () => ({
  getCareProfile: vi.fn().mockResolvedValue({
    displayName: 'Minh Khôi',
    dateOfBirth: '1998-05-12',
    gender: 'MALE',
    version: 1,
  }),
  saveCareProfile: vi.fn().mockResolvedValue({
    displayName: 'Minh Khôi',
    dateOfBirth: '1998-01-01',
    gender: 'MALE',
    version: 2,
  }),
  getCurrentQuestionnaire: vi.fn().mockImplementation((instrument: string) =>
    Promise.resolve({
      definitionId: `${instrument.toLowerCase()}-def-1`,
      title: instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7',
      referencePeriodDays: 14,
      questions:
        instrument === 'PHQ9'
          ? PHQ9_QUESTIONS.map((q) => ({ questionId: q.id, prompt: q.prompt }))
          : GAD7_QUESTIONS.map((q) => ({ questionId: q.id, prompt: q.prompt })),
    }),
  ),
  getPrivacyDisclosure: vi.fn().mockResolvedValue({
    version: 'privacy-capstone-v3',
    title: 'Privacy Policy',
    content: 'Content',
  }),
  recordPrivacyDecision: vi.fn().mockResolvedValue({}),
  submitInitialCheckAssessment: vi.fn().mockResolvedValue({}),
  createInitialCheckEvaluation: vi.fn().mockResolvedValue({}),
  getInitialCheckState: vi.fn().mockResolvedValue({ phase: 'PHQ9' }),
}))

vi.mock('@/features/support-plan/api/browser-support-plan', () => ({
  proposeSupportPlanDraft: vi.fn().mockResolvedValue({
    supportPlanId: 'plan-123',
    version: 1,
  }),
  activateSupportPlan: vi.fn().mockResolvedValue({}),
  getCurrentSupportPlanDraft: vi.fn().mockResolvedValue(null),
}))

describe('OnboardingAssessmentJourney', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
  })

  it('renders Step 1 (Hoàn thiện hồ sơ) with profile inputs and priority goals', async () => {
    render(<OnboardingAssessmentJourney />)

    expect(
      await screen.findByText(
        'Chào mừng bạn đến với MentalBridge. Hãy hoàn thiện hồ sơ của bạn.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Tên gọi thân mật/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Năm sinh/i)).toBeInTheDocument()
    expect(screen.getByText('Cải thiện giấc ngủ')).toBeInTheDocument()
    expect(
      screen.getByText(/Lưu thông tin & Bắt đầu bài sàng lọc đầu tiên/i),
    ).toBeInTheDocument()
  })

  it('allows filling Step 1 and progressing to Step 2 (PHQ-9 & GAD-7)', async () => {
    render(<OnboardingAssessmentJourney />)

    const nameInput = await screen.findByLabelText(/Tên gọi thân mật/i)
    fireEvent.change(nameInput, { target: { value: 'Minh Khôi' } })

    const yearInput = screen.getByLabelText(/Năm sinh/i)
    fireEvent.change(yearInput, { target: { value: '1998' } })

    const submitBtn = screen.getByText(
      /Lưu thông tin & Bắt đầu bài sàng lọc đầu tiên/i,
    )
    fireEvent.click(submitBtn)

    expect(
      await screen.findByText('PHQ-9 — Sàng lọc triệu chứng'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Câu 1 \/ 9/i)).toBeInTheDocument()
  })

  it('allows answering PHQ-9 (9 questions) and transitioning smoothly to GAD-7 (7 questions)', async () => {
    render(<OnboardingAssessmentJourney />)

    // Move to step 2
    const submitStep1 = await screen.findByText(
      /Lưu thông tin & Bắt đầu bài sàng lọc đầu tiên/i,
    )
    fireEvent.click(submitStep1)

    expect(
      await screen.findByText('PHQ-9 — Sàng lọc triệu chứng'),
    ).toBeInTheDocument()

    // Answer all 9 questions of PHQ-9
    for (let i = 0; i < 9; i++) {
      expect(
        screen.getByText(new RegExp(`Câu ${i + 1} / 9`, 'i')),
      ).toBeInTheDocument()

      // Click option "Vài ngày"
      const optionLabel = screen.getByText('Vài ngày')
      fireEvent.click(optionLabel)

      if (i < 8) {
        const nextBtn = screen.getByText('Câu tiếp theo →')
        fireEvent.click(nextBtn)
      } else {
        // Last question of PHQ-9
        const saveAndNextBtn = screen.getByText(
          'Lưu PHQ-9 và tiếp tục sang GAD-7 →',
        )
        fireEvent.click(saveAndNextBtn)
      }
    }

    // Now should be on GAD-7
    expect(
      await screen.findByText('GAD-7 — Sàng lọc triệu chứng lo âu'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Câu 1 \/ 7/i)).toBeInTheDocument()

    // Verify user can go back to PHQ-9 if needed
    const prevBtn = screen.getByText('← Câu trước')
    fireEvent.click(prevBtn)
    expect(
      await screen.findByText('PHQ-9 — Sàng lọc triệu chứng'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Câu 9 \/ 9/i)).toBeInTheDocument()

    // Return to GAD-7
    const backToGad7Btn = screen.getByText('Lưu PHQ-9 và tiếp tục sang GAD-7 →')
    fireEvent.click(backToGad7Btn)
    expect(
      await screen.findByText('GAD-7 — Sàng lọc triệu chứng lo âu'),
    ).toBeInTheDocument()

    // Answer all 7 questions of GAD-7
    for (let j = 0; j < 7; j++) {
      expect(
        screen.getByText(new RegExp(`Câu ${j + 1} / 7`, 'i')),
      ).toBeInTheDocument()
      const optionLabel = screen.getByText('Vài ngày')
      fireEvent.click(optionLabel)

      if (j < 6) {
        const nextBtn = screen.getByText('Câu tiếp theo →')
        fireEvent.click(nextBtn)
      } else {
        const submitAllBtn = screen.getByText(
          'Nộp bài & Xem phân tích ý nghĩa kết quả →',
        )
        fireEvent.click(submitAllBtn)
      }
    }

    // Should now reach Step 3: Ý nghĩa kết quả with BOTH PHQ-9 and GAD-7
    expect(
      await screen.findByText(/Chuẩn thang đo quốc tế PHQ-9/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Chuẩn thang đo quốc tế GAD-7/i),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Ý nghĩa lâm sàng (Clinical Meaning)'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Cơ chế giao cảm cảnh giác cao'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Tạo gợi ý kế hoạch hỗ trợ cá nhân hóa ngay/i),
    ).toBeInTheDocument()
  })

  it('advances from Step 3 to Step 4 and navigates to Dashboard', async () => {
    render(<OnboardingAssessmentJourney />)

    // Complete Step 1
    const submitStep1 = await screen.findByText(
      /Lưu thông tin & Bắt đầu bài sàng lọc đầu tiên/i,
    )
    fireEvent.click(submitStep1)

    // Complete Step 2 PHQ-9
    await screen.findByText('PHQ-9 — Sàng lọc triệu chứng')
    for (let i = 0; i < 9; i++) {
      fireEvent.click(screen.getByText('Vài ngày'))
      if (i < 8) {
        fireEvent.click(screen.getByText('Câu tiếp theo →'))
      } else {
        fireEvent.click(screen.getByText('Lưu PHQ-9 và tiếp tục sang GAD-7 →'))
      }
    }

    // Complete Step 2 GAD-7
    await screen.findByText('GAD-7 — Sàng lọc triệu chứng lo âu')
    for (let j = 0; j < 7; j++) {
      fireEvent.click(screen.getByText('Vài ngày'))
      if (j < 6) {
        fireEvent.click(screen.getByText('Câu tiếp theo →'))
      } else {
        fireEvent.click(
          screen.getByText('Nộp bài & Xem phân tích ý nghĩa kết quả →'),
        )
      }
    }

    // In Step 3: click "Tạo gợi ý kế hoạch hỗ trợ cá nhân hóa ngay →"
    const createPlanBtn = await screen.findByText(
      /Tạo gợi ý kế hoạch hỗ trợ cá nhân hóa ngay/i,
    )
    fireEvent.click(createPlanBtn)

    // Should reach Step 4
    expect(
      await screen.findByText(
        'Kế hoạch hỗ trợ của bạn đã được kích hoạt thành công!',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Bắt đầu khám phá không gian của bạn →'),
    ).toBeInTheDocument()

    // Click finish to dashboard
    const finishBtn = screen.getByText('Bắt đầu khám phá không gian của bạn →')
    fireEvent.click(finishBtn)
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })
})
