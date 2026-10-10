import { randomUUID } from 'expo-crypto'
import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { AssessmentApi } from './assessment-api'
import type {
  Assessment,
  AssessmentHistory,
  ConsentCollection,
  Instrument,
  PrivacyDisclosure,
  Questionnaire,
  SafetyDirectoryResponse,
  ScreeningEpisode,
  SupportEvaluation,
  SupportGuide,
  SupportGuideHistory,
} from './assessment-contract'

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
  guide: SupportGuide
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
  return <SecondaryButton label="← Quay lại" onPress={onPress} />
}

function ResultFacts({ assessment }: Readonly<{ assessment: Assessment }>) {
  return (
    <View style={styles.resultPanel}>
      <View style={styles.resultHeader}>
        <Text style={styles.sectionTitle}>
          {instrumentLabels[assessment.instrument]}
        </Text>
        <Text style={styles.levelBadge}>
          {levelLabels[assessment.result.screeningLevel]}
        </Text>
      </View>
      <Text style={styles.score}>{assessment.result.totalScore} điểm</Text>
      <Text style={styles.supportingText}>
        Gửi lúc {formatDate(assessment.submittedAt)} · Kết quả do hệ thống sàng
        lọc xác nhận.
      </Text>
      {assessment.result.safetyStatus === 'POSITIVE_SAFETY_SCREEN' && (
        <Text accessibilityLiveRegion="assertive" style={styles.safetyText}>
          Kết quả có tín hiệu cần xem hướng dẫn an toàn bên dưới.
        </Text>
      )}
      {assessment.result.safetyStatus === 'NOT_APPLICABLE' && (
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
}: Readonly<{
  api: AssessmentApi
  defaultTrigger: 'POSITIVE_ITEM_9' | 'HELP_NOW'
  guidance?: string
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
    <View style={styles.safetyPanel}>
      <Text style={styles.sectionTitle}>Hỗ trợ an toàn</Text>
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

function GuidePanel({
  api,
  guide,
}: Readonly<{ api: AssessmentApi; guide: SupportGuide }>) {
  const positive = guide.safety.status === 'POSITIVE_SAFETY_SCREEN'
  const resourceStatus = guide.resourceResolution.status

  return (
    <View style={styles.sectionGap}>
      {positive && (
        <HelpNowPanel
          api={api}
          defaultTrigger="POSITIVE_ITEM_9"
          guidance={guide.safety.guidance}
        />
      )}

      <View style={styles.guidePanel}>
        <Text style={styles.sectionTitle}>Gợi ý hỗ trợ sau sàng lọc</Text>
        <Text style={styles.body}>{guide.explanation.text}</Text>
        {!positive && (
          <Text style={styles.supportingText}>{guide.safety.guidance}</Text>
        )}
      </View>

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
            Chưa có tài nguyên đã rà soát phù hợp trong snapshot này.
          </Text>
        ) : (
          guide.resources.map((resource) => (
            <View key={resource.resourceId} style={styles.historyItem}>
              <Text style={styles.itemTitle}>{resource.title}</Text>
              <Text style={styles.body}>{resource.summary}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.technicalPanel}>
        <Text style={styles.itemTitle}>Thông tin kỹ thuật</Text>
        <Text style={styles.supportingText}>
          Snapshot {guide.guideVersion} · {formatDate(guide.generatedAt)}
        </Text>
      </View>
    </View>
  )
}

export function AssessmentJourneyScreen({
  api,
}: Readonly<{ api: AssessmentApi }>) {
  const { session, signOut } = useSession()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [view, setView] = useState<ViewState>({ name: 'overview' })
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [step, setStep] = useState(0)
  const [acknowledged, setAcknowledged] = useState(false)
  const consentKey = useRef(randomUUID())
  const assessmentKey = useRef(randomUUID())
  const guideKey = useRef(randomUUID())

  const subject = session?.subject

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [episode, assessments, guides] = await Promise.all([
        api.getCurrentEpisode().catch((error: unknown) => {
          if (isMissingCurrentEpisode(error)) return null
          throw error
        }),
        api.listAssessments(),
        api.listSupportGuides(),
      ])
      setOverview({ episode, assessments, guides })
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

    const latestGuides = await api.listSupportGuides()
    const storedGuide = latestGuides.items.find(
      (item) =>
        item.supportEvaluationId ===
        outcome.presentationEvaluation.supportEvaluationId,
    )
    const guide =
      storedGuide ??
      (await api.generateSupportGuide(
        phq9.assessmentId,
        gad7.assessmentId,
        guideKey.current,
      ))

    setOverview((current) =>
      current
        ? {
            episode: outcome.episode,
            assessments: current.assessments,
            guides: latestGuides,
          }
        : current,
    )
    setView({
      name: 'completed',
      data: {
        phq9,
        gad7,
        evaluation: outcome.presentationEvaluation,
        guide,
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
      <Screen>
        <BackButton onPress={returnToOverview} />
        <Text style={styles.eyebrow}>SÀNG LỌC CÁ NHÂN</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {questionnaire.title}
        </Text>
        <Text style={styles.description}>
          Chọn câu trả lời đúng với trải nghiệm trong{' '}
          {questionnaire.referencePeriodDays} ngày gần đây.
        </Text>

        <Text accessibilityLiveRegion="polite" style={styles.progressText}>
          Câu {step + 1} / {questionnaire.questions.length}
        </Text>
        <View
          accessibilityLabel="Tiến độ bài sàng lọc"
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 1,
            max: questionnaire.questions.length,
            now: step + 1,
          }}
          style={styles.progressTrack}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${((step + 1) / questionnaire.questions.length) * 100}%`,
              },
            ]}
          />
        </View>

        <View style={styles.questionPanel}>
          <Text style={styles.questionNumber}>Câu {question.itemNumber}</Text>
          <Text accessibilityRole="header" style={styles.questionText}>
            {question.prompt}
          </Text>
          <View style={styles.options}>
            {questionnaire.responseOptions.map((option) => {
              const selected = selectedValue === option.value
              return (
                <Pressable
                  accessibilityLabel={option.label}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: working }}
                  disabled={working}
                  key={option.value}
                  onPress={() =>
                    setAnswers((current) => ({
                      ...current,
                      [question.questionId]: option.value,
                    }))
                  }
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    aria-hidden
                    style={[styles.radio, selected && styles.radioSelected]}
                  />
                  <Text style={styles.optionLabel}>{option.label}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>

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
    return (
      <Screen>
        <BackButton onPress={returnToOverview} />
        <Text style={styles.eyebrow}>KẾT QUẢ SÀNG LỌC</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Bạn đã hoàn tất lượt sàng lọc
        </Text>
        <Text style={styles.description}>
          Kết quả dưới đây do hệ thống xác nhận từ đúng hai bài vừa hoàn tất.
          Đây không phải chẩn đoán y khoa.
        </Text>
        <ResultFacts assessment={view.data.phq9} />
        <ResultFacts assessment={view.data.gad7} />
        <View style={styles.guidePanel}>
          <Text style={styles.sectionTitle}>Ý nghĩa của kết quả</Text>
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
        </View>
        <View style={styles.guidePanel}>
          <Text style={styles.sectionTitle}>Bước tiếp theo</Text>
          <Text style={styles.body}>{view.data.evaluation.nextStep.text}</Text>
          <Text style={styles.supportingText}>
            {view.data.evaluation.nextStep.boundary}
          </Text>
        </View>
        <GuidePanel api={api} guide={view.data.guide} />
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
      <Screen>
        <BackButton onPress={returnToOverview} />
        <Text style={styles.eyebrow}>GỢI Ý ĐÃ LƯU</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Snapshot hỗ trợ sau sàng lọc
        </Text>
        <Text style={styles.description}>
          Đây là đúng snapshot đã được lưu cho lượt sàng lọc, không được tạo lại
          từ dữ liệu hiện tại.
        </Text>
        <GuidePanel api={api} guide={view.data} />
      </Screen>
    )
  }

  const permissionFailure =
    loadError &&
    (loadError.includes('hết hạn') || loadError.includes('không có quyền'))

  return (
    <Screen>
      <BackButton onPress={() => router.back()} />
      <Text style={styles.eyebrow}>CHĂM SÓC BẢN THÂN</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Sàng lọc và gợi ý hỗ trợ
      </Text>
      <Text style={styles.description}>
        Hoàn thành PHQ-9 rồi GAD-7 theo nội dung đã được duyệt. Câu trả lời chỉ
        được gửi khi bạn xác nhận và không được lưu vào hồ sơ hay phân tích khác
        trên thiết bị.
      </Text>

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
          <View style={styles.heroPanel}>
            <Text style={styles.sectionTitle}>
              {overview.episode && overview.episode.status !== 'COMPLETED'
                ? 'Tiếp tục lượt đang làm'
                : 'Bắt đầu lượt sàng lọc'}
            </Text>
            <Text style={styles.body}>
              Hai bài hỏi về trải nghiệm trong 14 ngày gần đây. Kết quả dùng để
              đưa ra gợi ý hỗ trợ, không thay thế đánh giá chuyên môn.
            </Text>
            <PrimaryButton
              disabled={working || Boolean(loadError)}
              label={working ? 'Đang chuẩn bị…' : 'Bắt đầu hoặc tiếp tục'}
              onPress={() => void startOrResume()}
            />
          </View>

          {runtimeError && <StateMessage message={runtimeError} tone="error" />}

          <HelpNowPanel api={api} defaultTrigger="HELP_NOW" />

          <View style={styles.sectionGap}>
            <Text style={styles.sectionTitle}>Kết quả gần đây</Text>
            {overview.assessments.items.length === 0 ? (
              <Text style={styles.supportingText}>
                Bạn chưa có kết quả sàng lọc đã lưu.
              </Text>
            ) : (
              overview.assessments.items.map((assessment) => (
                <Pressable
                  accessibilityRole="button"
                  disabled={working}
                  key={assessment.assessmentId}
                  onPress={() => void openAssessment(assessment.assessmentId)}
                  style={({ pressed }) => [
                    styles.historyItem,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.itemTitle}>
                    {instrumentLabels[assessment.instrument]} ·{' '}
                    {levelLabels[assessment.result.screeningLevel]}
                  </Text>
                  <Text style={styles.supportingText}>
                    {formatDate(assessment.submittedAt)}
                  </Text>
                </Pressable>
              ))
            )}
          </View>

          <View style={styles.sectionGap}>
            <Text style={styles.sectionTitle}>Gợi ý đã lưu</Text>
            {overview.guides.items.length === 0 ? (
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
    color: colors.ink,
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
  heroPanel: {
    backgroundColor: colors.surface,
    borderRadius: radii.shell,
    gap: spacing.lg,
    padding: spacing.xl,
  },
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
  progressText: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  progressTrack: {
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    height: 8,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  progressFill: { backgroundColor: colors.tealDeep, height: 8 },
  questionPanel: {
    backgroundColor: colors.surface,
    borderRadius: radii.shell,
    padding: spacing.xl,
  },
  questionNumber: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  questionText: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
  },
  options: { gap: spacing.md, marginTop: spacing.xl },
  option: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  optionSelected: {
    backgroundColor: colors.tealPale,
    borderColor: colors.tealDeep,
  },
  radio: {
    borderColor: colors.inkFaint,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 20,
    width: 20,
  },
  radioSelected: {
    backgroundColor: colors.tealDeep,
    borderColor: colors.tealDeep,
  },
  optionLabel: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
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
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.xl,
  },
  resultHeader: {
    alignItems: 'center',
    flexDirection: 'row',
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
