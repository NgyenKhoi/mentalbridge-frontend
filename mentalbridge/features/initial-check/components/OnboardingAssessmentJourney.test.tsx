import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import {
  ensureCurrentSupportGuide,
  getGuidedJourney,
} from '@/features/support-guide/api/browser-support-guide'
import {
  activateSupportPlan,
  proposeSupportPlanDraft,
} from '@/features/support-plan/api/browser-support-plan'
import { getHomeNextStep } from '@/features/home/browser-home-next-step'
import {
  createInitialCheckEvaluation,
  saveCareProfile,
} from '@/features/assessment/api/browser-care'
import { useMamSuppress } from '@/features/mam/mam-suppression'
import OnboardingAssessmentJourney, {
  PHQ9_QUESTIONS,
  GAD7_QUESTIONS,
} from './OnboardingAssessmentJourney'

const mockPush = vi.fn()
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
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

vi.mock('@/features/mam/mam-suppression', () => ({ useMamSuppress: vi.fn() }))

vi.mock('@/features/assessment/components/ReassessmentReview', () => ({
  ReassessmentReview: ({ footer }: { footer?: React.ReactNode }) => (
    <div>
      Chặng vừa khép lại
      {footer}
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

vi.mock('@/features/support-guide/api/browser-support-guide', () => ({
  ensureCurrentSupportGuide: vi
    .fn()
    .mockResolvedValue({ supportGuideId: 'guide-123' }),
  getGuidedJourney: vi
    .fn()
    .mockResolvedValue({ episodeId: null, assessmentInProgress: false }),
}))

describe('OnboardingAssessmentJourney', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
  })

  it('turns a retake after a completed initial check into a reassessment', async () => {
    vi.mocked(getGuidedJourney).mockResolvedValueOnce({
      episodeId: 'episode-1',
      assessmentInProgress: false,
    } as never)
    render(<OnboardingAssessmentJourney />)
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        '/initial-check?purpose=reassessment',
      ),
    )
    expect(screen.queryByLabelText(/Tên gọi thân mật/i)).not.toBeInTheDocument()
  })

  it('keeps an unfinished initial check on its own journey', async () => {
    vi.mocked(getGuidedJourney).mockResolvedValueOnce({
      episodeId: 'episode-1',
      assessmentInProgress: true,
    } as never)
    render(<OnboardingAssessmentJourney />)
    expect(
      await screen.findByLabelText(/Tên gọi thân mật/i),
    ).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
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
    expect(screen.queryByText('Cải thiện giấc ngủ')).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/Môi trường làm việc/i),
    ).not.toBeInTheDocument()
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

  it('stays on the profile step with an error when saving the profile fails', async () => {
    vi.mocked(saveCareProfile).mockRejectedValueOnce(new Error('down'))
    render(<OnboardingAssessmentJourney />)

    fireEvent.click(
      await screen.findByText(/Lưu thông tin & Bắt đầu bài sàng lọc đầu tiên/i),
    )

    await waitFor(() =>
      expect(mockShowActionToast).toHaveBeenCalledWith(
        expect.objectContaining({ tone: 'error' }),
      ),
    )
    expect(screen.queryByText('PHQ-9 — Sàng lọc triệu chứng')).toBeNull()
    expect(screen.getByLabelText(/Tên gọi thân mật/i)).toBeInTheDocument()
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
      screen.getByText('Ý nghĩa kết quả', { selector: 'span' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Cơ chế giao cảm cảnh giác cao'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Xem gợi ý hỗ trợ' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/gợi ý hỗ trợ sẽ chỉ ra/)).toBeInTheDocument()
    expect(screen.queryByText(/lộ trình 14 ngày/)).not.toBeInTheDocument()
    // The resource cards and the link that scrolled to them are gone.
    expect(
      screen.queryByText(/Tài nguyên gợi ý tức thì/),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/tài nguyên hỗ trợ gợi ý/),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Kỹ thuật thở cơ hoành/)).not.toBeInTheDocument()
    expect(screen.getByText('4. Gợi ý hỗ trợ')).toBeInTheDocument()
  })

  it('opens the Support Guide from Step 3 without touching the plan', async () => {
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

    fireEvent.click(
      await screen.findByRole('button', { name: 'Xem gợi ý hỗ trợ' }),
    )

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/support-guides/guide-123'),
    )
    expect(ensureCurrentSupportGuide).toHaveBeenCalledTimes(1)
    expect(proposeSupportPlanDraft).not.toHaveBeenCalled()
    expect(activateSupportPlan).not.toHaveBeenCalled()
    expect(screen.queryByText(/đã được kích hoạt/)).not.toBeInTheDocument()
  })

  async function reachStep3(
    purpose?: 'REASSESSMENT',
    planReview = false,
    accountId?: string,
  ) {
    render(
      <OnboardingAssessmentJourney
        purpose={purpose}
        planReview={planReview}
        accountId={accountId}
      />,
    )
    if (purpose !== 'REASSESSMENT') {
      fireEvent.click(
        await screen.findByText(
          /Lưu thông tin & Bắt đầu bài sàng lọc đầu tiên/i,
        ),
      )
    }
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
      screen.queryByRole('button', { name: 'Xem gợi ý hỗ trợ' }),
    ).not.toBeInTheDocument()
    expect(ensureCurrentSupportGuide).not.toHaveBeenCalled()
    expect(
      screen.getByText(/Kế hoạch của bạn chưa thay đổi/),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByText('Xem nhìn lại 14 ngày →'))

    expect(await screen.findByText('Chặng vừa khép lại')).toBeInTheDocument()
    expect(screen.getByText('4. Nhìn lại')).toBeInTheDocument()
    expect(screen.queryByText(/bài sàng lọc đầu tiên/i)).not.toBeInTheDocument()
    expect(proposeSupportPlanDraft).not.toHaveBeenCalled()
    expect(activateSupportPlan).not.toHaveBeenCalled()
    // No plan in use: the next step goes to the overview.
    expect(
      await screen.findByRole('link', { name: 'Về trang tổng quan →' }),
    ).toHaveAttribute('href', '/dashboard')
  })

  it('still reaches the review when preparing the reassessment Guide fails', async () => {
    vi.mocked(ensureCurrentSupportGuide).mockRejectedValueOnce(
      new Error('down'),
    )
    await reachStep3('REASSESSMENT')

    fireEvent.click(screen.getByText('Xem nhìn lại 14 ngày →'))

    expect(await screen.findByText('Chặng vừa khép lại')).toBeInTheDocument()
    expect(ensureCurrentSupportGuide).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reaches the review after 6 s even when the reassessment Guide never settles', async () => {
    vi.mocked(ensureCurrentSupportGuide).mockReturnValueOnce(
      new Promise(() => {}) as never,
    )
    await reachStep3('REASSESSMENT')
    const realSetTimeout = window.setTimeout.bind(window)
    const waits: unknown[] = []
    vi.spyOn(window, 'setTimeout').mockImplementation(((
      fn: () => void,
      ms?: number,
    ) => {
      waits.push(ms)
      return ms === 6000 ? (fn(), 0) : realSetTimeout(fn, ms)
    }) as never)

    fireEvent.click(screen.getByText('Xem nhìn lại 14 ngày →'))

    expect(await screen.findByText('Chặng vừa khép lại')).toBeInTheDocument()
    expect(waits).toContain(6000)
    vi.mocked(window.setTimeout).mockRestore()
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

  it('INITIAL_CHECK shows a plan-free error when the guide cannot be opened, then retries', async () => {
    vi.mocked(ensureCurrentSupportGuide).mockRejectedValueOnce(
      new Error('guide down'),
    )
    await reachStep3()
    fireEvent.click(screen.getByRole('button', { name: 'Xem gợi ý hỗ trợ' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa mở được gợi ý hỗ trợ. Kết quả sàng lọc của bạn vẫn được lưu. Bạn hãy thử lại.',
    )
    expect(screen.getByRole('alert')).not.toHaveTextContent(/kế hoạch/)
    expect(mockPush).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('button', { name: 'Thử lại xem gợi ý hỗ trợ' }),
    )
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/support-guides/guide-123'),
    )
    expect(ensureCurrentSupportGuide).toHaveBeenCalledTimes(2)
    expect(proposeSupportPlanDraft).not.toHaveBeenCalled()
  })
})

describe('OnboardingAssessmentJourney with Mầm (mam-v3)', () => {
  const ACCOUNT = '00000000-0000-4000-8000-0000000000cc'
  const FOCUS_TITLE = '14 ngày tới, bạn muốn điều gì nhẹ đi?'
  const tier = (supportTier: string) =>
    vi
      .mocked(createInitialCheckEvaluation)
      .mockResolvedValue({ supportTier } as never)
  const moments: string[] = []
  const onMoment = (event: Event) =>
    moments.push((event as CustomEvent<{ kind: string }>).detail.kind)
  const lastSuppress = () => vi.mocked(useMamSuppress).mock.calls.at(-1)

  async function reach(purpose?: 'REASSESSMENT', item9Label = 'Không có gì') {
    // The same walk as reachStep3, with the account the picker and Mầm need.
    render(
      <OnboardingAssessmentJourney purpose={purpose} accountId={ACCOUNT} />,
    )
    if (purpose !== 'REASSESSMENT')
      fireEvent.click(
        await screen.findByText(
          /Lưu thông tin & Bắt đầu bài sàng lọc đầu tiên/i,
        ),
      )
    await screen.findByText('PHQ-9 — Sàng lọc triệu chứng')
    for (let i = 0; i < 9; i++) {
      fireEvent.click(screen.getByText(i < 8 ? 'Vài ngày' : item9Label))
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

  beforeEach(() => {
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
    moments.length = 0
    window.addEventListener('mam:moment', onMoment)
    return () => window.removeEventListener('mam:moment', onMoment)
  })

  it('says once, when PHQ-9 is saved, that half is done', async () => {
    tier('SELF_GUIDED_SUPPORT')
    await reach()

    expect(moments.filter((kind) => kind === 'screening-half')).toHaveLength(1)
  })

  it('says nothing cheerful when item 9 was answered above "Không có gì"', async () => {
    tier('SELF_GUIDED_SUPPORT')
    await reach(undefined, 'Vài ngày')

    expect(moments).not.toContain('screening-half')
  })

  it('hides Mầm while the crisis panel is open', async () => {
    render(<OnboardingAssessmentJourney accountId={ACCOUNT} />)
    await screen.findByText(/Lưu thông tin & Bắt đầu bài sàng lọc đầu tiên/i)
    expect(lastSuppress()).toEqual([false, 'hide'])

    fireEvent.click(screen.getByRole('button', { name: /Hỗ trợ an toàn/ }))

    expect(lastSuppress()).toEqual([true, 'hide'])
  })

  it('SELF_GUIDED: keeps Mầm and asks for the 14-day goal under the result, before the one primary action', async () => {
    tier('SELF_GUIDED_SUPPORT')
    await reach()

    expect(lastSuppress()).toEqual([false, 'hide'])
    expect(
      screen.getByRole('heading', { level: 3, name: FOCUS_TITLE }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Xem gợi ý hỗ trợ' }),
    ).toBeInTheDocument()
    expect(moments).not.toContain('result-professional')
  })

  it('PROFESSIONAL: Mầm points to the specialist in place, the goal picker is offered, nothing celebrates', async () => {
    tier('PROFESSIONAL_SUPPORT_RECOMMENDED')
    await reach()

    expect(lastSuppress()).toEqual([false, 'hide'])
    expect(moments).toContain('result-professional')
    expect(
      screen.getByRole('heading', { level: 3, name: FOCUS_TITLE }),
    ).toBeInTheDocument()
  })

  it('SAFETY: Mầm is hidden, no goal is asked and no moment is sent', async () => {
    tier('SAFETY_FOLLOW_UP_RECOMMENDED')
    await reach()

    expect(lastSuppress()).toEqual([true, 'hide'])
    expect(screen.queryByRole('heading', { name: FOCUS_TITLE })).toBeNull()
    expect(moments).not.toContain('result-professional')
  })

  it('an unknown tier (the evaluation failed) hides Mầm as well and asks nothing', async () => {
    vi.mocked(createInitialCheckEvaluation).mockRejectedValue(new Error('down'))
    await reach()

    expect(lastSuppress()).toEqual([true, 'hide'])
    expect(screen.queryByRole('heading', { name: FOCUS_TITLE })).toBeNull()
  })

  it('a reassessment never asks for the goal again', async () => {
    tier('SELF_GUIDED_SUPPORT')
    await reach('REASSESSMENT')

    expect(screen.queryByRole('heading', { name: FOCUS_TITLE })).toBeNull()
  })

  it('"Để sau" removes the picker and gives focus to the one primary action', async () => {
    tier('SELF_GUIDED_SUPPORT')
    await reach()

    fireEvent.click(screen.getByRole('button', { name: 'Để sau' }))

    expect(screen.queryByRole('heading', { name: FOCUS_TITLE })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Xem gợi ý hỗ trợ' }),
    ).toHaveFocus()
  })

  it('saving the goal shows Mầm line and keeps the primary action', async () => {
    tier('SELF_GUIDED_SUPPORT')
    await reach()

    fireEvent.click(screen.getByRole('radio', { name: 'Giấc ngủ' }))
    fireEvent.click(screen.getByRole('button', { name: 'Chọn điều này' }))

    expect(
      await screen.findByText('Ok, 14 ngày tới mình để ý giấc ngủ nhé.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Xem gợi ý hỗ trợ' }),
    ).toBeInTheDocument()
  })
})
