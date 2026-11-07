import { randomUUID } from 'expo-crypto'
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
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import type { JournalApi } from '@/journal/journal-api'
import type { TrendJob } from '@/journal/journal-contract'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { ReassessmentApi } from './reassessment-api'
import type {
  ReassessmentContext,
  ReassessmentExperience,
  ReassessmentSelfReport,
  ReassessmentSummary,
} from './reassessment-contract'

const experiences: readonly (readonly [ReassessmentExperience, string])[] = [
  ['BETTER', 'Dễ chịu hơn trước'],
  ['ABOUT_THE_SAME', 'Gần như không thay đổi'],
  ['MORE_DIFFICULT', 'Khó khăn hơn trước'],
  ['UNSURE', 'Tôi chưa chắc'],
]
const experienceLabel = Object.fromEntries(experiences) as Record<
  ReassessmentExperience,
  string
>
const stateLabel = {
  AVAILABLE: 'Có dữ liệu',
  INSUFFICIENT_DATA: 'Chưa đủ dữ liệu',
  UNAVAILABLE: 'Tạm thời không khả dụng',
} as const

type AuthorityState = 'LOADING' | 'FRESH' | 'STALE' | 'ERROR'
type JournalGap = Readonly<{ reason: string; retryLabel: string }>

type Props = Readonly<{
  api: ReassessmentApi
  journalApi: Pick<JournalApi, 'requestTrend' | 'trendJob'>
  onScreening: () => void
  onReturnToPlan: () => void
  refreshToken?: number
  wait?: (milliseconds: number) => Promise<void>
}>

function samePeriod(
  value: { startAt: string; endAt: string },
  expected: { startAt: string; endAt: string },
) {
  return value.startAt === expected.startAt && value.endAt === expected.endAt
}

function periodKey(context: ReassessmentContext) {
  return `${context.previousPeriod.startAt}:${context.previousPeriod.endAt}:${context.currentPeriod.startAt}:${context.currentPeriod.endAt}`
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'
    if (error.code === 'REASSESSMENT_SELF_REPORT_VERSION_MISMATCH')
      return 'Câu trả lời đã thay đổi ở nơi khác. Hãy tải lại trước khi lưu.'
    if (
      error.code === 'ASSESSMENT_NOT_CURRENT' ||
      error.code === 'REASSESSMENT_SCREENING_CONTEXT_MISMATCH'
    )
      return 'Kết quả sàng lọc đã thay đổi. Hãy tải lại lượt đánh giá này.'
  }
  return 'Chưa thể hoàn tất đánh giá lại. Không có kết quả nào được tự tạo hoặc suy đoán.'
}

function journalGap(error: unknown): JournalGap {
  if (
    error instanceof ApiError &&
    ['CONSENT_REQUIRED', 'CONSENT_REVOKED', 'CONSENT_UNAVAILABLE'].includes(
      error.code,
    )
  )
    return {
      reason:
        'Bạn chưa cho phép hoặc đã thu hồi quyền xử lý AI cho Nhật ký. Câu trả lời tự báo cáo vẫn được lưu và ứng dụng không tự xin quyền thay bạn.',
      retryLabel: 'Kiểm tra lại nguồn Nhật ký',
    }
  return {
    reason:
      'Dịch vụ Nhật ký chưa trả về mã công việc nguồn. Ứng dụng không tạo mã thay thế hoặc giả dữ liệu.',
    retryLabel: 'Thử lại nguồn Nhật ký',
  }
}

async function terminalJob(
  api: Props['journalApi'],
  initial: TrendJob,
  wait: NonNullable<Props['wait']>,
) {
  let job = initial
  for (let attempt = 0; attempt < 20 && job.status === 'RUNNING'; attempt++) {
    await wait(750)
    job = await api.trendJob(job.jobId)
  }
  return job
}

function DimensionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  )
}

function Summary({ summary }: { summary: ReassessmentSummary }) {
  const selfReport = summary.selfReportedExperience
  return (
    <View accessibilityLabel="Bốn chiều đánh giá lại" style={styles.summary}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        Bốn góc nhìn riêng biệt
      </Text>
      <DimensionCard title="1. Thay đổi sàng lọc">
        <Text style={styles.state}>{stateLabel[summary.screening.state]}</Text>
        {summary.screening.trends.map((trend) => (
          <Text key={trend.instrument} style={styles.body}>
            {trend.instrument}: {trend.current.totalScore} điểm ·{' '}
            {trend.direction}
          </Text>
        ))}
      </DimensionCard>
      <DimensionCard title="2. Bối cảnh nhật ký">
        <Text style={styles.state}>
          {stateLabel[summary.journalContext.state]}
        </Text>
        {summary.journalContext.changesComparedWithPreviousPeriod.map(
          (item) => (
            <Text key={`${item.signal}:${item.direction}`} style={styles.body}>
              {item.signal}: {item.direction}
            </Text>
          ),
        )}
        {summary.journalContext.unavailableReason && (
          <Text style={styles.quiet}>
            Lý do: {summary.journalContext.unavailableReason}
          </Text>
        )}
      </DimensionCard>
      <DimensionCard title="3. Mức độ tham gia kế hoạch">
        <Text style={styles.state}>
          {stateLabel[summary.supportPlanEngagement.state]}
        </Text>
        <Text style={styles.body}>
          Giai đoạn trước:{' '}
          {summary.supportPlanEngagement.previousPeriod.completedCount} hoàn
          thành, {summary.supportPlanEngagement.previousPeriod.skippedCount} bỏ
          qua.
        </Text>
        <Text style={styles.body}>
          Giai đoạn này:{' '}
          {summary.supportPlanEngagement.currentPeriod.completedCount} hoàn
          thành, {summary.supportPlanEngagement.currentPeriod.skippedCount} bỏ
          qua.
        </Text>
      </DimensionCard>
      <DimensionCard title="4. Trải nghiệm bạn tự báo cáo">
        <Text style={styles.state}>
          {selfReport ? stateLabel[selfReport.state] : 'Chưa có dữ liệu'}
        </Text>
        {selfReport?.source && (
          <Text style={styles.body}>
            {experienceLabel[selfReport.source.currentExperience]}
          </Text>
        )}
      </DimensionCard>
      <Text style={styles.boundary}>
        Bốn chiều có thể không khớp nhau và không được gộp thành điểm số, chẩn
        đoán hay kết luận tổng thể.
      </Text>
    </View>
  )
}

function AvailableSources({
  report,
  gap,
}: Readonly<{ report: ReassessmentSelfReport; gap: JournalGap }>) {
  return (
    <View accessibilityLabel="Nguồn đánh giá hiện có" style={styles.summary}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        Các nguồn hiện có
      </Text>
      <DimensionCard title="1. Sàng lọc theo giai đoạn">
        <Text style={styles.state}>Care đã xác nhận đủ PHQ-9 và GAD-7</Text>
        <Text style={styles.quiet}>
          Điểm và xu hướng chỉ hiển thị sau khi Care tạo được bản tổng hợp.
        </Text>
      </DimensionCard>
      <DimensionCard title="2. Bối cảnh nhật ký">
        <Text style={styles.state}>Tạm thời không khả dụng</Text>
        <Text style={styles.quiet}>{gap.reason}</Text>
      </DimensionCard>
      <DimensionCard title="3. Mức độ tham gia kế hoạch">
        <Text style={styles.state}>Đang chờ Care tổng hợp</Text>
      </DimensionCard>
      <DimensionCard title="4. Trải nghiệm bạn tự báo cáo">
        <Text style={styles.state}>Đã lưu</Text>
        <Text style={styles.body}>
          {experienceLabel[report.currentExperience]}
        </Text>
      </DimensionCard>
      <Text style={styles.boundary}>
        Đây là trạng thái nguồn, không phải bản tổng hợp bốn chiều. Ứng dụng
        không tự tạo Journal job hoặc suy đoán dữ liệu còn thiếu.
      </Text>
    </View>
  )
}

export function ReassessmentJourneyScreen({
  api,
  journalApi,
  onScreening,
  onReturnToPlan,
  refreshToken = 0,
  wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
}: Props) {
  const [context, setContext] = useState<ReassessmentContext | null>(null)
  const [report, setReport] = useState<ReassessmentSelfReport | null>(null)
  const [summary, setSummary] = useState<ReassessmentSummary | null>(null)
  const [experience, setExperience] = useState<ReassessmentExperience | null>(
    null,
  )
  const [helpful, setHelpful] = useState('')
  const [difficult, setDifficult] = useState('')
  const [authority, setAuthority] = useState<AuthorityState>('LOADING')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState('')
  const [pendingJob, setPendingJob] = useState<TrendJob | null>(null)
  const [missingJournal, setMissingJournal] = useState<JournalGap | null>(null)
  const reportKey = useRef(randomUUID())
  const trendKey = useRef(randomUUID())
  const compositionKey = useRef<{
    signature: string
    value: string
  } | null>(null)
  const loadedPeriod = useRef<string | null>(null)
  const hasAuthority = useRef(false)
  const loadRequest = useRef(0)

  const resetIntents = useCallback(() => {
    reportKey.current = randomUUID()
    trendKey.current = randomUUID()
    compositionKey.current = null
    setPendingJob(null)
    setMissingJournal(null)
  }, [])

  const load = useCallback(async () => {
    const request = ++loadRequest.current
    setLoading(true)
    setNotice('')
    setAuthority(hasAuthority.current ? 'STALE' : 'LOADING')
    try {
      const loadedContext = await api.getContext()
      const [loadedReport, loadedSummary] = await Promise.all([
        api.getCurrentReport().catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 404) return null
          throw error
        }),
        api.getCurrentSummary().catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 404) return null
          throw error
        }),
      ])
      if (request !== loadRequest.current) return

      const nextPeriod = periodKey(loadedContext)
      const periodChanged =
        loadedPeriod.current !== null && loadedPeriod.current !== nextPeriod
      if (periodChanged) resetIntents()
      loadedPeriod.current = nextPeriod
      setContext(loadedContext)

      const currentReport =
        loadedReport &&
        samePeriod(loadedReport.currentPeriod, loadedContext.currentPeriod)
          ? loadedReport
          : null
      setReport(currentReport)
      setExperience(currentReport?.currentExperience ?? null)
      setHelpful(currentReport?.helpfulContext ?? '')
      setDifficult(currentReport?.difficultContext ?? '')
      setSummary(
        loadedSummary &&
          samePeriod(loadedSummary.currentPeriod, loadedContext.currentPeriod)
          ? loadedSummary
          : null,
      )
      if (periodChanged) setNotice('Đã tải giai đoạn đánh giá mới từ Care.')
      hasAuthority.current = true
      setAuthority('FRESH')
    } catch (error) {
      if (request !== loadRequest.current) return
      setNotice(errorMessage(error))
      setAuthority(hasAuthority.current ? 'STALE' : 'ERROR')
    } finally {
      if (request === loadRequest.current) setLoading(false)
    }
  }, [api, resetIntents])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load, refreshToken])

  async function submit() {
    if (
      authority !== 'FRESH' ||
      !context ||
      context.state !== 'READY' ||
      !experience ||
      working
    )
      return
    setWorking(true)
    setNotice('Đang lưu câu trả lời và tổng hợp bốn nguồn…')
    try {
      const draft = {
        currentExperience: experience,
        helpfulContext: helpful.trim() || null,
        difficultContext: difficult.trim() || null,
      }
      const changed =
        report != null &&
        (report.currentExperience !== draft.currentExperience ||
          report.helpfulContext !== draft.helpfulContext ||
          report.difficultContext !== draft.difficultContext)
      const saved = report
        ? changed
          ? await api.replaceReport(report, draft)
          : report
        : await api.createReport(context, draft, reportKey.current)
      setReport(saved)
      if (changed) setSummary(null)

      let initial: TrendJob
      try {
        initial = pendingJob
          ? await journalApi.trendJob(pendingJob.jobId)
          : await journalApi.requestTrend(
              {
                previousPeriod: context.previousPeriod,
                currentPeriod: context.currentPeriod,
                excludedJournalIds: [],
              },
              trendKey.current,
            )
      } catch (error) {
        const gap = journalGap(error)
        setMissingJournal(gap)
        setNotice(
          'Câu trả lời đã được lưu. Nguồn Nhật ký chưa cấp mã công việc nên Care chưa thể tạo bản tổng hợp; bạn vẫn có thể xem các nguồn hiện có hoặc thử lại.',
        )
        return
      }

      setPendingJob(initial)
      const job = await terminalJob(journalApi, initial, wait)
      setPendingJob(job.status === 'RUNNING' ? job : null)
      if (job.status === 'RUNNING') {
        setNotice(
          'Nhật ký vẫn đang xử lý. Hãy thử lại để tiếp tục đúng công việc đã tạo.',
        )
        return
      }

      setMissingJournal(null)
      const signature = `${periodKey(context)}:${saved.selfReportId}:${saved.version}:${job.jobId}`
      if (compositionKey.current?.signature !== signature)
        compositionKey.current = { signature, value: randomUUID() }
      const composed = await api.compose(
        context,
        job.jobId,
        saved.selfReportId,
        compositionKey.current.value,
      )
      setSummary(composed)
      setNotice('Bản tổng hợp bốn góc nhìn đã sẵn sàng để bạn xem lại.')
    } catch (error) {
      setNotice(errorMessage(error))
    } finally {
      setWorking(false)
    }
  }

  const stale = authority === 'STALE'
  const canWrite = authority === 'FRESH' && !working

  if (authority === 'LOADING' && !context)
    return (
      <Screen>
        <ActivityIndicator
          accessibilityLabel="Đang tải đánh giá lại"
          color={colors.tealDeep}
        />
      </Screen>
    )

  if (authority === 'ERROR' && !context)
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Chưa tải được đánh giá lại
        </Text>
        <View style={styles.errorPanel}>
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {notice}
          </Text>
          <PrimaryButton
            label="Thử tải lại"
            onPress={() => void load()}
            testID="reassessment-retry"
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onReturnToPlan}
          style={styles.back}
        >
          <Text style={styles.backText}>Quay lại Kế hoạch hỗ trợ</Text>
        </Pressable>
      </Screen>
    )

  return (
    <Screen>
      <Text style={styles.eyebrow}>ĐÁNH GIÁ LẠI</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Điều gì đã thay đổi với bạn?
      </Text>
      <Text style={styles.description}>
        So sánh sàng lọc, nhật ký, việc thực hiện kế hoạch và cảm nhận bạn tự
        chia sẻ. MentalBridge không tự chẩn đoán hoặc tự đổi kế hoạch.
      </Text>

      {(stale || (loading && context)) && (
        <View style={styles.errorPanel}>
          {loading ? <ActivityIndicator color={colors.tealDeep} /> : null}
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {loading
              ? 'Đang xác nhận lại giai đoạn và dữ liệu với Care. Tạm khóa thay đổi.'
              : `${notice} Dữ liệu đang hiển thị có thể đã cũ; mọi thao tác lưu đang bị khóa.`}
          </Text>
          {!loading && (
            <PrimaryButton
              label="Thử tải lại"
              onPress={() => void load()}
              testID="reassessment-retry"
            />
          )}
        </View>
      )}

      {context?.state === 'INCOMPLETE' ? (
        <View style={styles.noticePanel}>
          <Text style={styles.body}>
            Cần hoàn tất {context.missingInstruments.join(' và ')} cho giai đoạn
            này.
          </Text>
          <PrimaryButton
            disabled={!canWrite}
            label="Làm bài kiểm tra lại"
            onPress={onScreening}
          />
        </View>
      ) : context ? (
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>
            So với giai đoạn trước, bạn cảm thấy:
          </Text>
          {experiences.map(([value, label]) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{
                checked: experience === value,
                disabled: !canWrite,
              }}
              disabled={!canWrite}
              key={value}
              onPress={() => setExperience(value)}
              style={[
                styles.option,
                experience === value && styles.optionSelected,
              ]}
            >
              <Text style={styles.optionText}>{label}</Text>
            </Pressable>
          ))}
          <Text style={styles.label}>
            Điều gì đã giúp ích? (không bắt buộc)
          </Text>
          <TextInput
            accessibilityLabel="Điều gì đã giúp ích"
            editable={canWrite}
            maxLength={500}
            multiline
            onChangeText={setHelpful}
            style={styles.input}
            value={helpful}
          />
          <Text style={styles.label}>
            Điều gì khiến bạn thấy khó khăn? (không bắt buộc)
          </Text>
          <TextInput
            accessibilityLabel="Điều gì khiến bạn thấy khó khăn"
            editable={canWrite}
            maxLength={500}
            multiline
            onChangeText={setDifficult}
            style={styles.input}
            value={difficult}
          />
          <PrimaryButton
            disabled={!canWrite || !experience}
            label={
              working
                ? 'Đang xử lý…'
                : summary
                  ? 'Cập nhật bản tổng hợp'
                  : missingJournal
                    ? missingJournal.retryLabel
                    : 'Xem bốn góc nhìn'
            }
            onPress={() => void submit()}
            testID="reassessment-submit"
          />
        </View>
      ) : null}

      {notice && !stale && (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      )}
      {summary && <Summary summary={summary} />}
      {!summary && report && missingJournal && (
        <AvailableSources gap={missingJournal} report={report} />
      )}
      {(summary || (report && missingJournal)) && (
        <PrimaryButton
          label={
            summary
              ? 'Xem lựa chọn giữ hoặc đổi kế hoạch'
              : 'Tiếp tục với các nguồn hiện có'
          }
          onPress={onReturnToPlan}
        />
      )}
      <Pressable
        accessibilityRole="button"
        onPress={onReturnToPlan}
        style={styles.back}
      >
        <Text style={styles.backText}>Quay lại Kế hoạch hỗ trợ</Text>
      </Pressable>
    </Screen>
  )
}

const styles = StyleSheet.create({
  eyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    fontWeight: '700',
    lineHeight: typography.headingLineHeight,
    marginTop: spacing.md,
  },
  description: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  form: { gap: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  label: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  option: {
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    padding: spacing.md,
  },
  optionSelected: {
    backgroundColor: colors.tealPale,
    borderColor: colors.tealDeep,
  },
  optionText: { color: colors.ink, fontSize: typography.body },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    minHeight: 88,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  noticePanel: {
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  errorPanel: {
    backgroundColor: '#F8E8DF',
    borderRadius: radii.panel,
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  notice: {
    color: colors.tealDeep,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginVertical: spacing.lg,
  },
  summary: { gap: spacing.md, marginVertical: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  state: { color: colors.tealDeep, fontSize: 14, fontWeight: '700' },
  body: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  quiet: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  boundary: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  back: {
    alignSelf: 'flex-start',
    marginTop: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: { color: colors.tealDeep, fontSize: 15, fontWeight: '700' },
})
