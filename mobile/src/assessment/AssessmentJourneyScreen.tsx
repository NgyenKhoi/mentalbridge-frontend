import { randomUUID } from 'expo-crypto'
import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { ScreeningQuestion } from './ScreeningQuestion'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { AppIcon } from '@/components/AppIcon'
import { Screen } from '@/components/Screen'
import { colors, radii, spacing, typography } from '@/theme/tokens'
import { useResourceFonts } from '@/resources/useResourceFonts'

import type { AssessmentApi } from './assessment-api'
import type {
  Assessment,
  AssessmentHistory,
  ConsentCollection,
  GuidedJourney,
  Instrument,
  PrivacyDisclosure,
  Questionnaire,
  SafetyDirectoryResponse,
  ScreeningEpisode,
  SupportEvaluation,
  SupportGuide,
  SupportGuideHistory,
} from './assessment-contract'

const nextActionRoutes = {
  FIND_SPECIALIST: { path: './specialists', label: 'Tìm chuyên gia phù hợp' },
  OPEN_CURRENT_PLAN: {
    path: './support-plan',
    label: 'Tiếp tục kế hoạch hiện tại',
  },
  REVIEW_PLAN_DRAFT: {
    path: './support-plan',
    label: 'Xem lại kế hoạch đang soạn',
  },
  START_PLAN_PROPOSAL: {
    path: './support-plan',
    label: 'Tiếp tục với kế hoạch hỗ trợ',
  },
  EXPLORE_GUIDE_RESOURCES: {
    path: './resources',
    label: 'Khám phá thư viện tài nguyên',
  },
} as const

function continuationFor(
  nextAction: GuidedJourney['nextAction'],
  guide: SupportGuide,
) {
  if (!nextAction || nextAction === 'REVIEW_SAFETY_SUPPORT') return null
  if (nextAction === 'FIND_SPECIALIST') {
    return {
      path: {
        pathname: './specialists' as const,
        params: { supportEvaluationId: guide.supportEvaluationId },
      },
      label: nextActionRoutes.FIND_SPECIALIST.label,
    }
  }
  const firstResource = guide.resources[0]
  if (nextAction === 'EXPLORE_GUIDE_RESOURCES' && firstResource) {
    return {
      path: `./resources/${encodeURIComponent(firstResource.resourceId)}` as const,
      label: 'Bắt đầu với bài tập đầu tiên',
    }
  }
  return nextActionRoutes[nextAction]
}

function currentNextAction(journey: GuidedJourney | null, guide: SupportGuide) {
  return journey?.supportGuideId === guide.supportGuideId
    ? journey.nextAction
    : null
}

const levelLabels = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Nặng',
} as const

const instrumentLabels: Record<Instrument, string> = {
  PHQ9: 'PHQ-9',
  GAD7: 'GAD-7',
}

type Overview = Readonly<{
  episode: ScreeningEpisode | null
  assessments: AssessmentHistory
  guides: SupportGuideHistory
  journey: GuidedJourney | null
}>

type QuestionnaireState = Readonly<{
  episode: ScreeningEpisode
  questionnaire: Questionnaire
  disclosure: PrivacyDisclosure
  consents: ConsentCollection
}>

type CompletedJourney = Readonly<{
  phq9: Assessment
  gad7: Assessment
  evaluation: SupportEvaluation
  episodeId: string
  guide: SupportGuide | null
  journey: GuidedJourney | null
}>

type HistoricalResult = Readonly<{
  assessment: Assessment
  questionnaire: Questionnaire
}>

type ViewState =
  | { name: 'overview' }
  | { name: 'questionnaire'; data: QuestionnaireState }
  | { name: 'completed'; data: CompletedJourney }
  | { name: 'assessment'; data: HistoricalResult }
  | { name: 'guide'; data: SupportGuide }

function isMissingCurrentEpisode(error: unknown) {
  return error instanceof ApiError && error.status === 404
}

function loadErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.'
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Tài khoản này không có quyền sử dụng hành trình sàng lọc cá nhân.'
  }
  return 'Chưa thể tải hành trình sàng lọc lúc này. Dữ liệu đã lưu không bị thay đổi.'
}

function mutationErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
    return 'Câu trả lời chưa đầy đủ hoặc không còn phù hợp với phiên bản câu hỏi hiện tại.'
  }
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Câu trả lời chưa được xác nhận là đã lưu.'
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Tài khoản này không có quyền gửi bài sàng lọc.'
  }
  if (
    error instanceof ApiError &&
    [
      'CARE_TIMEOUT',
      'CARE_UNAVAILABLE',
      'NETWORK_ERROR',
      'REQUEST_TIMEOUT',
    ].includes(error.code)
  ) {
    return 'Dịch vụ sàng lọc tạm thời chưa sẵn sàng. Câu trả lời chưa được xác nhận là đã lưu.'
  }
  return 'Chưa thể hoàn tất bước này. Câu trả lời chưa được xác nhận là đã lưu; hãy thử lại.'
}

function journeyErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.'
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Tài khoản này không có quyền tiếp tục hành trình sàng lọc.'
  }
  return 'Chưa thể tải bước tiếp theo từ dữ liệu đã lưu. Hãy thử lại khi kết nối ổn định.'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function directoryStateMessage(response: SafetyDirectoryResponse) {
  switch (response.state) {
    case 'EMPTY':
      return 'Chưa có cơ sở đã rà soát phù hợp cho khu vực này.'
    case 'INVALID_AREA':
      return 'Chưa nhận diện được khu vực bạn nhập. Hãy kiểm tra tên tỉnh, thành phố hoặc khu vực rồi thử lại.'
    case 'UNAVAILABLE':
      return 'Danh bạ hỗ trợ tạm thời chưa khả dụng. Hướng dẫn an toàn phía trên vẫn được giữ nguyên.'
    case 'RESULTS':
      return response.entries.length === 0
        ? 'Chưa thể hiển thị danh sách cơ sở đã rà soát. Hãy thử lại sau.'
        : null
  }
}

function SecondaryButton({
  disabled = false,
  label,
  onPress,
}: Readonly<{ disabled?: boolean; label: string; onPress: () => void }>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  )
}

function StateMessage({
  message,
  tone = 'neutral',
}: Readonly<{ message: string; tone?: 'neutral' | 'error' | 'success' }>) {
  return (
    <Text
      accessibilityLiveRegion={tone === 'neutral' ? 'polite' : 'assertive'}
      style={[
        styles.stateMessage,
        tone === 'error' && styles.errorText,
        tone === 'success' && styles.successText,
      ]}
    >
      {message}
    </Text>
  )
}

function BackButton({ onPress }: Readonly<{ onPress: () => void }>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Quay lại"
      onPress={onPress}
      style={resultStyles.back}
    >
      <AppIcon name="back" size={20} />
      <Text style={styles.secondaryLabel}>Quay lại</Text>
    </Pressable>
  )
}

function Details({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  const [expanded, setExpanded] = useState(false)
  return (
    <View style={resultStyles.details}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={resultStyles.detailsTrigger}
      >
        <Text style={resultStyles.detailsTitle}>{title}</Text>
        <View
          style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}
        >
          <AppIcon name="chevron" size={18} />
        </View>
      </Pressable>
      {expanded && <View style={resultStyles.detailsContent}>{children}</View>}
    </View>
  )
}

function ResultFacts({
  assessment,
  compact = false,
}: Readonly<{ assessment: Assessment; compact?: boolean }>) {
  return (
    <View style={[styles.resultPanel, compact && resultStyles.scoreCard]}>
      <View style={styles.resultHeader}>
        <Text style={resultStyles.instrument}>
          {instrumentLabels[assessment.instrument]}
        </Text>
        <Text style={styles.levelBadge}>
          {levelLabels[assessment.result.screeningLevel]}
        </Text>
      </View>
      <Text style={styles.score}>{assessment.result.totalScore} điểm</Text>
      <Text style={resultStyles.meta}>
        {formatDate(assessment.submittedAt)}
      </Text>
      {assessment.result.safetyStatus === 'POSITIVE_SAFETY_SCREEN' && (
        <Text accessibilityLiveRegion="assertive" style={styles.safetyText}>
          Kết quả có tín hiệu cần xem hướng dẫn an toàn bên dưới.
        </Text>
      )}
      {!compact && assessment.result.safetyStatus === 'NOT_APPLICABLE' && (
        <Text style={styles.supportingText}>
          Bộ câu hỏi này không có mục sàng lọc an toàn riêng.
        </Text>
      )}
    </View>
  )
}

export function HelpNowPanel({
  api,
  defaultTrigger,
  guidance,
  overviewCard = false,
}: Readonly<{
  api: AssessmentApi
  defaultTrigger: 'POSITIVE_ITEM_9' | 'HELP_NOW'
  guidance?: string
  overviewCard?: boolean
}>) {
  const [expanded, setExpanded] = useState(false)
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<SafetyDirectoryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const lookup = async () => {
    const normalizedLocation = location.trim()
    if (!normalizedLocation || loading) return

    setLoading(true)
    setError(null)
    setResponse(null)
    try {
      setResponse(
        await api.lookupSafetyDirectory(defaultTrigger, normalizedLocation),
      )
    } catch {
      setError(
        'Chưa thể tải danh bạ hỗ trợ. MentalBridge không tự động gọi, điều phối hoặc liên hệ bên thứ ba.',
      )
    } finally {
      setLoading(false)
    }
  }

  const directoryMessage = response ? directoryStateMessage(response) : null

  return (
    <View style={[styles.safetyPanel, overviewCard && overviewStyles.support]}>
      {overviewCard ? (
        <View style={overviewStyles.supportHeader}>
          <Text aria-hidden style={overviewStyles.heart}>
            ♥
          </Text>
          <Text accessibilityRole="header" style={overviewStyles.supportTitle}>
            Hỗ trợ an toàn &amp; khủng hoảng
          </Text>
        </View>
      ) : (
        <Text style={styles.sectionTitle}>Hỗ trợ an toàn</Text>
      )}
      {overviewCard && (
        <Text style={overviewStyles.copy}>
          Nếu bạn đang cảm thấy quá tải hoặc có ý nghĩ làm tổn thương bản thân,
          bạn có thể tìm sự hỗ trợ phù hợp với khu vực của mình.
        </Text>
      )}
      {guidance && <Text style={styles.body}>{guidance}</Text>}
      {!expanded ? (
        <PrimaryButton
          label="Tôi cần hỗ trợ ngay"
          onPress={() => setExpanded(true)}
        />
      ) : (
        <View style={styles.helpForm}>
          <Text style={styles.label}>
            Tỉnh, thành phố hoặc khu vực hiện tại
          </Text>
          <TextInput
            accessibilityLabel="Khu vực cần tìm hỗ trợ"
            editable={!loading}
            maxLength={120}
            onChangeText={setLocation}
            placeholder="Ví dụ: Thành phố Hồ Chí Minh"
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            value={location}
          />
          <PrimaryButton
            disabled={!location.trim() || loading}
            label={loading ? 'Đang tìm…' : 'Tìm hỗ trợ đã rà soát'}
            onPress={() => void lookup()}
          />
        </View>
      )}
      {error && <StateMessage message={error} tone="error" />}
      {response && (
        <View accessibilityLiveRegion="assertive" style={styles.directory}>
          <Text style={styles.body}>{response.safetyGuidance}</Text>
          <Text style={styles.supportingText}>{response.limitation}</Text>
          {directoryMessage && (
            <StateMessage
              message={directoryMessage}
              tone={response.state === 'EMPTY' ? 'neutral' : 'error'}
            />
          )}
          {response.state === 'RESULTS' &&
            response.entries.map((entry) => (
              <View key={entry.directoryEntryId} style={styles.directoryEntry}>
                <Text style={styles.itemTitle}>{entry.name}</Text>
                <Text style={styles.body}>{entry.phone}</Text>
                {entry.address && (
                  <Text style={styles.supportingText}>{entry.address}</Text>
                )}
              </View>
            ))}
        </View>
      )}
    </View>
  )
}

export function GuidePanel({
  api,
  guide,
  showSafety = true,
}: Readonly<{
  api: AssessmentApi
  guide: SupportGuide
  showSafety?: boolean
}>) {
  const positive = guide.safety.status === 'POSITIVE_SAFETY_SCREEN'
  const resourceStatus = guide.resourceResolution.status

  return (
    <View style={resultStyles.section}>
      {positive && showSafety && (
        <HelpNowPanel
          api={api}
          defaultTrigger="POSITIVE_ITEM_9"
          guidance={guide.safety.guidance}
        />
      )}

      <Details title="Gợi ý hỗ trợ sau sàng lọc">
        <Text style={styles.body}>{guide.explanation.text}</Text>
        {!positive && (
          <Text style={styles.supportingText}>{guide.safety.guidance}</Text>
        )}
      </Details>

      <View>
        <Text style={styles.sectionTitle}>Tài nguyên phù hợp</Text>
        {resourceStatus === 'STALE' && (
          <StateMessage message="Danh sách tài nguyên có thể chưa phải bản mới nhất." />
        )}
        {resourceStatus === 'UNAVAILABLE' && (
          <StateMessage
            message="Tài nguyên bổ sung tạm thời chưa khả dụng. Hướng dẫn an toàn phía trên vẫn được giữ nguyên."
            tone="error"
          />
        )}
        {guide.resources.length === 0 ? (
          <Text style={styles.supportingText}>
            Chưa có tài nguyên phù hợp cho lượt sàng lọc này.
          </Text>
        ) : (
          guide.resources.map((resource) => (
            <Pressable
              key={resource.resourceId}
              accessibilityRole="button"
              accessibilityLabel={`Mở tài nguyên: ${resource.title}`}
              onPress={() =>
                router.push(
                  `./resources/${encodeURIComponent(resource.resourceId)}`,
                )
              }
              style={resultStyles.resource}
            >
              <View style={resultStyles.resourceIcon}>
                <AppIcon name="book" size={22} />
              </View>
              <View style={resultStyles.resourceCopy}>
                <Text style={styles.itemTitle}>{resource.title}</Text>
                <Text numberOfLines={2} style={resultStyles.meta}>
                  {resource.summary}
                </Text>
              </View>
              <AppIcon name="chevron" size={18} />
            </Pressable>
          ))
        )}
      </View>

      <Details title="Thông tin bản lưu">
        <Text style={styles.supportingText}>
          Phiên bản {guide.guideVersion} · {formatDate(guide.generatedAt)}
        </Text>
      </Details>
    </View>
  )
}

function JourneyContinuation({
  guide,
  journey,
  showUnavailable = false,
  working,
  onRetry,
}: Readonly<{
  guide: SupportGuide
  journey: GuidedJourney | null
  showUnavailable?: boolean
  working: boolean
  onRetry: () => void
}>) {
  const nextAction = currentNextAction(journey, guide)
  const continuation = continuationFor(nextAction, guide)
  return (
    <>
      {continuation && (
        <View style={resultStyles.continuation}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Tiếp tục hành trình
          </Text>
          <PrimaryButton
            label={continuation.label}
            tone="dashboard"
            onPress={() => router.push(continuation.path)}
          />
        </View>
      )}
      {nextAction && journey?.entitlementStatus === 'UNAVAILABLE' && (
        <View style={styles.guidePanel}>
          <StateMessage message="Chưa kiểm tra được quyền lợi gói của bạn, nên MentalBridge gợi ý bắt đầu với các bài tập miễn phí." />
          <PrimaryButton
            disabled={working}
            label="Kiểm tra lại"
            onPress={onRetry}
          />
        </View>
      )}
      {!nextAction && showUnavailable && (
        <View style={styles.guidePanel}>
          <StateMessage
            message="Chưa tải được bước tiếp theo. Kết quả và gợi ý của bạn vẫn được lưu."
            tone="error"
          />
          <PrimaryButton disabled={working} label="Thử lại" onPress={onRetry} />
        </View>
      )}
    </>
  )
}

export function AssessmentJourneyScreen({
  api,
  reassessment = false,
  onReassessmentComplete,
}: Readonly<{
  api: AssessmentApi
  reassessment?: boolean
  onReassessmentComplete?: () => void
}>) {
  const overviewFonts = useResourceFonts()
  const { session, signOut } = useSession()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [view, setView] = useState<ViewState>({ name: 'overview' })
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [historyUnavailable, setHistoryUnavailable] = useState({
    assessments: false,
    guides: false,
  })
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [step, setStep] = useState(0)
  const [acknowledged, setAcknowledged] = useState(false)
  const consentKey = useRef(randomUUID())
  const assessmentKey = useRef(randomUUID())

  const subject = session?.subject

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [episode, assessments, guides, journey] = await Promise.allSettled([
        api.getCurrentEpisode().catch((error: unknown) => {
          if (isMissingCurrentEpisode(error)) return null
          throw error
        }),
        api.listAssessments(),
        api.listSupportGuides(),
        api.getGuidedJourney().catch(() => null),
      ])
      for (const result of [episode, assessments, guides]) {
        if (
          result.status === 'rejected' &&
          result.reason instanceof ApiError &&
          [401, 403].includes(result.reason.status ?? 0)
        )
          throw result.reason
      }
      if (episode.status === 'rejected') throw episode.reason
      setHistoryUnavailable({
        assessments: assessments.status === 'rejected',
        guides: guides.status === 'rejected',
      })
      setOverview({
        episode: episode.value,
        assessments:
          assessments.status === 'fulfilled'
            ? assessments.value
            : { items: [], hasMore: false },
        guides:
          guides.status === 'fulfilled'
            ? guides.value
            : { items: [], hasMore: false },
        journey: journey.status === 'fulfilled' ? journey.value : null,
      })
    } catch (error) {
      setLoadError(loadErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (subject) void loadOverview()
      else setLoading(false)
    }, 0)
    return () => clearTimeout(timer)
  }, [loadOverview, subject])

  const prepareQuestionnaire = async (
    episode: ScreeningEpisode,
    instrument: Instrument,
  ) => {
    const [questionnaire, disclosure, consents] = await Promise.all([
      api.getQuestionnaire(instrument),
      api.getPrivacyDisclosure(),
      api.getConsents(),
    ])
    if (questionnaire.instrument !== instrument) {
      throw new Error('Questionnaire instrument mismatch')
    }
    setAnswers({})
    setStep(0)
    setAcknowledged(false)
    assessmentKey.current = randomUUID()
    setView({
      name: 'questionnaire',
      data: { episode, questionnaire, disclosure, consents },
    })
  }

  const finishEpisode = async (episode: ScreeningEpisode) => {
    if (!episode.phq9AssessmentId || !episode.gad7AssessmentId) {
      throw new Error('Episode evidence is incomplete')
    }

    const [phq9, gad7] = await Promise.all([
      api.getAssessment(episode.phq9AssessmentId),
      api.getAssessment(episode.gad7AssessmentId),
    ])
    if (phq9.instrument !== 'PHQ9' || gad7.instrument !== 'GAD7') {
      throw new Error('Episode evidence instrument mismatch')
    }

    const outcome =
      episode.status === 'COMPLETED' && episode.presentationEvaluationId
        ? {
            episode,
            presentationEvaluation: await api.getSupportEvaluation(
              episode.presentationEvaluationId,
            ),
          }
        : await api.completeEpisode(episode.episodeId)

    if (reassessment && onReassessmentComplete) {
      onReassessmentComplete()
      return
    }

    const { guide, journey } = await prepareGuide(outcome.episode.episodeId)
    const latestGuides = await api.listSupportGuides().catch(() => null)

    setOverview((current) =>
      current
        ? {
            episode: outcome.episode,
            assessments: current.assessments,
            guides: latestGuides ?? current.guides,
            journey: journey ?? current.journey,
          }
        : current,
    )
    setView({
      name: 'completed',
      data: {
        phq9,
        gad7,
        evaluation: outcome.presentationEvaluation,
        episodeId: outcome.episode.episodeId,
        guide,
        journey,
      },
    })
  }

  const prepareGuide = async (
    episodeId: string,
    known?: SupportGuide | null,
  ) => {
    const guide =
      known ??
      (await api.ensureEpisodeSupportGuide(episodeId).catch(() => null))
    const journey = guide
      ? await api.getGuidedJourney().catch(() => null)
      : null
    return { guide, journey }
  }

  const retryJourney = async (data: CompletedJourney) => {
    setWorking(true)
    const prepared = await prepareGuide(data.episodeId, data.guide)
    setWorking(false)
    setView({
      name: 'completed',
      data: {
        ...data,
        guide: prepared.guide,
        journey: prepared.journey ?? data.journey,
      },
    })
  }

  const advanceEpisode = async (episode: ScreeningEpisode) => {
    if (!episode.phq9AssessmentId) {
      await prepareQuestionnaire(episode, 'PHQ9')
      return
    }
    if (!episode.gad7AssessmentId) {
      await prepareQuestionnaire(episode, 'GAD7')
      return
    }
    await finishEpisode(episode)
  }

  const startOrResume = async () => {
    if (working) return
    setWorking(true)
    setRuntimeError(null)
    try {
      const episode = overview?.episode ?? (await api.startEpisode())
      await advanceEpisode(episode)
    } catch (error) {
      setRuntimeError(journeyErrorMessage(error))
    } finally {
      setWorking(false)
    }
  }

  const submitQuestionnaire = async (data: QuestionnaireState) => {
    const { questionnaire, disclosure, consents, episode } = data
    if (
      working ||
      !acknowledged ||
      questionnaire.questions.some(
        (question) => answers[question.questionId] === undefined,
      )
    ) {
      return
    }

    let submissionConfirmed = false
    setWorking(true)
    setRuntimeError(null)
    try {
      const privacyGranted = consents.decisions.some(
        (decision) =>
          decision.consentType === 'PRIVACY_POLICY' &&
          decision.policyVersion === disclosure.version &&
          decision.granted,
      )
      if (!privacyGranted) {
        await api.grantPrivacyConsent(disclosure.version, consentKey.current)
      }

      await api.submitEpisodeAssessment(
        episode.episodeId,
        questionnaire.instrument,
        {
          questionnaireDefinitionId: questionnaire.definitionId,
          privacyPolicyVersion: disclosure.version,
          privacyDisclosureAcknowledged: true,
          answers: questionnaire.questions.map((question) => ({
            questionId: question.questionId,
            value: answers[question.questionId]!,
          })),
        },
        assessmentKey.current,
      )
      submissionConfirmed = true
      setAnswers({})
      setAcknowledged(false)

      const updatedEpisode = await api.getCurrentEpisode()
      await advanceEpisode(updatedEpisode)
    } catch (error) {
      setRuntimeError(
        submissionConfirmed
          ? 'Bài vừa hoàn tất đã được xác nhận lưu, nhưng chưa thể tải bước tiếp theo. Hãy quay lại và tiếp tục sau.'
          : mutationErrorMessage(error),
      )
    } finally {
      setWorking(false)
    }
  }

  const openAssessment = async (assessmentId: string) => {
    setWorking(true)
    setRuntimeError(null)
    try {
      const assessment = await api.getAssessment(assessmentId)
      const questionnaire = await api.getQuestionnaireDefinition(
        assessment.questionnaireDefinitionId,
      )
      if (
        questionnaire.definitionId !== assessment.questionnaireDefinitionId ||
        questionnaire.instrument !== assessment.instrument ||
        questionnaire.version !== assessment.questionnaireVersion ||
        questionnaire.scoringVersion !== assessment.result.scoringVersion
      ) {
        throw new Error('Historical questionnaire provenance mismatch')
      }
      setView({ name: 'assessment', data: { assessment, questionnaire } })
    } catch (error) {
      setRuntimeError(loadErrorMessage(error))
    } finally {
      setWorking(false)
    }
  }

  const openGuide = async (supportGuideId: string) => {
    setWorking(true)
    setRuntimeError(null)
    try {
      setView({
        name: 'guide',
        data: await api.getSupportGuide(supportGuideId),
      })
    } catch (error) {
      setRuntimeError(loadErrorMessage(error))
    } finally {
      setWorking(false)
    }
  }

  const returnToOverview = () => {
    setView({ name: 'overview' })
    setRuntimeError(null)
    void loadOverview()
  }

  if (!subject) {
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Sàng lọc và gợi ý hỗ trợ
        </Text>
        <StateMessage
          message="Bạn cần đăng nhập bằng tài khoản cá nhân để tiếp tục."
          tone="error"
        />
        <PrimaryButton label="Đăng nhập lại" onPress={() => void signOut()} />
      </Screen>
    )
  }

  if (loading && !overview) {
    return (
      <Screen>
        <View accessibilityLiveRegion="polite" style={styles.centeredState}>
          <ActivityIndicator
            accessibilityLabel="Đang tải hành trình sàng lọc"
            color={colors.tealDeep}
            size="large"
          />
          <Text accessibilityRole="header" style={styles.stateTitle}>
            Đang chuẩn bị hành trình
          </Text>
          <Text style={styles.supportingText}>
            MentalBridge đang tải dữ liệu đã lưu của bạn.
          </Text>
        </View>
      </Screen>
    )
  }

  if (view.name === 'questionnaire') {
    const { questionnaire, disclosure } = view.data
    const question = questionnaire.questions[step]!
    const selectedValue = answers[question.questionId]
    const isLast = step === questionnaire.questions.length - 1
    const complete = questionnaire.questions.every(
      (item) => answers[item.questionId] !== undefined,
    )

    return (
      <Screen key={step}>
        <BackButton onPress={returnToOverview} />
        <Text style={styles.eyebrow}>SÀNG LỌC CÁ NHÂN</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {questionnaire.title}
        </Text>
        <ScreeningQuestion
          questionnaire={questionnaire}
          step={step}
          selected={selectedValue}
          busy={working}
          onSelect={(value) =>
            setAnswers((current) => ({
              ...current,
              [question.questionId]: value,
            }))
          }
        />

        {isLast && (
          <View style={styles.disclosurePanel}>
            <Text style={styles.sectionTitle}>{disclosure.title}</Text>
            <Text style={styles.body}>{disclosure.content}</Text>
            <Pressable
              accessibilityLabel="Đồng ý xử lý dữ liệu sàng lọc"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acknowledged, disabled: working }}
              disabled={working}
              onPress={() => setAcknowledged((current) => !current)}
              style={({ pressed }) => [
                styles.acknowledgement,
                pressed && styles.pressed,
              ]}
            >
              <View
                aria-hidden
                style={[
                  styles.checkbox,
                  acknowledged && styles.checkboxSelected,
                ]}
              />
              <Text style={styles.body}>
                Tôi đã đọc và đồng ý cho MentalBridge xử lý dữ liệu sàng lọc
                theo nội dung trên.
              </Text>
            </Pressable>
          </View>
        )}

        {runtimeError && <StateMessage message={runtimeError} tone="error" />}

        <View style={styles.actionRow}>
          <SecondaryButton
            disabled={step === 0 || working}
            label="Câu trước"
            onPress={() => setStep((current) => current - 1)}
          />
          {isLast ? (
            <PrimaryButton
              disabled={!complete || !acknowledged || working}
              label={working ? 'Đang gửi…' : 'Hoàn tất bài này'}
              onPress={() => void submitQuestionnaire(view.data)}
            />
          ) : (
            <PrimaryButton
              disabled={selectedValue === undefined || working}
              label="Câu tiếp theo"
              onPress={() => setStep((current) => current + 1)}
            />
          )}
        </View>
      </Screen>
    )
  }

  if (view.name === 'completed') {
    const completed = view.data
    return (
      <Screen layout="dashboard">
        <BackButton onPress={returnToOverview} />
        <View style={resultStyles.header}>
          <Text style={resultStyles.completeBadge}>Đã hoàn thành 2/2 bài</Text>
          <Text accessibilityRole="header" style={resultStyles.title}>
            Bạn đã hoàn tất lượt sàng lọc
          </Text>
          <Text style={resultStyles.meta}>
            Kết quả giúp bạn hiểu mình hơn, không phải chẩn đoán y khoa.
          </Text>
        </View>
        <View style={resultStyles.scoreRow}>
          <ResultFacts compact assessment={completed.phq9} />
          <ResultFacts compact assessment={completed.gad7} />
        </View>
        {completed.guide?.safety.status === 'POSITIVE_SAFETY_SCREEN' && (
          <HelpNowPanel
            api={api}
            defaultTrigger="POSITIVE_ITEM_9"
            guidance={completed.guide.safety.guidance}
          />
        )}
        {completed.guide && (
          <JourneyContinuation
            guide={completed.guide}
            journey={completed.journey}
            showUnavailable
            working={working}
            onRetry={() => void retryJourney(completed)}
          />
        )}
        <Details title="Ý nghĩa của kết quả">
          {view.data.evaluation.evidence.map((evidence) => (
            <View key={evidence.assessmentId} style={styles.meaningItem}>
              <Text style={styles.itemTitle}>
                {instrumentLabels[evidence.instrument]}
              </Text>
              <Text style={styles.body}>{evidence.meaning.text}</Text>
              <Text style={styles.supportingText}>
                {evidence.meaning.limitation}
              </Text>
            </View>
          ))}
          <Text style={styles.itemTitle}>Bước tiếp theo</Text>
          <Text style={styles.body}>{view.data.evaluation.nextStep.text}</Text>
          <Text style={styles.supportingText}>
            {view.data.evaluation.nextStep.boundary}
          </Text>
        </Details>
        {completed.guide ? (
          <GuidePanel api={api} guide={completed.guide} showSafety={false} />
        ) : (
          <View style={styles.guidePanel}>
            <StateMessage
              message="Chưa chuẩn bị được gợi ý hỗ trợ. Kết quả sàng lọc của bạn đã được lưu."
              tone="error"
            />
            <PrimaryButton
              disabled={working}
              label="Thử lại"
              onPress={() => void retryJourney(completed)}
            />
          </View>
        )}
      </Screen>
    )
  }

  if (view.name === 'assessment') {
    return (
      <Screen>
        <BackButton onPress={returnToOverview} />
        <Text style={styles.eyebrow}>KẾT QUẢ ĐÃ LƯU</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Xem lại {instrumentLabels[view.data.assessment.instrument]}
        </Text>
        <ResultFacts assessment={view.data.assessment} />
        <View style={styles.technicalPanel}>
          <Text style={styles.sectionTitle}>Nội dung bài đã thực hiện</Text>
          <Text style={styles.supportingText}>
            Phiên bản {view.data.questionnaire.version}; nội dung được tải theo
            đúng định nghĩa bất biến đã lưu cùng kết quả.
          </Text>
          {view.data.questionnaire.questions.map((question) => (
            <Text key={question.questionId} style={styles.body}>
              {question.itemNumber}. {question.prompt}
            </Text>
          ))}
        </View>
        <Text style={styles.disclaimer}>
          Đây là kết quả sàng lọc triệu chứng, không phải chẩn đoán y khoa.
        </Text>
      </Screen>
    )
  }

  if (view.name === 'guide') {
    return (
      <Screen layout="dashboard">
        <BackButton onPress={returnToOverview} />
        <Text style={styles.eyebrow}>GỢI Ý ĐÃ LƯU</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Gợi ý hỗ trợ của bạn
        </Text>
        <Text style={styles.description}>
          Xem lại những gợi ý đã lưu từ lượt sàng lọc của bạn.
        </Text>
        <GuidePanel api={api} guide={view.data} />
        <JourneyContinuation
          guide={view.data}
          journey={overview?.journey ?? null}
          working={loading}
          onRetry={() => void loadOverview()}
        />
      </Screen>
    )
  }

  const permissionFailure =
    loadError &&
    (loadError.includes('hết hạn') || loadError.includes('không có quyền'))

  const continuing = Boolean(
    overview?.episode && overview.episode.status !== 'COMPLETED',
  )
  const startLabel =
    overview?.episode?.status === 'COMPLETED'
      ? 'Xem kết quả & bước tiếp theo'
      : continuing
        ? 'Tiếp tục lượt đang làm'
        : reassessment
          ? 'Bắt đầu lượt kiểm tra lại'
          : 'Bắt đầu lượt sàng lọc mới'
  return (
    <Screen layout="dashboard" backgroundColor="#F8F6EF">
      <View style={overviewStyles.bar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={overviewStyles.navPill}
        >
          <Text style={overviewStyles.link}>‹ Quay lại</Text>
        </Pressable>
        <Text style={overviewStyles.eyebrow}>CHĂM SÓC BẢN THÂN</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở hồ sơ cá nhân"
          onPress={() => router.push('/(user)/profile')}
          style={overviewStyles.gear}
        >
          <Text aria-hidden style={overviewStyles.link}>
            ⚙
          </Text>
        </Pressable>
      </View>
      <View style={overviewStyles.hero}>
        <Text style={overviewStyles.pill}>✓ Không gian cá nhân</Text>
        <Text
          accessibilityRole="header"
          style={[overviewStyles.title, overviewFonts && overviewStyles.serif]}
        >
          {reassessment
            ? 'Kiểm tra lại cho giai đoạn này'
            : 'Sàng lọc và gợi ý hỗ trợ'}
        </Text>
        <Text style={overviewStyles.copy}>
          Hoàn thành PHQ-9 (trầm cảm) và GAD-7 (lo âu) dựa trên trải nghiệm
          trong 14 ngày gần đây. Câu trả lời chỉ được gửi khi bạn xác nhận.
        </Text>
        <View style={overviewStyles.artFrame}>
          <Image
            source={require('../../assets/resource-covers/resource-small-steps.webp')}
            style={overviewStyles.art}
            resizeMode="cover"
            accessible={false}
          />
          <Text style={overviewStyles.artLabel}>
            ● Dành một chút thời gian cho bạn
          </Text>
        </View>
        {overview && !permissionFailure && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                working ? 'Đang chuẩn bị…' : 'Bắt đầu hoặc tiếp tục'
              }
              accessibilityState={{ disabled: working || Boolean(loadError) }}
              disabled={working || Boolean(loadError)}
              onPress={() => void startOrResume()}
              style={({ pressed }) => [
                overviewStyles.start,
                (pressed || working || loadError) && styles.pressed,
              ]}
            >
              <Text style={overviewStyles.startText}>
                {working ? 'Đang chuẩn bị…' : startLabel}
              </Text>
              <Text aria-hidden style={overviewStyles.startArrow}>
                →
              </Text>
            </Pressable>
            <View style={overviewStyles.metaRow}>
              <Text style={overviewStyles.meta}>◷ Khoảng 3–5 phút</Text>
              <Text style={overviewStyles.meta}>16 câu hỏi</Text>
            </View>
          </>
        )}
      </View>

      {loadError && (
        <View style={styles.errorPanel}>
          <StateMessage message={loadError} tone="error" />
          <PrimaryButton
            label={loadError.includes('hết hạn') ? 'Đăng nhập lại' : 'Thử lại'}
            onPress={() => {
              if (loadError.includes('hết hạn')) void signOut()
              else void loadOverview()
            }}
          />
        </View>
      )}

      {overview && !permissionFailure && (
        <>
          {loadError && (
            <StateMessage
              message="Bạn vẫn đang xem dữ liệu đã tải trước đó; hãy thử tải lại để có trạng thái mới nhất."
              tone="error"
            />
          )}
          {runtimeError && <StateMessage message={runtimeError} tone="error" />}

          <HelpNowPanel api={api} defaultTrigger="HELP_NOW" overviewCard />

          <View style={styles.sectionGap}>
            <View style={overviewStyles.historyHeader}>
              <View style={overviewStyles.historyCopy}>
                <Text
                  accessibilityRole="header"
                  style={[
                    overviewStyles.historyTitle,
                    overviewFonts && overviewStyles.serif,
                  ]}
                >
                  Kết quả sàng lọc gần đây
                </Text>
                <Text style={overviewStyles.meta}>
                  Xem lại các lượt bạn đã lưu
                </Text>
              </View>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/(user)/analytics')}
                style={overviewStyles.navPill}
              >
                <Text style={overviewStyles.link}>Biểu đồ ›</Text>
              </Pressable>
            </View>
            {historyUnavailable.assessments ? (
              <View>
                <StateMessage
                  message="Chưa tải được lịch sử kết quả. Bạn vẫn có thể tiếp tục lượt sàng lọc hiện tại."
                  tone="error"
                />
                <SecondaryButton
                  label="Tải lại lịch sử kết quả"
                  onPress={() => void loadOverview()}
                  disabled={loading || working}
                />
              </View>
            ) : overview.assessments.items.length === 0 ? (
              <Text style={styles.supportingText}>
                Bạn chưa có kết quả sàng lọc đã lưu.
              </Text>
            ) : (
              overview.assessments.items.map((assessment) => {
                const isPhq = assessment.instrument === 'PHQ9'
                const maximum = isPhq ? 27 : 21
                const { totalScore, screeningLevel } = assessment.result
                const minimum = screeningLevel === 'MINIMAL'
                const percent = Math.min(100, (totalScore / maximum) * 100)
                return (
                  <Pressable
                    accessibilityRole="button"
                    disabled={working}
                    key={assessment.assessmentId}
                    onPress={() => void openAssessment(assessment.assessmentId)}
                    style={({ pressed }) => [
                      overviewStyles.resultRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={overviewStyles.historyCopy}>
                      <View style={overviewStyles.metaRow}>
                        <Text style={overviewStyles.resultName}>
                          {instrumentLabels[assessment.instrument]} (
                          {isPhq ? 'Trầm cảm' : 'Lo âu'})
                        </Text>
                        <Text
                          style={[
                            overviewStyles.scorePill,
                            minimum && overviewStyles.minimum,
                          ]}
                        >
                          {levelLabels[screeningLevel]} ({totalScore}/{maximum})
                        </Text>
                      </View>
                      <View
                        accessibilityRole="progressbar"
                        accessibilityLabel="Điểm sàng lọc"
                        accessibilityValue={{
                          min: 0,
                          max: maximum,
                          now: totalScore,
                        }}
                        style={overviewStyles.track}
                      >
                        <View
                          style={[
                            overviewStyles.fill,
                            minimum && overviewStyles.fillMinimum,
                            { width: `${percent}%` },
                          ]}
                        />
                      </View>
                      <Text style={overviewStyles.meta}>
                        {formatDate(assessment.submittedAt)}
                      </Text>
                    </View>
                    <Text aria-hidden style={overviewStyles.chevron}>
                      ›
                    </Text>
                  </Pressable>
                )
              })
            )}
          </View>

          <View style={styles.sectionGap}>
            <Text style={styles.sectionTitle}>Gợi ý đã lưu</Text>
            {historyUnavailable.guides ? (
              <View>
                <StateMessage
                  message="Chưa tải được gợi ý đã lưu. Các gợi ý hiện có không bị thay đổi."
                  tone="error"
                />
                <SecondaryButton
                  label="Tải lại gợi ý đã lưu"
                  onPress={() => void loadOverview()}
                  disabled={loading || working}
                />
              </View>
            ) : overview.guides.items.length === 0 ? (
              <Text style={styles.supportingText}>
                Gợi ý hỗ trợ sẽ xuất hiện sau khi bạn hoàn thành đủ hai bài.
              </Text>
            ) : (
              overview.guides.items.map((guide) => (
                <Pressable
                  accessibilityRole="button"
                  disabled={working}
                  key={guide.supportGuideId}
                  onPress={() => void openGuide(guide.supportGuideId)}
                  style={({ pressed }) => [
                    styles.historyItem,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.itemTitle}>Gợi ý sau sàng lọc</Text>
                  <Text style={styles.supportingText}>
                    {formatDate(guide.generatedAt)} · Snapshot{' '}
                    {guide.guideVersion}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  title: {
    color: colors.tealDeep,
    fontSize: typography.heading,
    fontWeight: '700',
    lineHeight: typography.headingLineHeight,
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.xl,
  },
  body: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  supportingText: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  centeredState: { alignItems: 'center', gap: spacing.md },
  stateTitle: { color: colors.ink, fontSize: 22, fontWeight: '700' },
  stateMessage: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginTop: spacing.md,
  },
  errorText: { color: '#9B352D' },
  successText: { color: colors.tealDeep },
  errorPanel: { gap: spacing.md },
  sectionGap: { gap: spacing.md, marginTop: spacing.xxl },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  secondaryButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  secondaryLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.68 },
  disclosurePanel: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.panel,
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.xl,
  },
  acknowledgement: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 44,
  },
  checkbox: {
    borderColor: colors.inkFaint,
    borderRadius: 4,
    borderWidth: 2,
    height: 22,
    marginTop: 1,
    width: 22,
  },
  checkboxSelected: {
    backgroundColor: colors.tealDeep,
    borderColor: colors.tealDeep,
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  resultPanel: {
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.xl,
  },
  resultHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  levelBadge: {
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    color: colors.tealDeep,
    fontSize: 14,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  score: { color: colors.ink, fontSize: 28, fontWeight: '800' },
  safetyText: {
    color: '#8A352C',
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: typography.bodyLineHeight,
  },
  safetyPanel: {
    backgroundColor: '#F8E8DF',
    borderRadius: radii.panel,
    gap: spacing.md,
    padding: spacing.xl,
  },
  guidePanel: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.panel,
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.xl,
  },
  meaningItem: { gap: spacing.sm },
  helpForm: { gap: spacing.md },
  label: { color: colors.ink, fontSize: typography.body, fontWeight: '700' },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  directory: { gap: spacing.md },
  directoryEntry: {
    borderLeftColor: colors.terracotta,
    borderLeftWidth: 3,
    gap: spacing.xs,
    paddingLeft: spacing.md,
  },
  historyItem: {
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    gap: spacing.xs,
    minHeight: 64,
    padding: spacing.lg,
  },
  itemTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  technicalPanel: {
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  disclaimer: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xl,
  },
})

const resultStyles = StyleSheet.create({
  back: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    color: colors.tealDeep,
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
  },
  completeBadge: {
    color: colors.tealDeep,
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    fontSize: 12,
    fontWeight: '700',
  },
  meta: { color: colors.inkSoft, fontSize: 13, lineHeight: 20 },
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  scoreCard: { flex: 1, minWidth: 140, padding: spacing.lg, gap: spacing.sm },
  instrument: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  section: { gap: spacing.md, marginTop: spacing.md },
  details: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.panel,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  detailsTrigger: {
    minHeight: 52,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detailsTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', flex: 1 },
  detailsContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  continuation: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.panel,
    backgroundColor: colors.tealPale,
    marginVertical: spacing.md,
  },
  resource: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  resourceIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.control,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
})

const overviewStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  navPill: {
    minHeight: 44,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gear: {
    width: 44,
    height: 44,
    backgroundColor: '#FFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E9EBE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    backgroundColor: '#EDF3EC',
    color: '#285344',
    borderRadius: 12,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  link: { color: '#214D3D', fontSize: 13, fontWeight: '700' },
  hero: {
    backgroundColor: '#FFF',
    borderColor: '#EFEEE6',
    borderWidth: 1,
    borderRadius: 26,
    padding: 17,
    gap: 12,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: '#E7F7EF',
    color: '#245844',
    borderRadius: 14,
    overflow: 'hidden',
    paddingVertical: 4,
    paddingHorizontal: 9,
    fontSize: 11,
    fontWeight: '700',
  },
  title: { color: '#172F27', fontSize: 27, lineHeight: 33, fontWeight: '800' },
  serif: { fontFamily: 'ResourceSerif', fontWeight: 'normal' },
  copy: { color: '#465852', fontSize: 14, lineHeight: 22 },
  artFrame: {
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: '#DFE8DF',
    aspectRatio: 1.83,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: 8,
  },
  art: { ...StyleSheet.absoluteFill, height: '100%', width: '100%' },
  artLabel: {
    color: '#255344',
    backgroundColor: '#F8FCF7',
    overflow: 'hidden',
    borderRadius: 11,
    fontSize: 10,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  start: {
    backgroundColor: '#193F34',
    borderRadius: 16,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  startText: { color: '#FFF', fontSize: 15, fontWeight: '800', flex: 1 },
  startArrow: {
    color: '#FFF',
    backgroundColor: '#356457',
    overflow: 'hidden',
    borderRadius: 15,
    width: 30,
    lineHeight: 30,
    textAlign: 'center',
    fontSize: 18,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  meta: { color: '#65736A', fontSize: 12, lineHeight: 17 },
  support: {
    marginTop: 17,
    backgroundColor: '#FFF0EA',
    borderWidth: 1,
    borderColor: '#F2DDD5',
    borderRadius: 23,
    padding: 15,
  },
  supportHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  heart: {
    width: 38,
    lineHeight: 38,
    textAlign: 'center',
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#FFF',
    color: '#A53341',
    fontSize: 18,
  },
  supportTitle: {
    fontFamily: 'serif',
    fontWeight: '700',
    fontSize: 18,
    lineHeight: 24,
    color: '#42302C',
    flexShrink: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
  },
  historyCopy: { flex: 1, minWidth: 0, gap: 6 },
  historyTitle: {
    color: '#19322A',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
  },
  resultRow: {
    minHeight: 75,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#EFEEE5',
    backgroundColor: '#FFF',
    padding: 12,
  },
  resultName: { color: '#1E362C', fontWeight: '800', fontSize: 13 },
  scorePill: {
    color: '#634B25',
    backgroundColor: '#FFF1D2',
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '700',
  },
  minimum: { color: '#215843', backgroundColor: '#D9F4E7' },
  track: {
    width: '60%',
    height: 5,
    backgroundColor: '#EEF1EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: '#D89E38', borderRadius: 3 },
  fillMinimum: { backgroundColor: '#29A778' },
  chevron: { color: '#698376', fontSize: 22 },
})
