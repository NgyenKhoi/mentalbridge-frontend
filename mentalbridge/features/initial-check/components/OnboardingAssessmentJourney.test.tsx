import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import {
  activateSupportPlan,
  proposeSupportPlanDraft,
} from '@/features/support-plan/api/browser-support-plan'
import { getHomeNextStep } from '@/features/home/browser-home-next-step'
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

vi.mock('@/features/assessment/components/ReassessmentReview', () => ({
  ReassessmentReview: ({
    variant,
    footer,
  }: {
    variant: string
    footer?: React.ReactNode
  }) => (
    <div>
      Nhìn lại 14 ngày ({variant}){footer}
    </div>
  ),
}))

vi.mock('@/features/home/browser-home-next-step', () => ({
  getHomeNextStep: vi.fn().mockResolvedValue({ plan: null }),
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

  async function reachStep3(purpose?: 'REASSESSMENT', planReview = false) {
    render(
      <OnboardingAssessmentJourney purpose={purpose} planReview={planReview} />,
    )
    fireEvent.click(
      await screen.findByText(/Lưu thông tin & Bắt đầu bài sàng lọc đầu tiên/i),
    )
    await screen.findByText('PHQ-9 — Sàng lọc triệu chứng')
    for (let i = 0; i < 9; i++) {
      fireEvent.click(screen.getByText('Vài ngày'))
      fireEvent.click(
        screen.getByText(
          i < 8 ? 'Câu tiếp theo →' : 'Lưu PHQ-9 và tiếp tục sang GAD-7 →',
        ),
      )
    }
    await screen.findByText('GAD-7 — Sàng lọc triệu chứng lo âu')
    for (let j = 0; j < 7; j++) {
      fireEvent.click(screen.getByText('Vài ngày'))
      fireEvent.click(
        screen.getByText(
          j < 6
            ? 'Câu tiếp theo →'
            : 'Nộp bài & Xem phân tích ý nghĩa kết quả →',
        ),
      )
    }
    await screen.findByText(/Chuẩn thang đo quốc tế PHQ-9/i)
  }

  it('REASSESSMENT never proposes or activates a plan and ends with the review', async () => {
    await reachStep3('REASSESSMENT')
    expect(
      screen.queryByText(/Tạo gợi ý kế hoạch hỗ trợ cá nhân hóa/i),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/Kế hoạch của bạn chưa thay đổi/),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByText('Xem nhìn lại 14 ngày →'))

    expect(
      await screen.findByText('Nhìn lại 14 ngày (flow)'),
    ).toBeInTheDocument()
    expect(screen.getByText('4. Nhìn lại')).toBeInTheDocument()
    expect(screen.queryByText(/bài sàng lọc đầu tiên/i)).not.toBeInTheDocument()
    expect(proposeSupportPlanDraft).not.toHaveBeenCalled()
    expect(activateSupportPlan).not.toHaveBeenCalled()
    // No plan in use: the next step goes to the overview.
    expect(
      await screen.findByRole('link', { name: 'Về trang tổng quan →' }),
    ).toHaveAttribute('href', '/dashboard')
  })

  it('holds the step-4 action until Care says whether a plan is in use', async () => {
    let resolve!: (value: never) => void
    vi.mocked(getHomeNextStep).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done as (value: never) => void
      }),
    )
    await reachStep3('REASSESSMENT')
    fireEvent.click(screen.getByText('Xem nhìn lại 14 ngày →'))

    const held = await screen.findByRole('button', {
      name: 'Đang kiểm tra kế hoạch…',
    })
    expect(held).toBeDisabled()
    // No wrong destination can be followed while the state is unknown.
    expect(
      screen.queryByRole('link', {
        name: /Về trang tổng quan|Xem lại kế hoạch/,
      }),
    ).toBeNull()

    resolve({ plan: { supportPlanId: 'plan-1' } } as never)
    expect(
      await screen.findByRole('link', { name: 'Xem lại kế hoạch →' }),
    ).toHaveAttribute('href', '/support-plan?review=open')
  })

  it('keeps the step-4 action held with a retry when the plan state cannot be read', async () => {
    vi.mocked(getHomeNextStep).mockRejectedValueOnce(new Error('down'))
    await reachStep3('REASSESSMENT')
    fireEvent.click(screen.getByText('Xem nhìn lại 14 ngày →'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa kiểm tra được kế hoạch của bạn.',
    )
    expect(
      screen.queryByRole('link', {
        name: /Về trang tổng quan|Xem lại kế hoạch/,
      }),
    ).toBeNull()
    vi.mocked(getHomeNextStep).mockResolvedValueOnce({
      plan: { supportPlanId: 'plan-1' },
    } as never)
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(
      await screen.findByRole('link', { name: 'Xem lại kế hoạch →' }),
    ).toHaveAttribute('href', '/support-plan?review=open')
  })

  it('returnTo=plan-review goes straight to the plan review without asking Care', async () => {
    vi.mocked(getHomeNextStep).mockClear()
    await reachStep3('REASSESSMENT', true)
    fireEvent.click(screen.getByText('Xem nhìn lại 14 ngày →'))
    expect(
      await screen.findByRole('link', { name: 'Xem lại kế hoạch →' }),
    ).toHaveAttribute('href', '/support-plan?review=open')
    expect(getHomeNextStep).not.toHaveBeenCalled()
  })

  it('REASSESSMENT links to the plan review when the user has a plan in use', async () => {
    vi.mocked(getHomeNextStep).mockResolvedValueOnce({
      plan: { supportPlanId: 'plan-1' },
    } as never)
    await reachStep3('REASSESSMENT')
    fireEvent.click(screen.getByText('Xem nhìn lại 14 ngày →'))
    expect(
      await screen.findByRole('link', { name: 'Xem lại kế hoạch →' }),
    ).toHaveAttribute('href', '/support-plan?review=open')
  })

  it('INITIAL_CHECK shows an error and no success when the plan cannot be created, then retries', async () => {
    vi.mocked(proposeSupportPlanDraft).mockRejectedValueOnce(
      new Error('plan down'),
    )
    await reachStep3()
    fireEvent.click(screen.getByText(/Tạo gợi ý kế hoạch hỗ trợ cá nhân hóa/i))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa tạo được kế hoạch hỗ trợ',
    )
    expect(
      screen.queryByText(
        'Kế hoạch hỗ trợ của bạn đã được kích hoạt thành công!',
      ),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('Thử lại tạo kế hoạch hỗ trợ →'))
    expect(
      await screen.findByText(
        'Kế hoạch hỗ trợ của bạn đã được kích hoạt thành công!',
      ),
    ).toBeInTheDocument()
  })

  it('INITIAL_CHECK retries activation of the same draft instead of proposing twice', async () => {
    vi.mocked(proposeSupportPlanDraft).mockClear()
    vi.mocked(activateSupportPlan).mockRejectedValueOnce(
      new Error('activate down'),
    )
    await reachStep3()
    fireEvent.click(screen.getByText(/Tạo gợi ý kế hoạch hỗ trợ cá nhân hóa/i))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByText('Thử lại tạo kế hoạch hỗ trợ →'))
    await screen.findByText(
      'Kế hoạch hỗ trợ của bạn đã được kích hoạt thành công!',
    )
    await waitFor(() => expect(activateSupportPlan).toHaveBeenCalledTimes(2))
    expect(proposeSupportPlanDraft).toHaveBeenCalledTimes(1)
  })

  it('INITIAL_CHECK replays the same keys after an activation that timed out, so a committed activation is not repeated', async () => {
    vi.mocked(proposeSupportPlanDraft).mockClear()
    vi.mocked(activateSupportPlan).mockClear()
    vi.mocked(activateSupportPlan).mockRejectedValueOnce(
      new ApiError({ message: 'timeout', code: 'NETWORK_ERROR' }),
    )
    await reachStep3()
    fireEvent.click(screen.getByText(/Tạo gợi ý kế hoạch hỗ trợ cá nhân hóa/i))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByText('Thử lại tạo kế hoạch hỗ trợ →'))
    await screen.findByText(
      'Kế hoạch hỗ trợ của bạn đã được kích hoạt thành công!',
    )
    const [first, second] = vi.mocked(activateSupportPlan).mock.calls
    expect(second[2]).toBe(first[2])
    expect(second[0]).toBe(first[0])
    expect(proposeSupportPlanDraft).toHaveBeenCalledTimes(1)
  })

  it('INITIAL_CHECK starts over with fresh keys after a definite rejection', async () => {
    vi.mocked(proposeSupportPlanDraft).mockClear()
    vi.mocked(activateSupportPlan).mockClear()
    vi.mocked(activateSupportPlan).mockRejectedValueOnce(
      new ApiError({
        message: 'conflict',
        code: 'VERSION_CONFLICT',
        status: 409,
      }),
    )
    await reachStep3()
    fireEvent.click(screen.getByText(/Tạo gợi ý kế hoạch hỗ trợ cá nhân hóa/i))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByText('Thử lại tạo kế hoạch hỗ trợ →'))
    await screen.findByText(
      'Kế hoạch hỗ trợ của bạn đã được kích hoạt thành công!',
    )
    const [first, second] = vi.mocked(activateSupportPlan).mock.calls
    expect(second[2]).not.toBe(first[2])
    expect(proposeSupportPlanDraft).toHaveBeenCalledTimes(2)
  })
})
