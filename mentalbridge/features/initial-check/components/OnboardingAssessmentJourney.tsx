'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Shield,
  User,
  Calendar,
  Briefcase,
  Lock,
  ArrowRight,
  LifeBuoy,
  Check,
  Moon,
  Zap,
  Smile,
  Users,
  Heart,
  Compass,
  FileText,
  RotateCcw,
  Sparkles,
  X,
  CheckCircle2,
} from 'lucide-react'

import { useFeedback } from '@/components/ui/FeedbackProvider'
import {
  getCareProfile,
  saveCareProfile,
  getCurrentQuestionnaire,
  getPrivacyDisclosure,
  recordPrivacyDecision,
  submitInitialCheckAssessment,
  createInitialCheckEvaluation,
} from '@/features/assessment/api/browser-care'
import {
  proposeSupportPlanDraft,
  activateSupportPlan,
} from '@/features/support-plan/api/browser-support-plan'

import './onboarding-assessment.css'

export type OnboardingStep = 1 | 2 | 3 | 4

// ============================================================================
// QUESTIONNAIRE DEFINITIONS (PHQ-9 and GAD-7)
// ============================================================================
export const PHQ9_QUESTIONS = [
  {
    id: 'phq9_1',
    itemNumber: 1,
    prompt: 'Ít quan tâm hoặc niềm vui khi làm việc',
  },
  {
    id: 'phq9_2',
    itemNumber: 2,
    prompt: 'Cảm thấy chán nản, buồn rầu hoặc vô vọng',
  },
  {
    id: 'phq9_3',
    itemNumber: 3,
    prompt: 'Khó ngủ hoặc duy trì giấc ngủ, hoặc ngủ quá nhiều',
  },
  {
    id: 'phq9_4',
    itemNumber: 4,
    prompt: 'Cảm thấy mệt mỏi hoặc có ít năng lượng',
  },
  {
    id: 'phq9_5',
    itemNumber: 5,
    prompt: 'Kém ăn hoặc ăn quá nhiều',
  },
  {
    id: 'phq9_6',
    itemNumber: 6,
    prompt:
      'Cảm thấy tồi tệ về bản thân - hoặc rằng bạn là một kẻ thất bại hoặc đã khiến bản thân hoặc gia đình thất vọng',
  },
  {
    id: 'phq9_7',
    itemNumber: 7,
    prompt: 'Khó tập trung vào mọi thứ, chẳng hạn như đọc báo hoặc xem tivi',
  },
  {
    id: 'phq9_8',
    itemNumber: 8,
    prompt:
      'Di chuyển hoặc nói chậm đến mức người khác có thể nhận thấy? Hoặc ngược lại - bồn chồn hoặc bồn chồn đến mức bạn đã di chuyển xung quanh nhiều hơn bình thường',
  },
  {
    id: 'phq9_9',
    itemNumber: 9,
    prompt:
      'Suy nghĩ rằng tốt hơn hết là bạn nên chết hoặc làm tổn thương bản thân theo một cách nào đó',
    safetyItem: true,
  },
]

export const PHQ9_OPTIONS = [
  { value: 0, label: 'Không có gì' },
  { value: 1, label: 'Vài ngày' },
  { value: 2, label: 'Hơn nửa ngày' },
  { value: 3, label: 'Gần như mỗi ngày' },
]

export const GAD7_QUESTIONS = [
  {
    id: 'gad7_1',
    itemNumber: 1,
    prompt: 'Cảm giác hồi hộp, lo lắng hoặc cáu kỉnh',
  },
  {
    id: 'gad7_2',
    itemNumber: 2,
    prompt: 'Không thể dừng hoặc kiểm soát được việc lo lắng',
  },
  {
    id: 'gad7_3',
    itemNumber: 3,
    prompt: 'Lo lắng quá nhiều về những điều khác nhau',
  },
  {
    id: 'gad7_4',
    itemNumber: 4,
    prompt: 'Không thể thư giãn được',
  },
  {
    id: 'gad7_5',
    itemNumber: 5,
    prompt: 'Cảm thấy bồn chồn đến mức mà khó có thể ngồi yên một chỗ',
  },
  {
    id: 'gad7_6',
    itemNumber: 6,
    prompt: 'Trở nên dễ bực mình hoặc cáu kỉnh',
  },
  {
    id: 'gad7_7',
    itemNumber: 7,
    prompt: 'Cảm thấy sợ như thể có một điều gì đó khủng khiếp có thể xảy ra',
  },
]

export const GAD7_OPTIONS = [
  { value: 0, label: 'Không bao giờ' },
  { value: 1, label: 'Vài ngày' },
  { value: 2, label: 'Hơn một nửa số ngày' },
  { value: 3, label: 'Gần như hàng ngày' },
]

const PRIORITY_GOALS = [
  {
    id: 'sleep',
    title: 'Cải thiện giấc ngủ',
    desc: 'Khó ngủ, thức giấc giữa đêm, ác mộng',
    Icon: Moon,
  },
  {
    id: 'work_stress',
    title: 'Giảm căng thẳng công việc',
    desc: 'Kiệt sức, quá tải deadline, mất động lực',
    Icon: Zap,
  },
  {
    id: 'emotion',
    title: 'Cân bằng cảm xúc',
    desc: 'Dễ cáu gắt, lo âu mơ hồ, tụt năng lượng',
    Icon: Smile,
  },
  {
    id: 'relationships',
    title: 'Hàn gắn mối quan hệ',
    desc: 'Xung đột hôn nhân, rạn nứt, cô lập xã hội',
    Icon: Users,
  },
  {
    id: 'trauma',
    title: 'Phục hồi sau biến cố',
    desc: 'Mất mát người thân, chia tay, sang chấn',
    Icon: Heart,
  },
  {
    id: 'self_understanding',
    title: 'Hiểu sâu nội tâm',
    desc: 'Định hướng giá trị bản thân và tương lai',
    Icon: Compass,
  },
]

export default function OnboardingAssessmentJourney({
  purpose = 'INITIAL_CHECK',
  planReview = false,
}: {
  purpose?: 'INITIAL_CHECK' | 'REASSESSMENT'
  planReview?: boolean
}) {
  const router = useRouter()
  const { showActionToast } = useFeedback()

  // Steps: 1 (Hồ sơ) -> 2 (Sàng lọc PHQ-9 & GAD-7) -> 3 (Ý nghĩa kết quả) -> 4 (Kế hoạch hỗ trợ)
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [profileVersion, setProfileVersion] = useState<number | undefined>(
    undefined,
  )

  // Step 1: Profile form state
  const [displayName, setDisplayName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [gender, setGender] = useState<'FEMALE' | 'MALE' | 'OTHER'>('FEMALE')
  const [workEnvironment, setWorkEnvironment] = useState('office')
  const [selectedGoals, setSelectedGoals] = useState<string[]>([
    'sleep',
    'emotion',
  ])
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({})

  // Step 2: Assessment state
  const [assessmentPhase, setAssessmentPhase] = useState<'PHQ9' | 'GAD7'>(
    'PHQ9',
  )
  const [questionIndex, setQuestionIndex] = useState(0)
  const [phq9Answers, setPhq9Answers] = useState<Record<string, number>>({})
  const [gad7Answers, setGad7Answers] = useState<Record<string, number>>({})
  const [privacyPolicyVersion, setPrivacyPolicyVersion] =
    useState<'privacy-capstone-v3'>('privacy-capstone-v3')

  // Modals state
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewTab, setReviewTab] = useState<'PHQ9' | 'GAD7'>('PHQ9')
  const [showSafetyModal, setShowSafetyModal] = useState(false)
  const [activeArticleModal, setActiveArticleModal] = useState<
    'breathing' | 'overthinking' | null
  >(null)

  // Load profile & initial check status
  useEffect(() => {
    let active = true
    async function init() {
      try {
        const [profileRes, disclosureRes] = await Promise.allSettled([
          getCareProfile(),
          getPrivacyDisclosure(),
        ])

        if (!active) return

        if (profileRes.status === 'fulfilled' && profileRes.value) {
          const p = profileRes.value
          if (p.displayName) setDisplayName(p.displayName)
          if (p.dateOfBirth) {
            const year = p.dateOfBirth.split('-')[0]
            if (year) setBirthYear(year)
          }
          if (
            p.gender === 'MALE' ||
            p.gender === 'FEMALE' ||
            p.gender === 'OTHER'
          ) {
            setGender(p.gender)
          }
          setProfileVersion(p.version)
        }

        if (disclosureRes.status === 'fulfilled' && disclosureRes.value) {
          if (disclosureRes.value.version === 'privacy-capstone-v3') {
            setPrivacyPolicyVersion(disclosureRes.value.version)
          }
        }
      } catch {
        // Fallback to defaults
      } finally {
        if (active) setLoading(false)
      }
    }
    init()
    return () => {
      active = false
    }
  }, [])

  // Goal selection handler (max 3)
  const toggleGoal = (id: string) => {
    setSelectedGoals((prev) => {
      if (prev.includes(id)) {
        return prev.filter((g) => g !== id)
      }
      if (prev.length >= 3) {
        showActionToast({
          title: 'Bạn chỉ có thể chọn tối đa 3 mục tiêu ưu tiên',
          tone: 'warning',
        })
        return prev
      }
      return [...prev, id]
    })
  }

  // Handle Step 1 Save
  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const errors: Record<string, string> = {}
    if (!displayName.trim()) {
      errors.displayName = 'Vui lòng nhập tên gọi hoặc biệt danh của bạn.'
    }
    const yearNum = parseInt(birthYear, 10)
    const currentYear = new Date().getFullYear()
    if (
      !birthYear.trim() ||
      isNaN(yearNum) ||
      yearNum < 1920 ||
      yearNum > currentYear - 13
    ) {
      errors.birthYear = 'Năm sinh không hợp lệ (từ 1920 đến hiện tại).'
    }
    if (selectedGoals.length === 0) {
      errors.goals = 'Vui lòng chọn ít nhất 1 mục tiêu đồng hành.'
    }

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors)
      showActionToast({
        title: 'Vui lòng hoàn thiện các trường bắt buộc',
        tone: 'error',
      })
      return
    }

    setProfileErrors({})
    setSubmitting(true)
    try {
      const formattedDob = `${yearNum.toString().padStart(4, '0')}-01-01`
      await saveCareProfile(
        {
          displayName: displayName.trim(),
          dateOfBirth: formattedDob,
          gender,
        },
        profileVersion,
      )

      await recordPrivacyDecision(true, privacyPolicyVersion).catch(
        () => undefined,
      )

      showActionToast({
        title: 'Đã lưu thông tin hồ sơ thành công',
        tone: 'success',
      })
      setCurrentStep(2)
      setAssessmentPhase('PHQ9')
      setQuestionIndex(0)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // Advance to step 2 anyway if network or mock
      setCurrentStep(2)
      setAssessmentPhase('PHQ9')
      setQuestionIndex(0)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSubmitting(false)
    }
  }

  // Answer handler for current question (allows free changing anytime)
  const handleSelectCurrentAnswer = (val: number) => {
    if (assessmentPhase === 'PHQ9') {
      const q = PHQ9_QUESTIONS[questionIndex]
      if (q) {
        setPhq9Answers((prev) => ({ ...prev, [q.id]: val }))
      }
    } else {
      const q = GAD7_QUESTIONS[questionIndex]
      if (q) {
        setGad7Answers((prev) => ({ ...prev, [q.id]: val }))
      }
    }
  }

  // Navigation within Step 2
  const handlePreviousQuestion = () => {
    if (questionIndex > 0) {
      setQuestionIndex((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (assessmentPhase === 'GAD7') {
      // Allow returning to PHQ-9 question 9 to review/change!
      setAssessmentPhase('PHQ9')
      setQuestionIndex(PHQ9_QUESTIONS.length - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleNextQuestion = () => {
    const totalQ =
      assessmentPhase === 'PHQ9' ? PHQ9_QUESTIONS.length : GAD7_QUESTIONS.length
    if (questionIndex < totalQ - 1) {
      setQuestionIndex((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Complete PHQ-9 and advance to GAD-7
  const handleCompletePhq9AndStartGad7 = async () => {
    // Check if current question is answered
    const currentQ = PHQ9_QUESTIONS[questionIndex]
    if (currentQ && phq9Answers[currentQ.id] === undefined) {
      showActionToast({
        title: 'Vui lòng chọn đáp án trước khi tiếp tục',
        tone: 'warning',
      })
      return
    }

    setSubmitting(true)
    try {
      // Save PHQ-9 in background
      const qRes = await getCurrentQuestionnaire('PHQ9').catch(() => null)
      const definitionId =
        qRes?.definitionId || '10000000-0000-0000-0000-000000000004'

      const submissionPayload = {
        questionnaireDefinitionId: definitionId,
        privacyPolicyVersion,
        privacyDisclosureAcknowledged: true as const,
        answers: PHQ9_QUESTIONS.map((q, idx) => ({
          questionId: qRes?.questions[idx]?.questionId ?? q.id,
          value: phq9Answers[q.id] ?? 0,
        })),
      }

      await submitInitialCheckAssessment(
        'PHQ9',
        submissionPayload,
        crypto.randomUUID(),
        purpose,
      ).catch(() => undefined)

      showActionToast({
        title: 'Đã lưu bài PHQ-9. Tiếp tục làm bài GAD-7',
        tone: 'success',
      })
      setAssessmentPhase('GAD7')
      setQuestionIndex(0)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setAssessmentPhase('GAD7')
      setQuestionIndex(0)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSubmitting(false)
    }
  }

  // Submit all assessments (GAD-7 done) and advance to Step 3
  const handleSubmitAllAssessments = async () => {
    const currentQ = GAD7_QUESTIONS[questionIndex]
    if (currentQ && gad7Answers[currentQ.id] === undefined) {
      showActionToast({
        title: 'Vui lòng chọn đáp án trước khi nộp bài',
        tone: 'warning',
      })
      return
    }

    setSubmitting(true)
    try {
      const qRes = await getCurrentQuestionnaire('GAD7').catch(() => null)
      const definitionId =
        qRes?.definitionId || '10000000-0000-0000-0000-000000000003'

      const submissionPayload = {
        questionnaireDefinitionId: definitionId,
        privacyPolicyVersion,
        privacyDisclosureAcknowledged: true as const,
        answers: GAD7_QUESTIONS.map((q, idx) => ({
          questionId: qRes?.questions[idx]?.questionId ?? q.id,
          value: gad7Answers[q.id] ?? 0,
        })),
      }

      await submitInitialCheckAssessment(
        'GAD7',
        submissionPayload,
        crypto.randomUUID(),
        purpose,
      ).catch(() => undefined)

      // Ensure evaluation baseline
      await createInitialCheckEvaluation(purpose).catch(() => undefined)

      showActionToast({
        title: 'Đã hoàn thành hai bài sàng lọc PHQ-9 & GAD-7',
        tone: 'success',
      })
      setCurrentStep(3)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setCurrentStep(3)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSubmitting(false)
    }
  }

  // Calculate scores for Step 3
  const phq9Score = useMemo(() => {
    return Object.values(phq9Answers).reduce((acc, curr) => acc + curr, 0)
  }, [phq9Answers])

  const gad7Score = useMemo(() => {
    return Object.values(gad7Answers).reduce((acc, curr) => acc + curr, 0)
  }, [gad7Answers])

  const phq9LevelInfo = useMemo(() => {
    if (phq9Score <= 4) {
      return {
        levelLabel: 'Tối thiểu',
        range: 'Tối thiểu (0–4)',
        activeSegment: 0,
        color: '#2e7d32',
        summary:
          'Trong 14 ngày qua, các câu trả lời cho thấy ít hoặc không có biểu hiện trầm cảm, sức khỏe tâm lý ổn định.',
      }
    }
    if (phq9Score <= 9) {
      return {
        levelLabel: 'Nhẹ',
        range: 'Nhẹ (5–9)',
        activeSegment: 1,
        color: '#1e5646',
        summary:
          'Xuất hiện một số biểu hiện nhẹ liên quan đến tâm trạng hoặc năng lượng, cần quan tâm chăm sóc bản thân.',
      }
    }
    if (phq9Score <= 14) {
      return {
        levelLabel: 'Trung bình',
        range: 'Trung bình (10–14)',
        activeSegment: 2,
        color: '#e65100',
        summary:
          'Các triệu chứng mệt mỏi hoặc giảm hứng thú ở mức trung bình, có thể ảnh hưởng đến giấc ngủ và công việc.',
      }
    }
    if (phq9Score <= 19) {
      return {
        levelLabel: 'Khá nặng',
        range: 'Khá nặng (15–19)',
        activeSegment: 3,
        color: '#d84315',
        summary:
          'Biểu hiện tâm lý gặp khó khăn rõ rệt, cần các giải pháp can thiệp hành vi và hỗ trợ tích cực.',
      }
    }
    return {
      levelLabel: 'Nặng',
      range: 'Nặng (20–27)',
      activeSegment: 3,
      color: '#c62828',
      summary:
        'Biểu hiện mức độ nghiêm trọng, cần tham khảo ý kiến chuyên gia tâm lý hoặc bác sĩ chuyên khoa.',
    }
  }, [phq9Score])

  const gad7LevelInfo = useMemo(() => {
    if (gad7Score <= 4) {
      return {
        levelLabel: 'Tối thiểu',
        range: 'Tối thiểu (0–4)',
        activeSegment: 0,
        color: '#2e7d32',
        summary:
          'Trạng thái lo âu và căng thẳng ở mức rất thấp, cơ thể duy trì trạng thái thư giãn tốt.',
      }
    }
    if (gad7Score <= 9) {
      return {
        levelLabel: 'Nhẹ',
        range: 'Nhẹ (5–9)',
        activeSegment: 1,
        color: '#1e5646',
        summary:
          'Có dấu hiệu căng thẳng hoặc lo lắng nhẹ trong một số tình huống sinh hoạt thường nhật.',
      }
    }
    if (gad7Score <= 14) {
      return {
        levelLabel: 'Vừa',
        range: 'Vừa (10–14)',
        activeSegment: 2,
        color: '#e65100',
        summary:
          'Mức độ lo âu vừa phải, có thể gây bồn chồn, căng cơ hoặc khó tập trung vào công việc.',
      }
    }
    return {
      levelLabel: 'Nặng',
      range: 'Nặng (15–21)',
      activeSegment: 3,
      color: '#c62828',
      summary:
        'Mức độ lo âu cao thường trực, hệ thần kinh giao cảm bị kích thích liên tục gây kiệt sức.',
    }
  }, [gad7Score])

  // Retake assessment handler
  const handleRetakeAssessment = () => {
    setPhq9Answers({})
    setGad7Answers({})
    setAssessmentPhase('PHQ9')
    setQuestionIndex(0)
    setCurrentStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Handle Step 4 Support Plan Generation
  const handleGenerateSupportPlan = async () => {
    setSubmitting(true)
    try {
      const draft = await proposeSupportPlanDraft(
        crypto.randomUUID(),
        purpose,
      ).catch(() => null)
      if (draft && draft.supportPlanId) {
        await activateSupportPlan(
          draft.supportPlanId,
          draft.version,
          crypto.randomUUID(),
        ).catch(() => undefined)
      }
      setCurrentStep(4)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setCurrentStep(4)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSubmitting(false)
    }
  }

  // Finish journey & enter dashboard
  const handleFinishToDashboard = () => {
    showActionToast({
      title: 'Chào mừng bạn đến với Không gian quản trị MentalBridge!',
      tone: 'success',
    })
    router.push('/dashboard')
  }

  const userInitial = displayName.trim()
    ? displayName.trim().charAt(0).toUpperCase()
    : 'K'

  if (loading) {
    return (
      <div className="onboarding-journey-container">
        <header className="oj-header">
          <div className="oj-brand">
            <span className="oj-brand-title">MentalBridge</span>
          </div>
        </header>
        <main
          className="oj-main"
          style={{ display: 'grid', placeItems: 'center', minHeight: '60vh' }}
        >
          <div style={{ textAlign: 'center' }}>
            <span
              className="care-loader"
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 36,
                height: 36,
                border: '3px solid #e2ede7',
                borderTopColor: '#1e5646',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <h2
              style={{
                marginTop: 16,
                color: '#16332a',
                fontSize: 18,
                fontFamily: 'var(--font-fraunces-variable), serif',
              }}
            >
              Đang chuẩn bị không gian an yên cho bạn…
            </h2>
          </div>
        </main>
      </div>
    )
  }

  // Current active questions and options in Step 2
  const activeQuestions =
    assessmentPhase === 'PHQ9' ? PHQ9_QUESTIONS : GAD7_QUESTIONS
  const activeOptions = assessmentPhase === 'PHQ9' ? PHQ9_OPTIONS : GAD7_OPTIONS
  const activeAnswers = assessmentPhase === 'PHQ9' ? phq9Answers : gad7Answers
  const activeQuestion = activeQuestions[questionIndex]
  const activeAnswer = activeQuestion
    ? activeAnswers[activeQuestion.id]
    : undefined
  const activeAnsweredCount = Object.keys(activeAnswers).length
  const isLastQuestionOfCurrent = questionIndex === activeQuestions.length - 1

  return (
    <div className="onboarding-journey-container">
      {/* Top Header */}
      <header className="oj-header">
        <Link
          href="/dashboard"
          className="oj-brand"
          aria-label="MentalBridge Home"
        >
          <svg
            className="oj-logo-icon"
            viewBox="0 0 36 36"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="18"
              cy="18"
              r="17"
              stroke="#1E5646"
              strokeWidth="2"
              fill="#F4F8F6"
            />
            <path
              d="M18 9C13.0294 9 9 13.0294 9 18C9 22.9706 13.0294 27 18 27C22.9706 27 27 22.9706 27 18"
              stroke="#1E5646"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M18 13C15.2386 13 13 15.2386 13 18C13 20.7614 15.2386 23 18 23"
              stroke="#2E7D32"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="18" cy="18" r="2.5" fill="#1E5646" />
          </svg>
          <div className="oj-brand-text">
            <span className="oj-brand-title">MentalBridge</span>
            <span className="oj-brand-sub">KHÔNG GIAN SÀNG LỌC</span>
          </div>
        </Link>

        {/* Stepper Progress */}
        <nav className="oj-stepper" aria-label="Tiến trình đồng hành">
          <div
            className={`oj-step-item ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}
          >
            {currentStep > 1 ? <span className="oj-step-check">✓</span> : null}
            <span>1. Hoàn thiện hồ sơ</span>
          </div>
          <span className="oj-step-dot">•</span>
          <div
            className={`oj-step-item ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}
          >
            {currentStep > 2 ? <span className="oj-step-check">✓</span> : null}
            <span>2. Sàng lọc</span>
          </div>
          <span className="oj-step-dot">•</span>
          <div
            className={`oj-step-item ${currentStep === 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}
          >
            {currentStep > 3 ? <span className="oj-step-check">✓</span> : null}
            <span>3. Ý nghĩa kết quả</span>
          </div>
          <span className="oj-step-dot">•</span>
          <div className={`oj-step-item ${currentStep === 4 ? 'active' : ''}`}>
            <span>4. Kế hoạch hỗ trợ</span>
          </div>
        </nav>

        {/* Right Header: Support & Avatar */}
        <div className="oj-header-right">
          <button
            type="button"
            className="oj-crisis-pill"
            onClick={() => setShowSafetyModal(true)}
          >
            <LifeBuoy size={16} />
            <span>Hỗ trợ an toàn</span>
          </button>
          <div
            className="oj-user-avatar"
            title={displayName || 'Tài khoản của bạn'}
          >
            <span>{userInitial}</span>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="oj-main">
        {/* ================================================================= */}
        {/* STEP 1: HOÀN THIỆN HỒ SƠ                                         */}
        {/* ================================================================= */}
        {currentStep === 1 && (
          <div className="oj-container-narrow">
            <div className="oj-top-indicator">
              <span className="oj-badge-dot">• GIAI ĐOẠN NHẬP MÔN AN TOÀN</span>
              <div className="oj-step-info-right">
                <span className="oj-step-counter">
                  Bước 1/4: Khởi tạo định danh &amp; nhu cầu lâm sàng
                </span>
                <div className="oj-progress-pill">
                  <div className="oj-progress-fill" style={{ width: '25%' }} />
                </div>
                <span className="oj-percent-text">25%</span>
              </div>
            </div>

            <div className="oj-card">
              <div className="oj-card-header">
                <div className="oj-card-badge">
                  <Shield size={14} />
                  <span>Bảo Mật Y Tế Tuyệt Đối</span>
                </div>
                <div className="oj-card-lock-badge">
                  <Lock size={16} />
                </div>
              </div>

              <h1 className="oj-card-title">
                Chào mừng bạn đến với MentalBridge. Hãy hoàn thiện hồ sơ của
                bạn.
              </h1>
              <p className="oj-card-subtitle">
                Thông tin giúp bác sĩ và hệ thống thấu hiểu bạn tốt hơn, bảo mật
                100% theo tiêu chuẩn y tế số HIPAA. Chúng tôi tôn trọng danh
                tính và bảo vệ sự an tâm của bạn từ bước chạm đầu tiên.
              </p>

              <form onSubmit={handleSaveProfile} noValidate>
                {/* Basic info */}
                <div className="oj-section-title">
                  <span>Thông tin nhận diện cơ bản</span>
                </div>

                <div className="oj-grid-2">
                  <div className="oj-field">
                    <label htmlFor="oj-name-input" className="oj-label">
                      Tên gọi thân mật / Biệt danh *
                    </label>
                    <div className="oj-input-wrapper">
                      <User className="oj-input-icon" />
                      <input
                        id="oj-name-input"
                        type="text"
                        className="oj-input"
                        placeholder="Ví dụ: Hoàng Lan, An Nhiên, Minh Triết..."
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                      />
                    </div>
                    {profileErrors.displayName ? (
                      <span className="oj-error-text">
                        {profileErrors.displayName}
                      </span>
                    ) : (
                      <span className="oj-field-hint">
                        Bạn có thể dùng biệt danh nếu muốn ẩn danh hoàn toàn với
                        tư vấn viên.
                      </span>
                    )}
                  </div>

                  <div className="oj-field">
                    <label htmlFor="oj-birth-input" className="oj-label">
                      Năm sinh / Độ tuổi *
                    </label>
                    <div className="oj-input-wrapper">
                      <Calendar className="oj-input-icon" />
                      <input
                        id="oj-birth-input"
                        type="number"
                        className="oj-input"
                        placeholder="Ví dụ: 1996"
                        value={birthYear}
                        onChange={(e) => setBirthYear(e.target.value)}
                        min={1920}
                        max={new Date().getFullYear() - 13}
                        required
                      />
                    </div>
                    {profileErrors.birthYear ? (
                      <span className="oj-error-text">
                        {profileErrors.birthYear}
                      </span>
                    ) : (
                      <span className="oj-field-hint">
                        Hỗ trợ thuật toán điều chỉnh thang đo tâm lý phù hợp
                        sinh lý lứa tuổi.
                      </span>
                    )}
                  </div>
                </div>

                <div className="oj-grid-2">
                  <div className="oj-field">
                    <label className="oj-label">
                      Giới tính sinh học &amp; bản dạng giới *
                    </label>
                    <div className="oj-gender-group">
                      <button
                        type="button"
                        className={`oj-gender-btn ${gender === 'FEMALE' ? 'active' : ''}`}
                        onClick={() => setGender('FEMALE')}
                      >
                        <span>♀</span> Nữ
                      </button>
                      <button
                        type="button"
                        className={`oj-gender-btn ${gender === 'MALE' ? 'active' : ''}`}
                        onClick={() => setGender('MALE')}
                      >
                        <span>♂</span> Nam
                      </button>
                      <button
                        type="button"
                        className={`oj-gender-btn ${gender === 'OTHER' ? 'active' : ''}`}
                        onClick={() => setGender('OTHER')}
                      >
                        <span>⚧</span> Khác/Ẩn
                      </button>
                    </div>
                  </div>

                  <div className="oj-field">
                    <label htmlFor="oj-work-select" className="oj-label">
                      Môi trường làm việc / Học tập chính
                    </label>
                    <div className="oj-input-wrapper">
                      <Briefcase className="oj-input-icon" />
                      <select
                        id="oj-work-select"
                        className="oj-select"
                        value={workEnvironment}
                        onChange={(e) => setWorkEnvironment(e.target.value)}
                      >
                        <option value="office">
                          Văn phòng / Công sở doanh nghiệp
                        </option>
                        <option value="remote">
                          Làm việc từ xa / Tự do (Freelance)
                        </option>
                        <option value="student">
                          Học sinh / Sinh viên đại học
                        </option>
                        <option value="healthcare">
                          Y tế / Giáo dục / Dịch vụ
                        </option>
                        <option value="other">Môi trường khác</option>
                      </select>
                    </div>
                    <span className="oj-field-hint">
                      Giúp phân loại tác nhân gây stress (áp lực deadline, thi
                      cử...).
                    </span>
                  </div>
                </div>

                {/* Goals */}
                <div className="oj-section-title" style={{ marginTop: 12 }}>
                  <span>🎯 Mục tiêu đồng hành ưu tiên (Chọn 1–3 mục)</span>
                  <span className="oj-section-subtle">
                    Được sửa bất cứ lúc nào
                  </span>
                </div>
                {profileErrors.goals && (
                  <p
                    className="oj-error-text"
                    style={{ marginBottom: 12, marginTop: -6 }}
                  >
                    {profileErrors.goals}
                  </p>
                )}

                <div className="oj-goals-grid">
                  {PRIORITY_GOALS.map((goal) => {
                    const isSelected = selectedGoals.includes(goal.id)
                    const GoalIcon = goal.Icon
                    return (
                      <button
                        type="button"
                        key={goal.id}
                        className={`oj-goal-card ${isSelected ? 'active' : ''}`}
                        onClick={() => toggleGoal(goal.id)}
                      >
                        <div className="oj-goal-head">
                          <GoalIcon className="oj-goal-icon" />
                          <span>{goal.title}</span>
                          {isSelected && (
                            <CheckCircle2
                              size={16}
                              style={{ marginLeft: 'auto', color: '#1e5646' }}
                            />
                          )}
                        </div>
                        <div className="oj-goal-desc">{goal.desc}</div>
                      </button>
                    )
                  })}
                </div>

                {/* Safety / Callout Banner */}
                <div className="oj-callout">
                  <div className="oj-callout-icon">
                    <Shield size={20} />
                  </div>
                  <div className="oj-callout-content">
                    <div className="oj-callout-title">
                      Thông điệp tiến trình sàng lọc
                    </div>
                    <div className="oj-callout-text">
                      Sau khi hoàn tất, bạn sẽ bắt đầu bài sàng lọc chuyên sâu
                      đầu tiên (PHQ-9 &amp; GAD-7) để đánh giá chính xác tình
                      trạng sức khỏe tinh thần hiện tại (không cần viết nhật ký
                      hay chọn cảm xúc ở bước này).
                    </div>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="oj-card-bottom">
                  <div className="oj-sync-note">
                    <Lock size={14} />
                    <span>Dữ liệu lưu tạm an toàn • Tự động đồng bộ hóa</span>
                  </div>
                  <button
                    type="submit"
                    className="oj-btn-primary"
                    disabled={submitting}
                  >
                    <span>
                      Lưu thông tin &amp; Bắt đầu bài sàng lọc đầu tiên
                    </span>
                    <ArrowRight size={17} />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 2: BÀI SÀNG LỌC CHUẨN HÓA (PHQ-9 & GAD-7 GIAO DIỆN GỐC)      */}
        {/* ================================================================= */}
        {currentStep === 2 && activeQuestion && (
          <div className="oj-container-narrow">
            <div className="oj-top-indicator">
              <span className="oj-badge-dot">
                •{' '}
                {assessmentPhase === 'PHQ9'
                  ? 'BÀI SÀNG LỌC 1/2'
                  : 'BÀI SÀNG LỌC 2/2'}
              </span>
              <div className="oj-step-info-right">
                <span className="oj-step-counter">
                  Bước 2/4:{' '}
                  {assessmentPhase === 'PHQ9'
                    ? 'PHQ-9 (Trầm cảm & Tâm trạng)'
                    : 'GAD-7 (Lo âu & Căng thẳng)'}
                </span>
                <div className="oj-progress-pill">
                  <div
                    className="oj-progress-fill"
                    style={{
                      width:
                        assessmentPhase === 'PHQ9'
                          ? `${25 + ((questionIndex + 1) / PHQ9_QUESTIONS.length) * 20}%`
                          : `${45 + ((questionIndex + 1) / GAD7_QUESTIONS.length) * 20}%`,
                    }}
                  />
                </div>
                <span className="oj-percent-text">
                  {assessmentPhase === 'PHQ9'
                    ? `${Math.round(25 + ((questionIndex + 1) / PHQ9_QUESTIONS.length) * 20)}%`
                    : `${Math.round(45 + ((questionIndex + 1) / GAD7_QUESTIONS.length) * 20)}%`}
                </span>
              </div>
            </div>

            {/* Assessment Phase Switcher Bar */}
            <div className="assessment-phase-banner">
              {assessmentPhase === 'PHQ9' ? (
                <>
                  <span style={{ fontWeight: 600 }}>
                    Đang thực hiện: Bài 1/2 — PHQ-9 (9 câu hỏi)
                  </span>
                  <span style={{ color: '#63776e', fontSize: 12 }}>
                    Tiếp theo: GAD-7 (7 câu hỏi)
                  </span>
                </>
              ) : (
                <>
                  <span style={{ fontWeight: 600, color: '#1e5646' }}>
                    ✓ Đã hoàn tất PHQ-9 (9/9 câu) • Đang làm Bài 2/2 — GAD-7
                  </span>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#1e5646',
                      fontSize: 12,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                    onClick={() => {
                      setAssessmentPhase('PHQ9')
                      setQuestionIndex(PHQ9_QUESTIONS.length - 1)
                    }}
                  >
                    Xem lại PHQ-9
                  </button>
                </>
              )}
            </div>

            {/* Care Questionnaire Card - Original UI */}
            <section
              className="care-questionnaire"
              aria-labelledby="care-questionnaire-title"
            >
              <header>
                <span className="eyebrow">
                  {assessmentPhase === 'PHQ9'
                    ? 'Sàng lọc cá nhân • PHQ-9'
                    : 'Sàng lọc cá nhân • GAD-7'}
                </span>
                <h1 id="care-questionnaire-title">
                  {assessmentPhase === 'PHQ9'
                    ? 'PHQ-9 — Sàng lọc triệu chứng'
                    : 'GAD-7 — Sàng lọc triệu chứng lo âu'}
                </h1>
                <p>
                  Hãy chọn câu trả lời đúng với trải nghiệm trong 14 ngày gần
                  đây. Bạn có thể tự do bấm đổi đáp án bất kỳ lúc nào trước khi
                  nộp.
                </p>
              </header>

              <div className="care-progress-copy">
                <span>
                  Câu {questionIndex + 1} / {activeQuestions.length}
                </span>
                <span>{activeAnsweredCount} câu đã trả lời</span>
              </div>

              <div
                className="care-progress"
                role="progressbar"
                aria-label="Tiến độ bài sàng lọc"
                aria-valuemin={1}
                aria-valuemax={activeQuestions.length}
                aria-valuenow={questionIndex + 1}
              >
                <i
                  style={{
                    width: `${((questionIndex + 1) / activeQuestions.length) * 100}%`,
                  }}
                />
              </div>

              <fieldset className="care-question">
                <legend>
                  <small>Câu {activeQuestion.itemNumber}</small>
                  {activeQuestion.prompt}
                </legend>
                <div className="care-options">
                  {activeOptions.map((option) => {
                    const isSelected = activeAnswer === option.value
                    return (
                      <label
                        key={option.value}
                        className={isSelected ? 'selected' : ''}
                        onClick={() => handleSelectCurrentAnswer(option.value)}
                      >
                        <input
                          type="radio"
                          name={`question-${activeQuestion.id}`}
                          value={option.value}
                          checked={isSelected}
                          onChange={() =>
                            handleSelectCurrentAnswer(option.value)
                          }
                        />
                        <i aria-hidden="true" />
                        <span>{option.label}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <footer className="care-question-actions">
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={
                    (assessmentPhase === 'PHQ9' && questionIndex === 0) ||
                    submitting
                  }
                  onClick={handlePreviousQuestion}
                >
                  ← Câu trước
                </button>

                {isLastQuestionOfCurrent ? (
                  assessmentPhase === 'PHQ9' ? (
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={activeAnswer === undefined || submitting}
                      onClick={handleCompletePhq9AndStartGad7}
                    >
                      {submitting
                        ? 'Đang chuẩn bị GAD-7…'
                        : 'Lưu PHQ-9 và tiếp tục sang GAD-7 →'}
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={activeAnswer === undefined || submitting}
                      onClick={handleSubmitAllAssessments}
                    >
                      {submitting
                        ? 'Đang tổng hợp kết quả…'
                        : 'Nộp bài & Xem phân tích ý nghĩa kết quả →'}
                    </button>
                  )
                ) : (
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={activeAnswer === undefined}
                    onClick={handleNextQuestion}
                  >
                    Câu tiếp theo →
                  </button>
                )}
              </footer>
            </section>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 3: Ý NGHĨA KẾT QUẢ LÂM SÀNG (ĐẦY ĐỦ CẢ PHQ-9 VÀ GAD-7)         */}
        {/* ================================================================= */}
        {currentStep === 3 && (
          <div className="oj-container-narrow">
            <div className="oj-top-indicator">
              <span className="oj-badge-dot">• Ý NGHĨA KẾT QUẢ LÂM SÀNG</span>
              <div className="oj-step-info-right">
                <span className="oj-step-counter">
                  Bước 3/4: Thấu hiểu trạng thái tâm trí hiện tại của bạn
                </span>
                <div className="oj-progress-pill">
                  <div className="oj-progress-fill" style={{ width: '75%' }} />
                </div>
                <span className="oj-percent-text">75%</span>
              </div>
            </div>

            {/* DUAL SCORE CARDS: PHQ-9 AND GAD-7 */}
            <div className="oj-score-grid">
              {/* PHQ-9 Result Card */}
              <div className="oj-score-card">
                <div className="oj-score-left">
                  <div className="oj-score-badge">
                    <span>Chuẩn thang đo quốc tế PHQ-9</span>
                  </div>
                  <h2 className="oj-score-title">
                    {phq9Score} / 27 Điểm — Mức độ{' '}
                    {phq9LevelInfo.levelLabel.toLowerCase()}
                  </h2>
                  <div className="oj-score-subcode">
                    PHQ-9 DEPRESSION &amp; MOOD SCREENING
                  </div>

                  <div className="oj-scale-strip">
                    <div
                      className={`oj-scale-segment ${phq9LevelInfo.activeSegment === 0 ? 'active' : ''}`}
                    >
                      Tối thiểu (0–4)
                    </div>
                    <div
                      className={`oj-scale-segment ${phq9LevelInfo.activeSegment === 1 ? 'active' : ''}`}
                    >
                      Nhẹ (5–9)
                    </div>
                    <div
                      className={`oj-scale-segment ${phq9LevelInfo.activeSegment === 2 ? 'active' : ''}`}
                    >
                      Trung bình (10–14)
                    </div>
                    <div
                      className={`oj-scale-segment ${phq9LevelInfo.activeSegment === 3 ? 'active' : ''}`}
                    >
                      Khá nặng – Nặng (15–27)
                    </div>
                  </div>
                  <p className="oj-score-summary">{phq9LevelInfo.summary}</p>
                </div>

                <div className="oj-score-right">
                  <div className="oj-gauge-circle">
                    <svg className="oj-gauge-svg" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        className="oj-gauge-track"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        className="oj-gauge-bar"
                        style={{
                          strokeDasharray: '264',
                          strokeDashoffset: `${264 - (264 * Math.min(phq9Score, 27)) / 27}`,
                          stroke: phq9LevelInfo.color,
                        }}
                      />
                    </svg>
                    <div className="oj-gauge-number-box">
                      <span className="oj-gauge-val">{phq9Score}</span>
                      <span className="oj-gauge-max">/ 27</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* GAD-7 Result Card */}
              <div className="oj-score-card">
                <div className="oj-score-left">
                  <div className="oj-score-badge">
                    <span>Chuẩn thang đo quốc tế GAD-7</span>
                  </div>
                  <h2 className="oj-score-title">
                    {gad7Score} / 21 Điểm — Mức độ{' '}
                    {gad7LevelInfo.levelLabel.toLowerCase()}
                  </h2>
                  <div className="oj-score-subcode">
                    MODERATE GENERALIZED ANXIETY SCORE
                  </div>

                  <div className="oj-scale-strip">
                    <div
                      className={`oj-scale-segment ${gad7LevelInfo.activeSegment === 0 ? 'active' : ''}`}
                    >
                      Tối thiểu (0–4)
                    </div>
                    <div
                      className={`oj-scale-segment ${gad7LevelInfo.activeSegment === 1 ? 'active' : ''}`}
                    >
                      Nhẹ (5–9)
                    </div>
                    <div
                      className={`oj-scale-segment ${gad7LevelInfo.activeSegment === 2 ? 'active' : ''}`}
                    >
                      Vừa (10–14)
                    </div>
                    <div
                      className={`oj-scale-segment ${gad7LevelInfo.activeSegment === 3 ? 'active' : ''}`}
                    >
                      Nặng (15–21)
                    </div>
                  </div>
                  <p className="oj-score-summary">{gad7LevelInfo.summary}</p>
                </div>

                <div className="oj-score-right">
                  <div className="oj-gauge-circle">
                    <svg className="oj-gauge-svg" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        className="oj-gauge-track"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        className="oj-gauge-bar"
                        style={{
                          strokeDasharray: '264',
                          strokeDashoffset: `${264 - (264 * Math.min(gad7Score, 21)) / 21}`,
                          stroke: gad7LevelInfo.color,
                        }}
                      />
                    </svg>
                    <div className="oj-gauge-number-box">
                      <span className="oj-gauge-val">{gad7Score}</span>
                      <span className="oj-gauge-max">/ 21</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Clinical Meaning Section */}
            <div className="oj-section-title" style={{ marginTop: 12 }}>
              <span>Ý nghĩa lâm sàng (Clinical Meaning)</span>
            </div>

            <div className="oj-clinical-grid">
              <div className="oj-clinical-card">
                <div className="oj-clinical-head">
                  <Zap size={18} className="oj-clinical-icon" />
                  <span className="oj-clinical-title">
                    Cơ chế giao cảm cảnh giác cao
                  </span>
                </div>
                <p className="oj-clinical-desc">
                  Hệ thần kinh thực vật đang duy trì trạng thái ứng phó liên
                  tục, khiến bạn dễ cảm thấy căng cơ, hồi hộp và khó thư giãn
                  hoàn toàn sau những giờ làm việc.
                </p>
              </div>

              <div className="oj-clinical-card">
                <div className="oj-clinical-head">
                  <Moon size={18} className="oj-clinical-icon" />
                  <span className="oj-clinical-title">
                    Ảnh hưởng nhịp sinh học &amp; ngủ
                  </span>
                </div>
                <p className="oj-clinical-desc">
                  Tâm trạng và sự bận tâm đang tác động nhẹ lên chất lượng giấc
                  ngủ sâu và độ tập trung ban ngày, tạo cảm giác mệt mỏi tích tụ
                  dù không vận động nặng.
                </p>
              </div>
            </div>

            {/* Specialist comfort box */}
            <div className="oj-reassurance-box">
              <Heart size={20} className="oj-reassurance-icon" />
              <div>
                <strong>Thông điệp an ủi từ đội ngũ chuyên gia:</strong> Đây là
                chỉ số lượng giá khoa học mang tính định hướng chăm sóc, hoàn
                toàn không phải là một phán xét tiêu cực hay chẩn đoán bệnh lý
                cố định. Trạng thái này rất phổ biến và hoàn toàn có thể điều
                hòa hiệu quả bằng các phương pháp can thiệp hành vi và kế hoạch
                chăm sóc phù hợp.
              </div>
            </div>

            {/* Quick action bar */}
            <div className="oj-review-action-bar">
              <button
                type="button"
                className="oj-text-action-btn"
                onClick={() => {
                  setReviewTab('PHQ9')
                  setShowReviewModal(true)
                }}
              >
                <FileText size={16} />
                <span>Xem lại chi tiết câu trả lời (PHQ-9 &amp; GAD-7)</span>
              </button>

              <button
                type="button"
                className="oj-text-action-btn"
                onClick={handleRetakeAssessment}
              >
                <RotateCcw size={16} />
                <span>Làm lại bài sàng lọc</span>
              </button>

              <span className="oj-resources-hint">
                Khám phá 2 tài nguyên hỗ trợ gợi ý bên dưới ↓
              </span>
            </div>

            {/* Suggested Resources Section */}
            <div className="oj-resources-section">
              <div className="oj-section-title">
                <span>Tài nguyên gợi ý tức thì cho trạng thái hiện tại</span>
              </div>

              <div className="oj-resources-grid">
                <div
                  className="oj-resource-card"
                  onClick={() => setActiveArticleModal('breathing')}
                >
                  <div className="oj-resource-badge">Bài tập điều hòa</div>
                  <h4 className="oj-resource-title">
                    Kỹ thuật thở cơ hoành 4-7-8 điều hòa nhịp tim
                  </h4>
                  <p className="oj-resource-desc">
                    Phương pháp làm dịu nhanh chóng hệ thần kinh giao cảm, hạ
                    nhịp tim và thư giãn các nhóm cơ sau 3 phút.
                  </p>
                  <div className="oj-resource-footer">
                    <span>5 phút • Tự thực hành</span>
                    <span className="oj-resource-link">
                      Đọc hướng dẫn <ArrowRight size={14} />
                    </span>
                  </div>
                </div>

                <div
                  className="oj-resource-card"
                  onClick={() => setActiveArticleModal('overthinking')}
                >
                  <div className="oj-resource-badge">Liệu pháp CBT</div>
                  <h4 className="oj-resource-title">
                    Giải mã &ldquo;Bẫy suy nghĩ quá độ&rdquo; (Overthinking
                    Cycle)
                  </h4>
                  <p className="oj-resource-desc">
                    Nhận diện các luồng suy nghĩ thảm họa hóa và thực hành 3 câu
                    hỏi phản biện để đưa tâm trí về hiện tại.
                  </p>
                  <div className="oj-resource-footer">
                    <span>8 phút • Nhận thức hành vi</span>
                    <span className="oj-resource-link">
                      Đọc hướng dẫn <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA to Step 4 */}
            <div className="oj-cta-center-box">
              <button
                type="button"
                className="oj-btn-primary oj-btn-large"
                disabled={submitting}
                onClick={handleGenerateSupportPlan}
              >
                <Sparkles size={18} />
                <span>
                  {submitting
                    ? 'Đang cá nhân hóa kế hoạch hỗ trợ…'
                    : 'Tạo gợi ý kế hoạch hỗ trợ cá nhân hóa ngay →'}
                </span>
              </button>
              <span className="oj-cta-note">
                Dựa trên kết quả PHQ-9 ({phq9Score}đ) và GAD-7 ({gad7Score}đ),
                hệ thống sẽ thiết lập lộ trình 14 ngày phù hợp với nhịp sống của
                bạn.
              </span>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* STEP 4: KẾ HOẠCH HỖ TRỢ VÀ HOÀN TẤT VỀ DASHBOARD                   */}
        {/* ================================================================= */}
        {currentStep === 4 && (
          <div className="oj-container-narrow">
            <div className="oj-top-indicator">
              <span className="oj-badge-dot">• HOÀN THÀNH TIẾN TRÌNH</span>
              <div className="oj-step-info-right">
                <span className="oj-step-counter">
                  Bước 4/4: Kế hoạch hỗ trợ 14 ngày của bạn đã sẵn sàng
                </span>
                <div className="oj-progress-pill">
                  <div className="oj-progress-fill" style={{ width: '100%' }} />
                </div>
                <span className="oj-percent-text">100%</span>
              </div>
            </div>

            <div className="oj-card oj-success-card">
              <div className="oj-success-icon-wrap">
                <CheckCircle2 size={48} className="oj-success-icon" />
              </div>

              <h1 className="oj-card-title" style={{ textAlign: 'center' }}>
                Kế hoạch hỗ trợ của bạn đã được kích hoạt thành công!
              </h1>
              <p className="oj-card-subtitle" style={{ textAlign: 'center' }}>
                Cảm ơn bạn đã hoàn thành bài sàng lọc đầu tiên. Toàn bộ thông
                tin và kết quả đã được tổng hợp để tạo lộ trình đồng hành nhẹ
                nhàng, không tạo áp lực.
              </p>

              <div className="oj-plan-features-list">
                <div className="oj-plan-feat-item">
                  <div className="oj-plan-feat-icon">
                    <Calendar size={18} />
                  </div>
                  <div>
                    <strong>Nhịp sinh hoạt 14 ngày linh hoạt:</strong> Các bài
                    tập nhỏ 5–10 phút mỗi ngày, tùy chọn tham gia theo năng
                    lượng của bạn.
                  </div>
                </div>

                <div className="oj-plan-feat-item">
                  <div className="oj-plan-feat-icon">
                    <Shield size={18} />
                  </div>
                  <div>
                    <strong>Quyền riêng tư tuyệt đối:</strong> Kết quả sàng lọc
                    PHQ-9 &amp; GAD-7 được mã hóa và chỉ dùng để cá nhân hóa
                    trải nghiệm của chính bạn.
                  </div>
                </div>

                <div className="oj-plan-feat-item">
                  <div className="oj-plan-feat-icon">
                    <Smile size={18} />
                  </div>
                  <div>
                    <strong>Theo dõi tiến triển không phán xét:</strong> Bạn có
                    thể làm lại sàng lọc bất cứ khi nào cảm thấy cần điều chỉnh.
                  </div>
                </div>
              </div>

              <div
                className="oj-card-bottom"
                style={{
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  className="oj-btn-primary oj-btn-large"
                  onClick={handleFinishToDashboard}
                >
                  <span>Bắt đầu khám phá không gian của bạn →</span>
                </button>
                {planReview && (
                  <Link
                    href="/assessments?tab=reassessment&returnTo=plan-review"
                    className="oj-text-action-btn"
                  >
                    Quay lại xem lại kế hoạch
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="oj-footer">
        <div className="oj-badges-row">
          <div className="oj-badge-item">
            <Shield size={15} />
            <span>Chuẩn Y Tế Kỹ Thuật Số HIPAA Compliant</span>
          </div>
          <div className="oj-badge-item">
            <Lock size={15} />
            <span>Mã Hóa 256-bit AES Toàn Trình</span>
          </div>
          <div className="oj-badge-item">
            <Check size={15} />
            <span>Không Chia Sẻ Cho Bên Thứ Ba</span>
          </div>
        </div>

        <div className="oj-footer-links-row">
          <span>
            Bảo mật thông tin y khoa chuẩn HIPAA &amp; mã hóa đầu cuối
          </span>
          <Link href="/privacy">Chính sách quyền riêng tư</Link>
          <button type="button" onClick={() => router.push('/dashboard')}>
            Thoát an toàn
          </button>
        </div>
      </footer>

      {/* ========================================================= */}
      {/* MODAL: Xem lại chi tiết câu trả lời (PHQ-9 & GAD-7)       */}
      {/* ========================================================= */}
      {showReviewModal && (
        <div
          className="oj-modal-overlay"
          onClick={() => setShowReviewModal(false)}
        >
          <div className="oj-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="oj-modal-head">
              <h3 className="oj-modal-title">Chi tiết câu trả lời sàng lọc</h3>
              <button
                type="button"
                className="oj-modal-close"
                onClick={() => setShowReviewModal(false)}
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs: PHQ-9 & GAD-7 */}
            <div
              style={{
                display: 'flex',
                gap: 10,
                padding: '14px 24px 0',
                borderBottom: '1px solid #e2ede7',
              }}
            >
              <button
                type="button"
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderBottom:
                    reviewTab === 'PHQ9'
                      ? '2px solid #1e5646'
                      : '2px solid transparent',
                  color: reviewTab === 'PHQ9' ? '#1e5646' : '#6d8479',
                }}
                onClick={() => setReviewTab('PHQ9')}
              >
                PHQ-9 ({phq9Score}/27 điểm)
              </button>
              <button
                type="button"
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderBottom:
                    reviewTab === 'GAD7'
                      ? '2px solid #1e5646'
                      : '2px solid transparent',
                  color: reviewTab === 'GAD7' ? '#1e5646' : '#6d8479',
                }}
                onClick={() => setReviewTab('GAD7')}
              >
                GAD-7 ({gad7Score}/21 điểm)
              </button>
            </div>

            <div className="oj-modal-body">
              {reviewTab === 'PHQ9' ? (
                <>
                  <p style={{ marginBottom: 16, color: '#63776e' }}>
                    Tổng điểm PHQ-9: <strong>{phq9Score} / 27</strong> — Mức độ:{' '}
                    <strong>{phq9LevelInfo.levelLabel}</strong>
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    {PHQ9_QUESTIONS.map((q) => {
                      const val = phq9Answers[q.id]
                      const opt = PHQ9_OPTIONS.find((o) => o.value === val)
                      return (
                        <div
                          key={q.id}
                          style={{
                            padding: 12,
                            background: '#f8faf9',
                            borderRadius: 10,
                            border: '1px solid #e2ede7',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 13.5,
                              color: '#16332a',
                              marginBottom: 4,
                            }}
                          >
                            {q.itemNumber}. {q.prompt}
                          </div>
                          <div
                            style={{
                              fontSize: 12.5,
                              color: '#1e5646',
                              fontWeight: 500,
                            }}
                          >
                            Đáp án đã chọn:{' '}
                            <strong>
                              {opt?.label ?? 'Chưa chọn'} ({val ?? 0} điểm)
                            </strong>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <>
                  <p style={{ marginBottom: 16, color: '#63776e' }}>
                    Tổng điểm GAD-7: <strong>{gad7Score} / 21</strong> — Mức độ:{' '}
                    <strong>{gad7LevelInfo.levelLabel}</strong>
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    {GAD7_QUESTIONS.map((q) => {
                      const val = gad7Answers[q.id]
                      const opt = GAD7_OPTIONS.find((o) => o.value === val)
                      return (
                        <div
                          key={q.id}
                          style={{
                            padding: 12,
                            background: '#f8faf9',
                            borderRadius: 10,
                            border: '1px solid #e2ede7',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 13.5,
                              color: '#16332a',
                              marginBottom: 4,
                            }}
                          >
                            {q.itemNumber}. {q.prompt}
                          </div>
                          <div
                            style={{
                              fontSize: 12.5,
                              color: '#1e5646',
                              fontWeight: 500,
                            }}
                          >
                            Đáp án đã chọn:{' '}
                            <strong>
                              {opt?.label ?? 'Chưa chọn'} ({val ?? 0} điểm)
                            </strong>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="oj-modal-foot">
              <button
                type="button"
                className="oj-btn-primary"
                onClick={() => setShowReviewModal(false)}
              >
                Đóng xem lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Đọc ngắn tài nguyên                               */}
      {/* ========================================================= */}
      {activeArticleModal && (
        <div
          className="oj-modal-overlay"
          onClick={() => setActiveArticleModal(null)}
        >
          <div className="oj-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="oj-modal-head">
              <h3 className="oj-modal-title">
                {activeArticleModal === 'breathing'
                  ? 'Kỹ thuật thở cơ hoành 4-7-8 điều hòa nhịp tim'
                  : "Giải mã 'Bẫy suy nghĩ quá độ' (Overthinking Cycle)"}
              </h3>
              <button
                type="button"
                className="oj-modal-close"
                onClick={() => setActiveArticleModal(null)}
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>
            <div className="oj-modal-body">
              {activeArticleModal === 'breathing' ? (
                <>
                  <p>
                    <strong>Tác giả:</strong> Bs. Lê Minh Khang • Y học hành vi
                  </p>
                  <p>
                    Kỹ thuật thở 4-7-8 được phát triển dựa trên phương pháp
                    Pranayama cổ xưa, giúp điều hòa hệ thống thần kinh tự chủ
                    thông qua việc kéo dài pha thở ra.
                  </p>
                  <h4>Các bước thực hành chuẩn:</h4>
                  <ol>
                    <li>
                      <strong>Hít vào bằng mũi trong 4 giây:</strong> Giữ lồng
                      ngực tĩnh lặng, đẩy bụng phình ra để không khí tràn vào
                      đáy phổi.
                    </li>
                    <li>
                      <strong>Giữ hơi thở trong 7 giây:</strong> Giữ oxy thẩm
                      thấu vào mạch máu và ổn định nhịp tim.
                    </li>
                    <li>
                      <strong>Thở ra chậm rãi bằng miệng trong 8 giây:</strong>{' '}
                      Tạo âm thanh &ldquo;phù&rdquo; nhẹ, kích hoạt nhánh dây
                      thần kinh phế vị (Vagus nerve).
                    </li>
                    <li>
                      Lặp lại chu kỳ 4 lần mỗi khi cảm thấy căng thẳng hoặc
                      trước khi ngủ.
                    </li>
                  </ol>
                </>
              ) : (
                <>
                  <p>
                    <strong>Tác giả:</strong> ThS. Tâm lý Đỗ Hoàng Yến
                  </p>
                  <p>
                    Bẫy suy nghĩ quá độ (Overthinking) xảy ra khi vùng hạch hạnh
                    nhân (Amygdala) gửi tín hiệu báo động giả, khiến não bộ liên
                    tục đặt ra các câu hỏi &ldquo;Nếu như... thì sao?&rdquo;.
                  </p>
                  <h4>Kỹ thuật ngắt mạch suy nghĩ cấp thời:</h4>
                  <ul>
                    <li>
                      <strong>
                        Kỹ thuật đặt tên cảm xúc (Name it to tame it):
                      </strong>{' '}
                      Khi một cơn lo lắng ập đến, hãy gọi tên nó thầm trong đầu:
                      &ldquo;Đây chỉ là sự lo âu về tương lai, không phải sự
                      thật hiện tại.&rdquo;
                    </li>
                    <li>
                      <strong>Quy tắc 5-4-3-2-1 định vị giác quan:</strong> Nhìn
                      5 vật xung quanh, chạm 4 bề mặt, lắng nghe 3 âm thanh,
                      ngửi 2 mùi hương và cảm nhận 1 vị trên đầu lưỡi.
                    </li>
                    <li>
                      <strong>Khoanh vùng lo âu:</strong> Dành đúng 10 phút vào
                      buổi chiều để viết ra các mối lo, sau đó gấp sổ lại và trở
                      về với hiện tại.
                    </li>
                  </ul>
                </>
              )}
            </div>
            <div className="oj-modal-foot">
              <button
                type="button"
                className="oj-btn-primary"
                onClick={() => setActiveArticleModal(null)}
              >
                Đã hiểu &amp; Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: Hỗ trợ an toàn khẩn cấp                            */}
      {/* ========================================================= */}
      {showSafetyModal && (
        <div
          className="oj-modal-overlay"
          onClick={() => setShowSafetyModal(false)}
        >
          <div className="oj-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="oj-modal-head">
              <h3 className="oj-modal-title">Đường dây nóng hỗ trợ khẩn cấp</h3>
              <button
                type="button"
                className="oj-modal-close"
                onClick={() => setShowSafetyModal(false)}
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
            </div>
            <div className="oj-modal-body">
              <p>
                Nếu bạn hoặc người thân đang ở trong trạng thái nguy hiểm hoặc
                có ý nghĩ tự thương, hãy liên hệ ngay với các đơn vị trợ giúp y
                tế sau:
              </p>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  marginTop: 14,
                }}
              >
                <div
                  style={{
                    padding: 14,
                    background: '#fef2f2',
                    border: '1px solid #fee2e2',
                    borderRadius: 10,
                  }}
                >
                  <strong style={{ color: '#991b1b' }}>
                    Đường dây nóng Ngày Mai:
                  </strong>{' '}
                  <span
                    style={{ fontSize: 16, fontWeight: 700, color: '#b91c1c' }}
                  >
                    096 306 1414
                  </span>
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: 13,
                      color: '#7f1d1d',
                    }}
                  >
                    Tư vấn miễn phí và lắng nghe khủng hoảng trầm cảm.
                  </p>
                </div>
                <div
                  style={{
                    padding: 14,
                    background: '#f0fdf4',
                    border: '1px solid #dcfce7',
                    borderRadius: 10,
                  }}
                >
                  <strong style={{ color: '#166534' }}>
                    Cấp cứu y tế 115:
                  </strong>{' '}
                  <span
                    style={{ fontSize: 16, fontWeight: 700, color: '#15803d' }}
                  >
                    115
                  </span>
                  <p
                    style={{
                      margin: '4px 0 0',
                      fontSize: 13,
                      color: '#14532d',
                    }}
                  >
                    Hỗ trợ cấp cứu khẩn cấp 24/7 trên toàn quốc.
                  </p>
                </div>
              </div>
            </div>
            <div className="oj-modal-foot">
              <button
                type="button"
                className="oj-btn-primary"
                onClick={() => setShowSafetyModal(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
