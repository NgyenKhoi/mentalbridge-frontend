import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { PrimaryButton } from '@/components/PrimaryButton'

import type { AnalysisRequestStore } from './analysis-request-store'
import type { JournalApi } from './journal-api'
import type { AnalysisJob, AnalysisTarget, TrendJob } from './journal-contract'
import {
  journalError,
  journalStyles as s,
  Notice,
  TextAction,
} from './journal-ui'
import { analysisTargetKey, useJournalAnalysis } from './use-journal-analysis'

export function analysisFailure(reason: string | null | undefined) {
  switch (reason) {
    case 'CONSENT_REQUIRED':
    case 'CONSENT_REVOKED':
      return 'Bạn chưa cho phép AI xử lý hoặc đã rút lại sự đồng ý. Nhật ký vẫn dùng được bình thường.'
    case 'CONSENT_UNAVAILABLE':
      return 'Chưa kiểm tra được sự đồng ý của bạn. AI chưa thể xử lý; bạn vẫn có thể viết nhật ký.'
    case 'ENTITLEMENT_CHANGED':
    case 'ENTITLEMENT_UNAVAILABLE':
      return 'Chưa xác nhận được quyền dùng AI hiện tại. Nhật ký vẫn được lưu; không có kết quả AI thay thế.'
    case 'AUTHORIZATION_CONTEXT_LOST':
      return 'Quyền xử lý yêu cầu đã thay đổi. Đăng nhập và kiểm tra lại trước khi gửi yêu cầu mới.'
    case 'REVISION_STALE':
    case 'SOURCE_REVISION_CHANGED':
      return 'Bài viết nguồn đã thay đổi. Mở bản mới nhất rồi chủ động gửi yêu cầu mới.'
    case 'JOURNAL_DELETED':
    case 'SOURCE_DELETED':
      return 'Bài viết nguồn đã bị xóa. Không dùng kết quả của yêu cầu này.'
    case 'PROVIDER_TIMEOUT':
    case 'PROVIDER_UNAVAILABLE':
      return 'AI chưa phản hồi lúc này. Nhật ký vẫn được lưu; bạn có thể thử lại sau.'
    case 'INVALID_PROVIDER_RESULT':
      return 'Phản hồi AI chưa đáp ứng yêu cầu an toàn. Không hiển thị kết quả; nhật ký vẫn được lưu.'
    default:
      return 'Chưa hoàn tất yêu cầu AI. Không có kết quả để hiển thị; nhật ký vẫn được lưu.'
  }
}
const nonRetryable = new Set([
  'REVISION_STALE',
  'SOURCE_REVISION_CHANGED',
  'JOURNAL_DELETED',
  'SOURCE_DELETED',
  'AUTHORIZATION_CONTEXT_LOST',
])

function Signals({
  label,
  values,
}: Readonly<{ label: string; values: string[] }>) {
  return values.length > 0 ? (
    <View>
      <Text style={s.label}>{label}</Text>
      {values.map((value, index) => (
        <Text key={`${index}:${value}`} style={s.body}>
          • {value}
        </Text>
      ))}
    </View>
  ) : null
}

function Result({ job }: Readonly<{ job: AnalysisJob | TrendJob }>) {
  const [sources, setSources] = useState(false)
  if (!job.result) return null
  const result = job.result
  const trend = 'dataCoverage' in job
  const insufficient = trend && !job.dataCoverage.sufficientForComparison
  return (
    <View testID="journal-ai-completed" style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={s.heading}>
        Gợi ý để bạn tự nhìn lại
      </Text>
      <Notice>
        Đây là phản ánh hỗ trợ từ AI, không phải chẩn đoán hay kết luận về sức
        khỏe của bạn.
      </Notice>
      {trend && (
        <>
          <Text style={s.body}>
            Dữ liệu được dùng:{' '}
            {job.dataCoverage.previousPeriodJournalEntryCount} bài ở khoảng
            trước, {job.dataCoverage.currentPeriodJournalEntryCount} bài ở
            khoảng hiện tại.
          </Text>
          {insufficient && (
            <Notice>
              Chưa đủ dữ liệu để so sánh hai khoảng. Ngày không có nhật ký không
              được xem là cảm xúc tốt lên hoặc xấu đi.
            </Notice>
          )}
        </>
      )}
      {'summary' in result && result.summary && (
        <Text style={s.body}>{result.summary}</Text>
      )}
      <Signals label="Bối cảnh được nhắc đến" values={result.contextSignals} />
      <Signals
        label="Cảm xúc được nhắc đến"
        values={result.emotionIndicators}
      />
      <Signals
        label="Chủ đề"
        values={'themes' in result ? result.themes : result.recurringThemes}
      />
      <Signals
        label="Điều bạn quan tâm"
        values={
          'preferenceSignals' in result
            ? result.preferenceSignals
            : result.preferences
        }
      />
      <Signals
        label="Điều có thể gây khó khăn"
        values={
          'barrierSignals' in result ? result.barrierSignals : result.barriers
        }
      />
      {'helpfulPatterns' in result && (
        <Signals
          label="Điều có thể hỗ trợ bạn"
          values={result.helpfulPatterns}
        />
      )}
      {'changesComparedWithPreviousPeriod' in result && !insufficient && (
        <View>
          <Text style={s.label}>So sánh do hệ thống trả về</Text>
          {result.changesComparedWithPreviousPeriod.map((change, index) => (
            <Text key={index} style={s.body}>
              {change.signal}:{' '}
              {
                {
                  MORE_FREQUENT: 'được nhắc đến nhiều hơn',
                  LESS_FREQUENT: 'được nhắc đến ít hơn',
                  SIMILAR: 'tần suất tương tự',
                  INSUFFICIENT_DATA: 'chưa đủ dữ liệu',
                }[change.direction]
              }
            </Text>
          ))}
        </View>
      )}
      <TextAction
        label={sources ? 'Ẩn nguồn phản ánh' : 'Xem nguồn phản ánh'}
        onPress={() => setSources((value) => !value)}
      />
      {sources && (
        <View>
          {'journalId' in job ? (
            <Text style={s.source}>
              Bài viết {job.journalId} · bản đã lưu {job.journalRevision}
            </Text>
          ) : (
            <>
              <Text style={s.source}>
                Khoảng trước (UTC): {job.previousPeriod.startAt} →{' '}
                {job.previousPeriod.endAt} (không gồm thời điểm cuối).
              </Text>
              <Text style={s.source}>
                Khoảng hiện tại (UTC): {job.currentPeriod.startAt} →{' '}
                {job.currentPeriod.endAt} (không gồm thời điểm cuối).
              </Text>
              {job.sourceJournalRevisions.map((source) => (
                <Text
                  key={`${source.period}:${source.journalId}`}
                  style={s.source}
                >
                  {source.period === 'PREVIOUS' ? 'Trước' : 'Hiện tại'}:{' '}
                  {source.journalId} · bản {source.journalRevision}
                </Text>
              ))}
            </>
          )}
          <Text style={s.source}>
            {result.provider} · {result.model} · {result.promptVersion} ·{' '}
            {result.createdAt}
          </Text>
        </View>
      )}
    </View>
  )
}

function AnalysisPanel({
  api,
  subject,
  target,
  blocked = false,
  stale = false,
  store,
}: Readonly<{
  api: JournalApi
  subject: string
  target: AnalysisTarget
  blocked?: boolean
  stale?: boolean
  store?: AnalysisRequestStore
}>) {
  const state = useJournalAnalysis(api, subject, target, store)
  const [checked, setChecked] = useState(false)
  const authorization = state.authorization.data
  const allowed =
    state.authorization.isSuccess &&
    authorization?.authorized &&
    authorization.policyVersion === state.disclosure.data?.version
  const busy = state.request.isPending || state.consent.isPending
  const supported = target.kind !== 'EXACT' || target.revision <= 200
  const job = state.job.data
  const requestError = state.request.error
  const changedSource =
    requestError instanceof ApiError &&
    (requestError.status === 409 || requestError.status === 404)
  const canRequest =
    !state.marker?.jobId ||
    (job?.status === 'FAILED' && !nonRetryable.has(job.terminalReason ?? ''))
  return (
    <View
      style={s.panel}
      testID={
        state.authorization.isPending || state.disclosure.isPending
          ? 'journal-ai-permission-loading'
          : allowed
            ? 'journal-ai-authorized'
            : 'journal-ai-consent-needed'
      }
    >
      <Text accessibilityRole="header" style={s.heading}>
        {target.kind === 'EXACT'
          ? 'Nhìn lại bài viết cùng AI'
          : 'Nhìn lại hai khoảng thời gian'}
      </Text>
      <Text style={s.body}>
        Tùy chọn. Không yêu cầu AI cũng không ảnh hưởng đến việc lưu nhật ký.
      </Text>
      {blocked && (
        <Notice>
          Lưu phần đang sửa trước khi yêu cầu AI nhìn lại đúng bản đã lưu.
        </Notice>
      )}
      {!supported && (
        <Notice>
          AI chưa hỗ trợ bản đã lưu này. Bạn vẫn có thể đọc và sửa nhật ký.
        </Notice>
      )}
      {stale && (
        <Notice>
          Bài viết đã được sửa; phản ánh cũ không dùng cho bản mới này.
        </Notice>
      )}
      {state.authorization.isPending || state.disclosure.isPending ? (
        <ActivityIndicator accessibilityLabel="Đang kiểm tra quyền xử lý AI" />
      ) : state.authorization.isError || state.disclosure.isError ? (
        <>
          <Notice error>
            Chưa kiểm tra được quyền xử lý AI. Bạn vẫn có thể viết và lưu nhật
            ký.
          </Notice>
          <TextAction
            label="Kiểm tra lại quyền AI"
            onPress={() => {
              void state.authorization.refetch()
              void state.disclosure.refetch()
            }}
          />
        </>
      ) : !allowed ? (
        <>
          <Notice>
            {authorization?.reason === 'REVOKED'
              ? 'Bạn đã rút lại sự đồng ý cho AI.'
              : authorization?.reason === 'POLICY_OUTDATED'
                ? 'Thông tin xử lý đã thay đổi; cần đọc và đồng ý lại.'
                : 'Bạn chưa cho phép AI xử lý nhật ký.'}
          </Notice>
          {state.disclosure.data && (
            <>
              <Text style={s.label}>{state.disclosure.data.title}</Text>
              <Text style={s.body}>{state.disclosure.data.content}</Text>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="Tôi đồng ý cho AI xử lý theo thông tin trên"
                accessibilityState={{ checked, disabled: busy }}
                disabled={busy}
                onPress={() => setChecked((value) => !value)}
                style={[s.choice, checked && s.selected]}
                testID="journal-ai-consent-check"
              >
                <Text style={s.label}>
                  {checked ? '☑' : '☐'} Tôi đồng ý cho AI xử lý theo thông tin
                  trên
                </Text>
              </Pressable>
              <PrimaryButton
                testID="journal-ai-consent"
                label="Lưu sự đồng ý"
                disabled={!checked || busy}
                onPress={() => state.consent.mutate(true)}
              />
            </>
          )}
        </>
      ) : (
        <TextAction
          label="Rút lại sự đồng ý cho AI"
          disabled={busy}
          onPress={() => {
            setChecked(false)
            state.consent.mutate(false)
          }}
        />
      )}
      {state.consent.isError && (
        <Notice error>{journalError(state.consent.error)}</Notice>
      )}
      {!state.restored && <Notice>Đang kiểm tra yêu cầu đã gửi…</Notice>}
      {state.storageError && (
        <Notice error>
          Chưa đọc được trạng thái yêu cầu trên thiết bị. Đóng và mở lại màn
          hình; AI chưa được yêu cầu xử lý.
        </Notice>
      )}
      {state.marker?.jobId && state.job.isPending && (
        <ActivityIndicator accessibilityLabel="Đang tải trạng thái AI đã lưu" />
      )}
      {state.job.isError && (
        <>
          <Notice error>
            Chưa tải được trạng thái yêu cầu. Không tạo yêu cầu mới hay kết quả
            thay thế.
          </Notice>
          <TextAction
            label="Tải lại trạng thái AI"
            disabled={busy}
            onPress={() => void state.job.refetch()}
          />
        </>
      )}
      {job?.status === 'RUNNING' && (
        <Notice>
          {job.attemptCount === 0
            ? 'Yêu cầu đang chờ xử lý.'
            : 'AI đang xử lý bản đã lưu. Bạn không cần gửi lại.'}
        </Notice>
      )}
      {job?.status === 'FAILED' && (
        <View testID="journal-ai-failed">
          <Notice error>{analysisFailure(job.terminalReason)}</Notice>
        </View>
      )}
      {job?.status === 'SUCCEEDED' &&
        allowed &&
        !state.job.isError &&
        !blocked && <Result job={job} />}
      {requestError && (
        <Notice error>
          {changedSource
            ? 'Bài viết hoặc quyền xử lý đã thay đổi. Mở lại bài viết và kiểm tra sự đồng ý trước khi gửi yêu cầu mới.'
            : requestError instanceof ApiError &&
                requestError.code === 'CONSENT_REQUIRED'
              ? 'Sự đồng ý đã thay đổi. Kiểm tra lại trước khi yêu cầu AI.'
              : journalError(requestError)}
        </Notice>
      )}
      {state.marker && !state.marker.jobId && !busy && (
        <Notice>
          Lần gửi trước chưa được xác nhận. Thử lại sẽ kiểm tra cùng yêu cầu.
        </Notice>
      )}
      {canRequest && (
        <PrimaryButton
          testID="journal-ai-request"
          label={
            busy
              ? 'Đang gửi…'
              : state.marker
                ? 'Thử lại yêu cầu AI'
                : target.kind === 'EXACT'
                  ? 'Yêu cầu AI nhìn lại bài viết'
                  : 'Yêu cầu AI so sánh'
          }
          disabled={
            !allowed ||
            !supported ||
            changedSource ||
            blocked ||
            busy ||
            !state.restored ||
            state.storageError ||
            state.authorization.isFetching
          }
          onPress={() => state.request.mutate()}
        />
      )}
    </View>
  )
}

// Identity changes remount the marker/draft state before any cached job can be
// rendered. Revision alone is never an account-wide synchronization marker.
export function JournalAnalysisPanel(
  props: Parameters<typeof AnalysisPanel>[0],
) {
  return (
    <AnalysisPanel
      key={`${props.subject}:${analysisTargetKey(props.target)}`}
      {...props}
    />
  )
}
