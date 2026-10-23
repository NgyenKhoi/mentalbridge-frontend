import { randomUUID } from 'expo-crypto'
import { router } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { AnonymousAssessmentApi } from './anonymous-assessment-api'
import type {
  AnonymousAssessment,
  AnonymousSession,
  Instrument,
  PrivacyDisclosure,
  Questionnaire,
} from './assessment-contract'

type Definitions = Readonly<{
  disclosure: PrivacyDisclosure
  questionnaires: Record<Instrument, Questionnaire>
}>

type Phase = 'loading' | 'entry' | 'question' | 'reading' | 'result' | 'expired'

const instrumentLabels: Record<Instrument, string> = {
  PHQ9: 'PHQ-9',
  GAD7: 'GAD-7',
}

const instrumentDescriptions: Record<Instrument, string> = {
  PHQ9: 'Trải nghiệm trầm buồn · 9 câu',
  GAD7: 'Trải nghiệm lo âu · 7 câu',
}

const levelLabels: Record<
  AnonymousAssessment['result']['screeningLevel'],
  string
> = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Vừa',
  MODERATELY_SEVERE: 'Khá nghiêm trọng',
  SEVERE: 'Nghiêm trọng',
}

function friendlyError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Chưa thể hoàn tất yêu cầu. Vui lòng thử lại.'
  }
  if (error.status === 429) {
    return 'Có quá nhiều yêu cầu. Vui lòng chờ một chút rồi chủ động thử lại.'
  }
  if (error.status === 409) {
    return 'Lượt gửi này đang xung đột với trạng thái trên máy chủ. Vui lòng chủ động thử lại.'
  }
  if (error.status === 400) {
    return 'Máy chủ chưa chấp nhận câu trả lời. Hãy kiểm tra lại trước khi gửi.'
  }
  return error.message
}

function isUnavailableSession(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 401 ||
      error.status === 404 ||
      error.status === 410 ||
      error.code === 'INVALID_ANONYMOUS_SESSION' ||
      error.code === 'ANONYMOUS_SESSION_EXPIRED')
  )
}

function SecondaryButton({
  disabled = false,
  label,
  onPress,
}: Readonly<{
  disabled?: boolean
  label: string
  onPress: () => void
}>) {
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
      <Text style={styles.secondaryButtonLabel}>{label}</Text>
    </Pressable>
  )
}

function StateMessage({ message }: Readonly<{ message: string }>) {
  return (
    <View accessibilityRole="alert" style={[styles.panel, styles.errorPanel]}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  )
}

export function AnonymousAssessmentScreen({
  api,
  createIdempotencyKey = randomUUID,
}: Readonly<{
  api: AnonymousAssessmentApi
  createIdempotencyKey?: () => string
}>) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [definitions, setDefinitions] = useState<Definitions | null>(null)
  const [selectedInstrument, setSelectedInstrument] =
    useState<Instrument>('PHQ9')
  const [acknowledged, setAcknowledged] = useState(false)
  const [session, setSession] = useState<AnonymousSession | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [step, setStep] = useState(0)
  const [assessmentId, setAssessmentId] = useState<string | null>(null)
  const [result, setResult] = useState<AnonymousAssessment | null>(null)
  const [working, setWorking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const submissionKey = useRef<string | null>(null)

  const clearEphemeralState = useCallback(() => {
    setSession(null)
    setAnswers({})
    setStep(0)
    setAssessmentId(null)
    setResult(null)
    submissionKey.current = null
  }, [])

  const loadDefinitions = useCallback(async () => {
    setWorking(true)
    setError(null)
    try {
      const [phq9, gad7, disclosure] = await Promise.all([
        api.getQuestionnaire('PHQ9'),
        api.getQuestionnaire('GAD7'),
        api.getPrivacyDisclosure(),
      ])
      setDefinitions({
        disclosure,
        questionnaires: { PHQ9: phq9, GAD7: gad7 },
      })
      setPhase('entry')
    } catch (loadError) {
      setError(friendlyError(loadError))
      setPhase('loading')
    } finally {
      setWorking(false)
    }
  }, [api])

  useEffect(() => {
    void Promise.resolve().then(loadDefinitions)
  }, [loadDefinitions])

  const questionnaire = definitions?.questionnaires[selectedInstrument] ?? null
  const question = questionnaire?.questions[step] ?? null
  const answerCount = Object.keys(answers).length
  const isLastQuestion = Boolean(
    questionnaire && step === questionnaire.questions.length - 1,
  )

  const answerPayload = useMemo(
    () =>
      questionnaire?.questions.flatMap((item) => {
        const value = answers[item.questionId]
        return value === undefined
          ? []
          : [{ questionId: item.questionId, value }]
      }) ?? [],
    [answers, questionnaire],
  )

  const expireSession = useCallback(() => {
    clearEphemeralState()
    setError(null)
    setPhase('expired')
  }, [clearEphemeralState])

  const start = async () => {
    if (!acknowledged || !questionnaire) return
    setWorking(true)
    setError(null)
    clearEphemeralState()
    try {
      const created = await api.createSession()
      setSession(created)
      setPhase('question')
    } catch (startError) {
      setError(friendlyError(startError))
    } finally {
      setWorking(false)
    }
  }

  const readResult = useCallback(
    async (activeSession: AnonymousSession, activeAssessmentId: string) => {
      setWorking(true)
      setError(null)
      setPhase('reading')
      try {
        const assessment = await api.getAssessment(
          activeSession,
          activeAssessmentId,
        )
        setResult(assessment)
        setPhase('result')
      } catch (readError) {
        if (isUnavailableSession(readError)) {
          expireSession()
        } else {
          setError(friendlyError(readError))
          setPhase('reading')
        }
      } finally {
        setWorking(false)
      }
    },
    [api, expireSession],
  )

  const submit = async () => {
    if (
      !definitions ||
      !questionnaire ||
      !session ||
      answerPayload.length !== questionnaire.questions.length
    ) {
      return
    }
    setWorking(true)
    setError(null)
    submissionKey.current ??= createIdempotencyKey()
    try {
      const accepted = await api.submitAssessment(
        session,
        {
          questionnaireDefinitionId: questionnaire.definitionId,
          privacyPolicyVersion: definitions.disclosure.version,
          privacyDisclosureAcknowledged: true,
          answers: answerPayload,
        },
        submissionKey.current,
      )
      setAssessmentId(accepted.assessmentId)
      await readResult(session, accepted.assessmentId)
    } catch (submitError) {
      if (isUnavailableSession(submitError)) {
        expireSession()
      } else {
        setError(friendlyError(submitError))
      }
    } finally {
      setWorking(false)
    }
  }

  const freshStart = () => {
    clearEphemeralState()
    setAcknowledged(false)
    setError(null)
    setPhase(definitions ? 'entry' : 'loading')
  }

  if (phase === 'loading') {
    return (
      <Screen>
        <Text style={styles.eyebrow}>SÀNG LỌC ẨN DANH</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {working ? 'Đang tải nội dung đã công bố…' : 'Chưa tải được nội dung'}
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.description}>
          MentalBridge cần tải bộ câu hỏi và công bố quyền riêng tư hiện hành từ
          máy chủ trước khi bạn bắt đầu.
        </Text>
        {error && <StateMessage message={error} />}
        {!working && (
          <PrimaryButton
            label="Thử lại"
            onPress={() => void loadDefinitions()}
          />
        )}
        <SecondaryButton label="Trở về" onPress={() => router.back()} />
      </Screen>
    )
  }

  if (phase === 'expired') {
    return (
      <Screen>
        <Text style={styles.eyebrow}>PHIÊN ĐÃ KẾT THÚC</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Kết quả tạm thời không còn truy cập được
        </Text>
        <Text style={styles.description}>
          Phiên ẩn danh đã hết hạn hoặc không còn hợp lệ. Câu trả lời, mã phiên
          và kết quả cũ đã được xóa khỏi ứng dụng.
        </Text>
        <StateMessage message="Để bảo vệ ranh giới phiên, MentalBridge không khôi phục hay tự gia hạn dữ liệu cũ." />
        <PrimaryButton label="Bắt đầu phiên mới" onPress={freshStart} />
        <SecondaryButton
          label="Trở về trang đầu"
          onPress={() => router.back()}
        />
      </Screen>
    )
  }

  if (phase === 'entry' && definitions) {
    return (
      <Screen>
        <SecondaryButton label="← Trở về" onPress={() => router.back()} />
        <Text style={styles.eyebrow}>SÀNG LỌC ẨN DANH</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Hiểu hơn về cảm xúc hiện tại
        </Text>
        <Text style={styles.description}>
          Chọn một bộ câu hỏi đã được công bố. Kết quả chỉ mang tính tham khảo
          và không phải chẩn đoán y khoa; bạn không cần đăng nhập.
        </Text>

        <Text style={styles.sectionTitle}>Chọn bộ câu hỏi</Text>
        <View style={styles.instrumentGrid}>
          {(['PHQ9', 'GAD7'] as const).map((instrument) => {
            const selected = instrument === selectedInstrument
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={instrument}
                onPress={() => setSelectedInstrument(instrument)}
                style={({ pressed }) => [
                  styles.instrument,
                  selected && styles.instrumentSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.instrumentTitle,
                    selected && styles.selectedText,
                  ]}
                >
                  {instrumentLabels[instrument]}
                </Text>
                <Text
                  style={[styles.smallText, selected && styles.selectedText]}
                >
                  {instrumentDescriptions[instrument]}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <View style={[styles.panel, styles.privacyPanel]}>
          <Text style={styles.sectionTitle}>
            {definitions.disclosure.title}
          </Text>
          <Text style={styles.body}>{definitions.disclosure.content}</Text>
          <Text style={styles.smallText}>
            Phiên tạm thời có giới hạn 30 phút không hoạt động và tối đa 2 giờ;
            máy chủ là nơi quyết định trạng thái hết hạn. Không có lịch sử dài
            hạn, chia sẻ với chuyên gia hoặc tự động nhập vào tài khoản.
          </Text>
        </View>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acknowledged }}
          onPress={() => setAcknowledged((current) => !current)}
          style={({ pressed }) => [
            styles.consentRow,
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[styles.checkbox, acknowledged && styles.checkboxChecked]}
          >
            {acknowledged && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.consentText}>
            Tôi đã đọc và đồng ý với nội dung xử lý dữ liệu cho lượt sàng lọc
            này.
          </Text>
        </Pressable>

        {error && <StateMessage message={error} />}
        <PrimaryButton
          disabled={!acknowledged || working}
          label={working ? 'Đang tạo phiên…' : 'Bắt đầu sàng lọc'}
          onPress={() => void start()}
        />
      </Screen>
    )
  }

  if (phase === 'question' && questionnaire && question) {
    const selectedValue = answers[question.questionId]
    return (
      <Screen>
        <Text style={styles.eyebrow}>
          {instrumentLabels[questionnaire.instrument]} · CÂU {step + 1} /{' '}
          {questionnaire.questions.length}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressValue,
              {
                width: `${((step + 1) / questionnaire.questions.length) * 100}%`,
              },
            ]}
          />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {question.prompt}
        </Text>
        <Text style={styles.description}>
          Chọn câu trả lời đúng nhất với trải nghiệm của bạn trong{' '}
          {questionnaire.referencePeriodDays} ngày gần đây.
        </Text>

        <View accessibilityRole="radiogroup" style={styles.answerList}>
          {questionnaire.responseOptions.map((option) => {
            const selected = option.value === selectedValue
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={option.value}
                onPress={() =>
                  setAnswers((current) => ({
                    ...current,
                    [question.questionId]: option.value,
                  }))
                }
                style={({ pressed }) => [
                  styles.answer,
                  selected && styles.answerSelected,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[styles.radio, selected && styles.radioSelected]}
                />
                <Text style={styles.answerLabel}>{option.label}</Text>
              </Pressable>
            )
          })}
        </View>

        <Text style={styles.smallText}>
          Câu trả lời chỉ nằm trong bộ nhớ của lượt này cho đến khi bạn chủ động
          gửi. Đã trả lời {answerCount}/{questionnaire.questions.length} câu.
        </Text>
        {error && <StateMessage message={error} />}
        <View style={styles.actions}>
          <SecondaryButton
            disabled={working}
            label={step === 0 ? 'Hủy lượt này' : 'Câu trước'}
            onPress={() => {
              if (step === 0) freshStart()
              else setStep((current) => current - 1)
            }}
          />
          <PrimaryButton
            disabled={selectedValue === undefined || working}
            label={
              working
                ? 'Đang gửi…'
                : isLastQuestion
                  ? 'Gửi và xem kết quả'
                  : 'Câu tiếp theo'
            }
            onPress={() => {
              if (isLastQuestion) void submit()
              else setStep((current) => current + 1)
            }}
          />
        </View>
      </Screen>
    )
  }

  if (phase === 'reading') {
    return (
      <Screen>
        <Text style={styles.eyebrow}>KẾT QUẢ THEO PHIÊN</Text>
        <Text accessibilityRole="header" style={styles.title}>
          {working ? 'Đang đọc kết quả từ máy chủ…' : 'Chưa đọc được kết quả'}
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.description}>
          MentalBridge chỉ hiển thị kết quả khi máy chủ xác nhận quyền sở hữu
          của phiên ẩn danh này.
        </Text>
        {error && <StateMessage message={error} />}
        {!working && session && assessmentId && (
          <PrimaryButton
            label="Thử đọc lại kết quả"
            onPress={() => void readResult(session, assessmentId)}
          />
        )}
        <SecondaryButton label="Bắt đầu lại" onPress={freshStart} />
      </Screen>
    )
  }

  if (phase === 'result' && result) {
    return (
      <Screen>
        <Text style={styles.eyebrow}>KẾT QUẢ THEO PHIÊN</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Bạn đã hoàn tất {instrumentLabels[result.instrument]}
        </Text>
        <View style={[styles.panel, styles.resultPanel]}>
          <Text style={styles.score}>{result.result.totalScore} điểm</Text>
          <Text style={styles.levelBadge}>
            Mức độ {levelLabels[result.result.screeningLevel]}
          </Text>
          <Text style={styles.smallText}>
            Kết quả do máy chủ trả về từ bộ câu hỏi đã công bố.
          </Text>
        </View>
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>
            Đây không phải chẩn đoán y khoa
          </Text>
          <Text style={styles.body}>
            Kết quả sàng lọc không thay thế đánh giá chuyên môn. Nếu cần hỗ trợ
            chuyên sâu, hãy trao đổi trực tiếp với chuyên gia y tế phù hợp.
          </Text>
        </View>
        {result.result.safetyStatus === 'POSITIVE_SAFETY_SCREEN' && (
          <View
            accessibilityRole="alert"
            style={[styles.panel, styles.safetyPanel]}
          >
            <Text style={styles.sectionTitle}>Nếu bạn đang không an toàn</Text>
            <Text style={styles.body}>
              Hãy tìm hỗ trợ trực tiếp ngay từ dịch vụ khẩn cấp tại nơi bạn sống
              hoặc một người đáng tin cậy đang ở gần. MentalBridge không tự liên
              hệ hay suy diễn chẩn đoán từ tín hiệu này.
            </Text>
          </View>
        )}
        <View style={[styles.panel, styles.privacyPanel]}>
          <Text style={styles.sectionTitle}>Giới hạn của kết quả này</Text>
          <Text style={styles.body}>
            Không có lịch sử dài hạn, không chia sẻ với chuyên gia và không tự
            động nhập vào tài khoản. Quyền truy cập kết thúc khi phiên hết hạn.
          </Text>
        </View>
        <PrimaryButton label="Làm bài khác" onPress={freshStart} />
        <SecondaryButton
          label="Trở về trang đầu"
          onPress={() => router.back()}
        />
      </Screen>
    )
  }

  return null
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
    marginBottom: spacing.md,
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
  smallText: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  privacyPanel: { backgroundColor: colors.surfaceSoft },
  errorPanel: { backgroundColor: '#FFF3F0', borderColor: colors.terracotta },
  errorText: { color: '#7D2F28', fontSize: typography.body, lineHeight: 24 },
  safetyPanel: { backgroundColor: '#FFF3F0', borderColor: colors.terracotta },
  instrumentGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  instrument: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minHeight: 76,
    padding: spacing.md,
  },
  instrumentSelected: {
    backgroundColor: colors.tealDeep,
    borderColor: colors.tealDeep,
  },
  instrumentTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  selectedText: { color: colors.white },
  consentRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
    minHeight: 48,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.inkFaint,
    borderRadius: 6,
    borderWidth: 2,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxChecked: {
    backgroundColor: colors.tealDeep,
    borderColor: colors.tealDeep,
  },
  checkmark: { color: colors.white, fontSize: 16, fontWeight: '800' },
  consentText: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    lineHeight: 24,
  },
  progressTrack: {
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    height: 8,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  progressValue: { backgroundColor: colors.teal, height: '100%' },
  answerList: { gap: spacing.md, marginBottom: spacing.lg },
  answer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
    padding: spacing.lg,
  },
  answerSelected: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.teal,
    borderWidth: 2,
  },
  radio: {
    borderColor: colors.inkFaint,
    borderRadius: radii.pill,
    borderWidth: 2,
    height: 22,
    width: 22,
  },
  radioSelected: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
    borderWidth: 6,
  },
  answerLabel: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    lineHeight: 24,
  },
  actions: { alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.lg },
  secondaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: colors.teal,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    marginBottom: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  secondaryButtonLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78 },
  resultPanel: {
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceSoft,
  },
  score: {
    color: colors.tealDeep,
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 48,
  },
  levelBadge: {
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    color: colors.tealDeep,
    fontSize: 15,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
})
