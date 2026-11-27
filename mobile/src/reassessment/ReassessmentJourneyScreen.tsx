import { randomUUID } from 'expo-crypto'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
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
import { AppIcon } from '@/components/AppIcon'
import { useDashboardFonts } from '@/theme/useDashboardFonts'
import { Screen } from '@/components/Screen'
import type { JournalApi } from '@/journal/journal-api'
import type { TrendJob } from '@/journal/journal-contract'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { ReassessmentApi } from './reassessment-api'
import { ReassessmentSummaryPanel } from './ReassessmentSummaryPanel'
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

type AuthorityState = 'LOADING' | 'FRESH' | 'STALE' | 'ERROR'
type JournalGap = Readonly<{ reason: string; retryLabel: string }>

type Props = Readonly<{
  api: ReassessmentApi
  journalApi: Pick<JournalApi, 'requestTrend' | 'trendJob'>
  onScreening: () => void
  onReturnToPlan: () => void
  onReviewPlan?: () => void
  embedded?: boolean
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
    reason: 'Chưa tải được nguồn nhật ký. Câu trả lời của bạn vẫn được lưu.',
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

function JourneyContainer({
  embedded,
  children,
}: Readonly<{ embedded: boolean; children: ReactNode }>) {
  return embedded ? (
    <View>{children}</View>
  ) : (
    <Screen layout="dashboard">{children}</Screen>
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
        <Text style={styles.state}>Đã có đủ PHQ-9 và GAD-7</Text>
        <Text style={styles.quiet}>
          Điểm và thay đổi sẽ hiển thị khi bản tổng hợp sẵn sàng.
        </Text>
      </DimensionCard>
      <DimensionCard title="2. Bối cảnh nhật ký">
        <Text style={styles.state}>Tạm thời không khả dụng</Text>
        <Text style={styles.quiet}>{gap.reason}</Text>
      </DimensionCard>
      <DimensionCard title="3. Mức độ tham gia kế hoạch">
        <Text style={styles.state}>Đang chờ tổng hợp</Text>
      </DimensionCard>
      <DimensionCard title="4. Trải nghiệm bạn tự báo cáo">
        <Text style={styles.state}>Đã lưu</Text>
        <Text style={styles.body}>
          {experienceLabel[report.currentExperience]}
        </Text>
      </DimensionCard>
      <Text style={styles.boundary}>
        Các nguồn vẫn đang chờ đủ để tạo bản tổng hợp. Bạn có thể thử tải lại
        nhật ký.
      </Text>
    </View>
  )
}

export function ReassessmentJourneyScreen({
  api,
  journalApi,
  onScreening,
  onReturnToPlan,
  onReviewPlan = onReturnToPlan,
  embedded = false,
  refreshToken = 0,
  wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
}: Props) {
  const fonts = useDashboardFonts()
  const serif = fonts ? 'DashboardSerif' : undefined
  const [context, setContext] = useState<ReassessmentContext | null>(null)
  const [report, setReport] = useState<ReassessmentSelfReport | null>(null)
  const [summary, setSummary] = useState<ReassessmentSummary | null>(null)
  const [editingReport, setEditingReport] = useState(false)
  const [showContext, setShowContext] = useState(false)
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
      setShowContext(
        Boolean(
          currentReport?.helpfulContext || currentReport?.difficultContext,
        ),
      )
      setSummary(
        loadedSummary &&
          samePeriod(loadedSummary.currentPeriod, loadedContext.currentPeriod)
          ? loadedSummary
          : null,
      )
      if (periodChanged) setNotice('Đã tải giai đoạn đánh giá mới.')
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
          'Câu trả lời đã lưu. Nhật ký chưa sẵn sàng để tổng hợp; bạn có thể thử lại hoặc tiếp tục xem các nguồn hiện có.',
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
      setEditingReport(false)
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
      <JourneyContainer embedded={embedded}>
        <ActivityIndicator
          accessibilityLabel="Đang tải đánh giá lại"
          color={colors.tealDeep}
        />
      </JourneyContainer>
    )

  if (authority === 'ERROR' && !context)
    return (
      <JourneyContainer embedded={embedded}>
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
      </JourneyContainer>
    )

  const period = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  return (
    <JourneyContainer embedded={embedded}>
      <View style={styles.flow}>
        <View style={styles.mainCard}>
          <Text style={styles.eyebrow}>ĐÁNH GIÁ LẠI</Text>
          <Text
            accessibilityRole="header"
            style={[styles.title, { fontFamily: serif }]}
          >
            Nhìn lại giai đoạn của bạn
          </Text>
          <Text style={styles.description}>
            Đặt bốn nguồn cạnh nhau để hiểu thay đổi và chọn cách đi tiếp.
          </Text>

          {context && (
            <View style={styles.periodRow}>
              <AppIcon name="calendar" size={16} />
              <Text style={styles.period}>
                {period.format(new Date(context.currentPeriod.startAt))} –{' '}
                {period.format(new Date(context.currentPeriod.endAt))}
              </Text>
            </View>
          )}
          {(stale || (loading && context)) && (
            <View style={styles.errorPanel}>
              {loading ? <ActivityIndicator color={colors.tealDeep} /> : null}
              <Text accessibilityLiveRegion="polite" style={styles.body}>
                {loading
                  ? 'Đang xác nhận lại giai đoạn và dữ liệu. Tạm khóa thay đổi.'
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
                Cần hoàn tất {context.missingInstruments.join(' và ')} cho giai
                đoạn này.
              </Text>
              <PrimaryButton
                disabled={!canWrite}
                label="Làm bài kiểm tra lại"
                onPress={onScreening}
              />
            </View>
          ) : context && (!summary || editingReport) ? (
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>
                So với giai đoạn trước, bạn cảm nhận giai đoạn này:
              </Text>
              <View style={styles.options}>
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
                    <View
                      style={[
                        styles.radio,
                        experience === value && styles.radioSelected,
                      ]}
                      aria-hidden
                    />
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Thêm chia sẻ (tùy chọn)"
                accessibilityState={{ expanded: showContext }}
                onPress={() => setShowContext(!showContext)}
                style={styles.editReport}
              >
                <Text style={styles.editCopy}>
                  {helpful || difficult
                    ? 'Chia sẻ thêm của bạn'
                    : 'Thêm chia sẻ (tùy chọn)'}
                </Text>
                <View
                  style={{
                    transform: [{ rotate: showContext ? '-90deg' : '90deg' }],
                  }}
                >
                  <AppIcon name="chevron" size={16} />
                </View>
              </Pressable>
              {showContext && (
                <View style={styles.contextFields}>
                  <Text style={styles.label}>
                    Điều gì đã giúp ích? (không bắt buộc)
                  </Text>
                  <TextInput
                    accessibilityLabel="Điều gì đã giúp ích"
                    placeholder="Ví dụ: Ngủ đều hơn, tập thở mỗi sáng…"
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
                    placeholder="Ví dụ: Áp lực công việc, hay thức giấc lúc nửa đêm…"
                    editable={canWrite}
                    maxLength={500}
                    multiline
                    onChangeText={setDifficult}
                    style={styles.input}
                    value={difficult}
                  />
                </View>
              )}
              <PrimaryButton
                disabled={!canWrite || !experience}
                label={
                  working
                    ? 'Đang xử lý…'
                    : summary
                      ? 'Cập nhật bản tổng hợp'
                      : missingJournal
                        ? missingJournal.retryLabel
                        : 'Bắt đầu đánh giá lại'
                }
                onPress={() => void submit()}
                testID="reassessment-submit"
                tone="dashboard"
              />
            </View>
          ) : null}

          {summary && !editingReport && context?.state === 'READY' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chỉnh câu trả lời"
              onPress={() => {
                setEditingReport(true)
                setShowContext(Boolean(helpful || difficult))
              }}
              style={styles.editReport}
            >
              <View style={styles.editCopy}>
                <Text style={styles.sectionTitle}>Cảm nhận bạn đã chia sẻ</Text>
                <Text style={styles.quiet}>
                  {report
                    ? experienceLabel[report.currentExperience]
                    : 'Chia sẻ thêm khi bạn sẵn sàng'}
                </Text>
              </View>
              <AppIcon name="chevron" size={18} />
            </Pressable>
          )}
          {!summary && (
            <Text style={styles.boundary}>
              Bốn góc nhìn có thể khác nhau. MentalBridge không gộp chúng thành
              một điểm số hay chẩn đoán.
            </Text>
          )}
        </View>
        {notice &&
          !stale &&
          notice !==
            'Bản tổng hợp bốn góc nhìn đã sẵn sàng để bạn xem lại.' && (
            <Text accessibilityLiveRegion="polite" style={styles.notice}>
              {notice}
            </Text>
          )}
        {summary && <ReassessmentSummaryPanel summary={summary} />}
        {!summary && report && missingJournal && (
          <AvailableSources gap={missingJournal} report={report} />
        )}
        {(summary || (report && missingJournal)) && (
          <PrimaryButton
            label={
              summary
                ? 'Giữ hoặc đổi kế hoạch'
                : 'Tiếp tục với các nguồn hiện có'
            }
            onPress={onReviewPlan}
            tone="dashboard"
            disabled={!canWrite}
          />
        )}
        <Pressable
          accessibilityRole="button"
          onPress={onReturnToPlan}
          style={styles.back}
        >
          <Text style={styles.backText}>Quay lại Kế hoạch hỗ trợ</Text>
        </Pressable>
      </View>
    </JourneyContainer>
  )
}

const styles = StyleSheet.create({
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editReport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },
  editCopy: { flex: 1, gap: spacing.xs },
  flow: { gap: 16 },
  mainCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    gap: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  hero: {
    backgroundColor: '#E4F0E9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 8,
  },
  heroCopy: { flex: 1, gap: 4 },
  heroTitle: { color: colors.ink, fontSize: 20, fontWeight: '600' },
  heroImage: { width: 62, height: 62, borderRadius: 31 },
  period: {
    color: colors.tealDeep,
    backgroundColor: '#F0F2ED',
    padding: 9,
    borderRadius: 10,
    fontSize: 12,
    alignSelf: 'flex-start',
  },
  radio: { width: 17, height: 17, borderRadius: 9, backgroundColor: '#DFE6DF' },
  radioSelected: {
    borderWidth: 5,
    borderColor: colors.tealDeep,
    backgroundColor: '#fff',
  },
  eyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  description: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 21,
  },
  form: { gap: spacing.md },
  contextFields: { gap: spacing.sm },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  label: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  option: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#F0F2ED',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  optionText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 20 },
  input: {
    backgroundColor: '#F0F2ED',
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
