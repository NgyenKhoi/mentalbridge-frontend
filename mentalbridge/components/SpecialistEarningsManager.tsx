'use client'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowDownToLine,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Info,
  RefreshCw,
  Wallet,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { specialistEarningsBrowserClient } from '@/features/specialist-earnings/api/browser-client'
import {
  BankCombobox,
  type BankOption,
} from '@/features/specialist-earnings/BankCombobox'
import {
  maskedHint,
  payoutProviderName,
} from '@/features/specialist-earnings/payout-labels'
import { ApiError } from '@/lib/api/api-error'
import type {
  SavePayoutDestinationInput,
  SpecialistEarnings,
} from '@/lib/consultation/consultation-validation'
import { Dialog } from './ui/Dialog'
import { useFeedback } from './ui/FeedbackProvider'
import { Skeleton } from './ui/Skeleton'
import styles from './SpecialistEarningsManager.module.css'

type DialogName = 'destination' | 'withdraw' | null
type Payout = SpecialistEarnings['payouts'][number]
const earningLabels: Record<
  SpecialistEarnings['earnings'][number]['status'],
  string
> = {
  PENDING_SETTLEMENT: 'Đang chờ đối soát',
  AVAILABLE: 'Có thể rút',
  PROCESSING: 'Đang chi trả',
  PAID: 'Đã thanh toán',
  REVERSED: 'Đã điều chỉnh',
}
const WAITING_FOR_OPERATOR = [
  'PAYOUT_INSUFFICIENT_BALANCE',
  'PAYOUT_SERVICE_CREDITS_INSUFFICIENT',
]
const NOT_OPEN_CODES = [
  'REAL_PAYOUT_DISABLED',
  'PAYOUT_PROVIDER_UNAVAILABLE',
  'PAYOUT_CONFIGURATION_UNAVAILABLE',
]
const NOT_OPEN = 'Rút tiền tạm thời chưa mở. Vui lòng quay lại sau.'
const STEPS = [
  'Đã gửi yêu cầu',
  'Ngân hàng đang xác nhận',
  'Đã nhận tiền',
] as const

// Safe specialist copy per server state; raw failure codes never reach the screen.
function payoutView(payout: Payout): {
  label: string
  tone: string
  note: string | null
  active: boolean
} {
  const { status, failureCode, reconciliationStatus, closedAt } = payout
  if (status === 'FAILED' && closedAt)
    return {
      label: 'Đã đóng',
      tone: 'CLOSED',
      note: 'Số tiền đã trở lại số dư. Bạn có thể rút về tài khoản mới khi tài khoản được xác nhận.',
      active: false,
    }
  if (status === 'PENDING' || status === 'PROCESSING')
    return {
      label: 'Đang chuyển',
      tone: 'PROCESSING',
      note: null,
      active: true,
    }
  if (status === 'SUCCEEDED')
    return {
      label: 'Đã thanh toán',
      tone: 'SUCCEEDED',
      note: null,
      active: false,
    }
  if (status === 'UNKNOWN') {
    if (reconciliationStatus === undefined)
      return {
        label: 'Chưa rõ kết quả',
        tone: 'UNKNOWN',
        note: 'Đang đối soát kết quả. Chưa thể xác nhận thanh toán thành công.',
        active: false,
      }
    return reconciliationStatus === 'NEEDS_REVIEW'
      ? {
          label: 'Đang kiểm tra',
          tone: 'UNKNOWN',
          note: 'Chúng tôi đang xác minh với ngân hàng. Số tiền vẫn được giữ cho bạn; bạn không cần làm gì.',
          active: false,
        }
      : {
          label: 'Đang xác nhận',
          tone: 'UNKNOWN',
          note: 'Ngân hàng chưa trả kết quả. Số tiền vẫn được giữ cho bạn.',
          active: false,
        }
  }
  if (failureCode && WAITING_FOR_OPERATOR.includes(failureCode))
    return {
      label: 'Chờ chuyển lại',
      tone: 'WAITING',
      note: 'Giao dịch được hoãn từ phía MentalBridge. Số tiền vẫn được giữ và sẽ được chuyển lại; bạn không cần làm gì.',
      active: false,
    }
  return {
    label: 'Chưa thành công',
    tone: 'FAILED',
    note:
      failureCode === 'PAYOUT_PROVIDER_REJECTED'
        ? 'Ngân hàng chưa nhận giao dịch. Số tiền vẫn được giữ cho bạn; đội vận hành sẽ kiểm tra và liên hệ nếu cần.'
        : 'Số tiền vẫn được giữ cho bạn; đội vận hành sẽ kiểm tra và chuyển lại.',
    active: false,
  }
}
function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value))
}
function denied(error: unknown) {
  return (
    error instanceof ApiError && (error.status === 401 || error.status === 403)
  )
}
function requestError(
  error: unknown,
  action: 'load' | 'destination' | 'withdraw',
) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.status === 403)
      return 'Tài khoản hiện tại chưa có quyền quản lý thu nhập.'
    if (error.code === 'PAYOUT_DAILY_LIMIT_REACHED')
      return 'Bạn đã gửi yêu cầu rút tiền hôm nay. Hãy làm mới để xem trạng thái yêu cầu.'
    if (error.code === 'PAYOUT_MINIMUM_NOT_REACHED')
      return 'Số dư khả dụng hiện tại chưa đạt mức rút tối thiểu. Hãy làm mới số dư.'
    if (error.code === 'PAYOUT_DESTINATION_NOT_FOUND')
      return 'Nơi nhận tiền không còn khả dụng. Hãy làm mới và kiểm tra lại thông tin nhận tiền.'
    if (error.code === 'PAYOUT_DESTINATION_INVALID')
      return 'Thông tin nhận tiền chưa hợp lệ. Hãy kiểm tra tên, số tài khoản và ngân hàng.'
    if (error.code === 'PAYOUT_DESTINATION_CONFIRMATION_REQUIRED')
      return 'Tài khoản đang chờ xác nhận. Bạn có thể rút tiền khi tài khoản được xác nhận.'
    if (error.code === 'PAYOUT_DESTINATION_PROVIDER_MISMATCH')
      return 'Cần thêm tài khoản ngân hàng để rút tiền. Hãy làm mới để xem tài khoản hiện tại.'
    if (error.code && NOT_OPEN_CODES.includes(error.code)) return NOT_OPEN
  }
  if (action === 'load')
    return 'Chưa thể cập nhật thu nhập. Vui lòng thử kết nối lại.'
  if (action === 'destination')
    return 'Chưa thể xác nhận thông tin đã được lưu. Nội dung bạn nhập vẫn ở đây để kiểm tra và thử lại.'
  return 'Chưa nhận được kết quả yêu cầu rút tiền. Đừng tạo yêu cầu mới; thử lại tại đây để kiểm tra cùng yêu cầu.'
}
function Amount({ value }: { value: number }) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.strong
        key={value}
        initial={reduced ? false : { opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? undefined : { opacity: 0, y: -5 }}
        transition={{ duration: reduced ? 0 : 0.15 }}
      >
        {formatCurrency(value)}
      </motion.strong>
    </AnimatePresence>
  )
}
// Badge text cross-fades when the state changes (240 ms; instant under reduced motion).
function FadeText({ value }: { value: string }) {
  const reduced = useReducedMotion()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={value}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0 : 0.12 }}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  )
}
// Key moment: three steps; on success the last check draws in and the list collapses.
function PayoutSteps({ complete }: { complete: boolean }) {
  const reduced = useReducedMotion()
  return (
    <motion.ol
      className={styles.steps}
      aria-label="Tiến trình chuyển tiền"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.24 }}
    >
      {STEPS.map((step, index) => {
        const state =
          complete || index === 0 ? 'done' : index === 1 ? 'current' : 'next'
        return (
          <li
            key={step}
            data-step={state}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className={styles.stepMark} aria-hidden="true">
              {state === 'done' ? (
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
                  <motion.path
                    d="M3.5 8.5l3 3 6-7"
                    stroke="var(--teal-deep)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={
                      complete && index === 2 && !reduced
                        ? { pathLength: 0 }
                        : false
                    }
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.32 }}
                  />
                </svg>
              ) : (
                <i data-dot={state} />
              )}
            </span>
            {step}
            <span className={styles.visuallyHidden}>
              {state === 'done'
                ? ' (đã xong)'
                : state === 'current'
                  ? ' (đang diễn ra)'
                  : ' (chưa tới)'}
            </span>
          </li>
        )
      })}
    </motion.ol>
  )
}

export default function SpecialistEarningsManager() {
  const { showActionToast } = useFeedback()
  const reduced = useReducedMotion()
  const [data, setData] = useState<SpecialistEarnings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<DialogName>(null)
  const [destinationType, setDestinationType] =
    useState<SavePayoutDestinationInput['destinationType']>('MOMO_WALLET')
  const [accountReference, setAccountReference] = useState('')
  const [accountHolderName, setAccountHolderName] = useState('')
  const [bankCode, setBankCode] = useState('')
  const [banks, setBanks] = useState<BankOption[] | null>(null)
  const [banksLoading, setBanksLoading] = useState(false)
  const [banksFailed, setBanksFailed] = useState(false)
  const [formError, setFormError] = useState('')
  const [invalidField, setInvalidField] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [unconfirmedPayout, setUnconfirmedPayout] = useState(false)
  const [celebrating, setCelebrating] = useState<ReadonlySet<string>>(new Set())
  const sequence = useRef(0)
  const loadBusy = useRef(false)
  const mutationBusy = useRef(false)
  const payoutIntent = useRef<{ key: string; destinationId: string } | null>(
    null,
  )
  const seenPayouts = useRef<Map<string, string> | null>(null)
  const celebrateTimer = useRef<number | undefined>(undefined)
  const nameInput = useRef<HTMLInputElement>(null)
  const referenceInput = useRef<HTMLInputElement>(null)
  const bankInput = useRef<HTMLInputElement>(null)

  const resetForm = useCallback(() => {
    setAccountReference('')
    setAccountHolderName('')
    setBankCode('')
    setFormError('')
    setInvalidField('')
  }, [])
  const clearProtected = useCallback(() => {
    setData(null)
    setDialog(null)
    resetForm()
    payoutIntent.current = null
    seenPayouts.current = null
    setUnconfirmedPayout(false)
  }, [resetForm])
  // Stores a fresh response; returns true when a payout just reached SUCCEEDED so the step list can finish.
  const commit = useCallback((next: SpecialistEarnings) => {
    const prior = seenPayouts.current
    const finished = prior
      ? next.payouts
          .filter(
            (p) =>
              p.status === 'SUCCEEDED' &&
              (!prior.has(p.id) ||
                ['PENDING', 'PROCESSING'].includes(prior.get(p.id) ?? '')),
          )
          .map((p) => p.id)
      : []
    seenPayouts.current = new Map(next.payouts.map((p) => [p.id, p.status]))
    setData(next)
    if (finished.length) {
      setCelebrating(new Set(finished))
      window.clearTimeout(celebrateTimer.current)
      celebrateTimer.current = window.setTimeout(
        () => setCelebrating(new Set()),
        600,
      )
    }
    return finished.length > 0
  }, [])
  // A mutation supersedes any read already in flight, so a pre-mutation response cannot overwrite post-mutation state.
  function fenceReads() {
    loadBusy.current = false
    setLoading(false)
    return ++sequence.current
  }
  // silent: background refresh while a payout is in flight; no skeleton, no error banner.
  const load = useCallback(
    async (silent = false) => {
      if (loadBusy.current || mutationBusy.current) return
      loadBusy.current = true
      const request = ++sequence.current
      if (!silent) {
        setLoading(true)
        setError('')
      }
      try {
        const response = await specialistEarningsBrowserClient.get()
        if (request === sequence.current && commit(response))
          showActionToast({
            title: 'Khoản rút tiền đã được thanh toán',
            description: 'Kiểm tra số dư mới trong lịch sử chi trả.',
          })
      } catch (caught) {
        if (request !== sequence.current) return
        if (denied(caught)) clearProtected()
        if (!silent || denied(caught)) setError(requestError(caught, 'load'))
      } finally {
        if (request === sequence.current) {
          if (!silent) setLoading(false)
          loadBusy.current = false
        }
      }
    },
    [clearProtected, commit, showActionToast],
  )
  const loadBanks = useCallback(async () => {
    setBanksLoading(true)
    setBanksFailed(false)
    try {
      setBanks((await specialistEarningsBrowserClient.banks()).items)
    } catch (caught) {
      if (denied(caught)) clearProtected()
      setBanksFailed(true)
    } finally {
      setBanksLoading(false)
    }
  }, [clearProtected])
  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (active) void load()
    })
    return () => {
      active = false
      sequence.current += 1
      loadBusy.current = false
      window.clearTimeout(celebrateTimer.current)
    }
  }, [load])

  const destination = data?.destination ?? null
  const availability = data?.payoutAvailability
  const mode = availability?.mode ?? data?.payoutProvider
  const payos = mode === 'PAYOS'
  const notReady = Boolean(
    availability && (!availability.ready || availability.mode === 'DISABLED'),
  )
  // Under PAYOS only a bank account confirmed by an admin can receive money; MoMo history stays readable.
  const legacy = Boolean(
    payos && destination && destination.provider !== 'PAYOS',
  )
  const pendingConfirmation = destination?.status === 'PENDING_CONFIRMATION'
  const usable = Boolean(
    destination?.status === 'VERIFIED' &&
    destination.usableForPayout !== false &&
    !legacy,
  )
  const processing = Boolean(
    data &&
    (data.balance.processingVnd > 0 ||
      data.payouts.some((p) =>
        ['PENDING', 'PROCESSING', 'UNKNOWN'].includes(p.status),
      )),
  )
  const canWithdraw = Boolean(
    data &&
    usable &&
    !notReady &&
    data.balance.availableVnd >= data.minimumWithdrawalVnd &&
    !processing &&
    !error &&
    !loading,
  )
  const inFlight = Boolean(
    data?.payouts.some(
      (p) =>
        p.reconciliationStatus !== 'NEEDS_REVIEW' &&
        (p.reconciliationStatus === 'POLLING' ||
          p.reconciliationStatus === 'PENDING' ||
          ['PENDING', 'PROCESSING', 'UNKNOWN'].includes(p.status)),
    ),
  )
  // Poll every 30 s while a payout is in flight and the tab is visible; refresh once on return.
  useEffect(() => {
    if (!inFlight) return
    const tick = () => {
      if (document.visibilityState === 'visible') void load(true)
    }
    const timer = window.setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [inFlight, load])
  const sortedEarnings = useMemo(
    () =>
      [...(data?.earnings ?? [])].sort(
        (a, b) => Date.parse(b.earnedAt) - Date.parse(a.earnedAt),
      ),
    [data],
  )
  const sortedPayouts = useMemo(
    () =>
      [...(data?.payouts ?? [])].sort(
        (a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt),
      ),
    [data],
  )
  function closeDialog() {
    if (mutationBusy.current) return
    setDialog(null)
    resetForm()
  }
  function openDestination() {
    if (mutationBusy.current || unconfirmedPayout) return
    resetForm()
    setDestinationType(
      payos ? 'BANK_ACCOUNT' : (destination?.destinationType ?? 'MOMO_WALLET'),
    )
    setDialog('destination')
    if (payos && (!banks || banksFailed)) void loadBanks()
  }
  function openWithdraw() {
    if (mutationBusy.current) return
    setFormError('')
    setDialog('withdraw')
  }
  async function saveDestination(event: FormEvent) {
    event.preventDefault()
    if (mutationBusy.current) return
    const field = !accountHolderName.trim()
      ? 'name'
      : destinationType === 'BANK_ACCOUNT' &&
          !(payos
            ? banks?.some((bank) => bank.bin === bankCode)
            : bankCode.trim())
        ? 'bank'
        : !/^\d{6,32}$/.test(accountReference)
          ? 'reference'
          : ''
    if (field) {
      setInvalidField(field)
      setFormError(
        field === 'name'
          ? payos
            ? 'Nhập tên chủ tài khoản đúng như trên thẻ hoặc sao kê.'
            : 'Nhập đúng tên chủ tài khoản hoặc chủ ví.'
          : field === 'bank'
            ? payos
              ? 'Chọn ngân hàng từ danh sách.'
              : 'Nhập mã ngân hàng để tiếp tục.'
            : 'Nhập từ 6 đến 32 chữ số, không có khoảng trắng hoặc ký tự đặc biệt.',
      )
      ;({ name: nameInput, bank: bankInput, reference: referenceInput })[
        field
      ]?.current?.focus()
      return
    }
    mutationBusy.current = true
    setSubmitting(true)
    setFormError('')
    setInvalidField('')
    const request = fenceReads()
    try {
      const saved = await specialistEarningsBrowserClient.saveDestination({
        destinationType,
        accountReference,
        accountHolderName: accountHolderName.trim(),
        ...(destinationType === 'BANK_ACCOUNT'
          ? { bankCode: bankCode.trim() }
          : {}),
      })
      if (request !== sequence.current) return
      setData((current) =>
        current ? { ...current, destination: saved } : current,
      )
      setDialog(null)
      resetForm()
      payoutIntent.current = null
      showActionToast(
        saved.status === 'PENDING_CONFIRMATION'
          ? {
              title: 'Đã gửi tài khoản để xác nhận',
              description: 'Bạn có thể rút tiền khi tài khoản được xác nhận.',
            }
          : {
              title: 'Đã lưu nơi nhận tiền',
              description: 'Thông tin nhận tiền chỉ hiển thị dạng che bớt.',
            },
      )
    } catch (caught) {
      if (request !== sequence.current) return
      if (denied(caught)) {
        clearProtected()
        setError(requestError(caught, 'destination'))
      } else setFormError(requestError(caught, 'destination'))
    } finally {
      mutationBusy.current = false
      setSubmitting(false)
    }
  }
  async function createPayout() {
    if (
      mutationBusy.current ||
      !data?.destination ||
      (!canWithdraw && !unconfirmedPayout)
    )
      return
    const intent = payoutIntent.current ?? {
      key: 'payout-' + crypto.randomUUID(),
      destinationId: data.destination.id,
    }
    payoutIntent.current = intent
    mutationBusy.current = true
    setSubmitting(true)
    setFormError('')
    const request = fenceReads()
    const priorIds = new Set(data.payouts.map((p) => p.id))
    try {
      const response = await specialistEarningsBrowserClient.createPayout(
        intent.destinationId,
        intent.key,
      )
      if (request !== sequence.current) return
      commit(response)
      setError('')
      setUnconfirmedPayout(false)
      setDialog(null)
      const returned =
        response.payouts.find((p) => !priorIds.has(p.id)) ??
        response.payouts.find((p) => p.destinationId === intent.destinationId)
      payoutIntent.current = null
      showActionToast({
        title:
          returned?.status === 'FAILED'
            ? 'Yêu cầu rút tiền chưa thành công'
            : returned?.status === 'UNKNOWN'
              ? 'Yêu cầu đang cần đối soát'
              : 'Đã cập nhật yêu cầu rút tiền',
        description:
          returned?.status === 'SUCCEEDED'
            ? 'Yêu cầu đã được ghi nhận là thanh toán thành công.'
            : 'Kiểm tra trạng thái và số dư mới trong lịch sử chi trả.',
      })
    } catch (caught) {
      if (request !== sequence.current) return
      if (denied(caught)) {
        clearProtected()
        setError(requestError(caught, 'withdraw'))
      } else {
        // A 4xx, or a 503 "not open" answer, is a definite refusal before dispatch: the next try may use a new key.
        const definitive =
          caught instanceof ApiError &&
          ((caught.status !== undefined &&
            caught.status >= 400 &&
            caught.status < 500) ||
            Boolean(caught.code && NOT_OPEN_CODES.includes(caught.code)))
        if (definitive) payoutIntent.current = null
        setUnconfirmedPayout(!definitive)
        setFormError(requestError(caught, 'withdraw'))
      }
    } finally {
      mutationBusy.current = false
      setSubmitting(false)
    }
  }
  const header = (
    <header className={styles.heading}>
      <div>
        <span className={styles.eyebrow}>Không gian chuyên gia</span>
        <h1>Thu nhập & thanh toán</h1>
        <p>Theo dõi khoản thu và quản lý nơi nhận tiền của bạn.</p>
      </div>
      <div className={styles.refresh}>
        {data && (
          <small>
            Cập nhật lúc {formatDate(data.generatedAt)} · giờ Việt Nam
          </small>
        )}
        <button
          className={styles.secondary}
          type="button"
          disabled={loading || submitting}
          onClick={() => void load()}
        >
          <RefreshCw
            size={17}
            aria-hidden="true"
            className={loading ? styles.spinning : undefined}
          />
          {loading ? 'Đang tải…' : 'Làm mới'}
        </button>
      </div>
    </header>
  )

  if (!data)
    return (
      <div className={styles.workspace} data-specialist-journey="earnings">
        {header}
        {loading ? (
          <div
            role="status"
            aria-label="Đang tải thu nhập"
            className={styles.loading}
          >
            <Skeleton height={210} />
            <Skeleton height={320} />
          </div>
        ) : (
          <section className={styles.empty} role="alert">
            <RefreshCw size={32} aria-hidden="true" />
            <h2>Chưa thể tải thu nhập</h2>
            <p>{error}</p>
            <button
              className={styles.primary}
              type="button"
              onClick={() => void load()}
            >
              Thử lại
            </button>
          </section>
        )}
      </div>
    )
  // The simulated-mode notice follows the configured mode; old servers without it fall back to the rows.
  const sandbox = mode
    ? mode === 'FAKE'
    : destination?.provider === 'FAKE' ||
      data.payouts.some((p) => p.provider === 'FAKE')
  const retryPendingVnd = data.balance.retryPendingVnd ?? 0
  const reason = error
    ? 'Cần cập nhật số dư trước khi rút'
    : unconfirmedPayout
      ? 'Chưa nhận được kết quả yêu cầu trước'
      : notReady
        ? NOT_OPEN
        : processing
          ? 'Đang có yêu cầu cần xử lý hoặc đối soát'
          : !destination
            ? 'Cần thiết lập nơi nhận tiền'
            : legacy
              ? 'Cần thêm tài khoản ngân hàng'
              : pendingConfirmation
                ? 'Tài khoản đang chờ xác nhận'
                : destination.status !== 'VERIFIED'
                  ? 'Nơi nhận tiền đang bị vô hiệu hóa'
                  : data.balance.availableVnd < data.minimumWithdrawalVnd
                    ? 'Số dư chưa đạt mức rút tối thiểu'
                    : 'Đủ điều kiện yêu cầu rút tiền'
  // The sub-line follows the reason: what to expect, never the default repeated while blocked.
  const subLine = unconfirmedPayout
    ? 'Kiểm tra lại cùng yêu cầu, không tạo thêm lệnh mới.'
    : notReady
      ? null
      : processing
        ? 'Bạn có thể rút tiếp khi yêu cầu hiện tại hoàn tất.'
        : (!destination || legacy) && payos
          ? 'Thêm tài khoản ngân hàng để nhận tiền.'
          : pendingConfirmation
            ? 'Bạn có thể rút ngay khi tài khoản được xác nhận.'
            : 'Rút toàn bộ số dư khả dụng; số tiền do hệ thống tính.'
  const destinationBadge = !destination
    ? 'Chưa thiết lập'
    : legacy
      ? 'Không dùng để rút'
      : pendingConfirmation
        ? 'Chờ xác nhận'
        : destination.status === 'VERIFIED'
          ? payos
            ? 'Đã xác nhận'
            : 'Đã xác minh'
          : 'Đã vô hiệu hóa'
  const destinationName = legacy
    ? 'Ví MoMo'
    : destination?.destinationType === 'MOMO_WALLET'
      ? 'Ví MoMo'
      : (destination?.bankName ?? 'Tài khoản ngân hàng')
  const changeDisabled =
    loading || submitting || Boolean(error) || unconfirmedPayout
  const motionEnter = (delay = 0) => ({
    initial: reduced ? (false as const) : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduced ? 0 : 0.24, delay },
  })
  return (
    <div
      className={styles.workspace}
      data-specialist-journey="earnings"
      aria-busy={loading}
    >
      {header}
      {error && (
        <section className={styles.notice} role="alert">
          <div>
            <strong>Chưa thể cập nhật thu nhập</strong>
            <p>{error} Thông tin bên dưới là lần tải thành công gần nhất.</p>
          </div>
          <button
            className={styles.secondary}
            type="button"
            disabled={loading}
            onClick={() => void load()}
          >
            Thử lại
          </button>
        </section>
      )}
      {sandbox && (
        <aside className={styles.notice}>
          <Info size={20} aria-hidden="true" />
          <div>
            <strong>Chế độ thử nghiệm</strong>
            <p>Các giao dịch thử nghiệm không chuyển tiền thật.</p>
          </div>
        </aside>
      )}
      <div className={styles.topGrid}>
        <section
          className={styles.balanceCard}
          aria-labelledby="earnings-balance-title"
        >
          <header className={styles.cardHeader}>
            <h2 id="earnings-balance-title">
              <Wallet size={20} aria-hidden="true" />
              Số dư khả dụng
            </h2>
            <span className={styles.badge}>
              Tối thiểu {formatCurrency(data.minimumWithdrawalVnd)}
            </span>
          </header>
          <div className={styles.balanceAmount}>
            <Amount value={data.balance.availableVnd} />
          </div>
          <div className={styles.balanceDetails}>
            <div>
              <span>Chờ đối soát · {data.settlementHoldDays} ngày</span>
              <b>{formatCurrency(data.balance.pendingSettlementVnd)}</b>
            </div>
            {retryPendingVnd > 0 && (
              <div>
                <span>Chờ chuyển lại</span>
                <b>{formatCurrency(retryPendingVnd)}</b>
              </div>
            )}
            <div>
              <span>Đang chi trả</span>
              <b>{formatCurrency(data.balance.processingVnd)}</b>
            </div>
            <div>
              <span>Đã thanh toán</span>
              <b>{formatCurrency(data.balance.paidVnd)}</b>
            </div>
          </div>
          <footer className={styles.withdrawAction}>
            <div>
              <strong>
                {canWithdraw ? (
                  <CheckCircle2 size={17} aria-hidden="true" />
                ) : (
                  <Info size={17} aria-hidden="true" />
                )}
                {reason}
              </strong>
              {subLine && <p>{subLine}</p>}
            </div>
            <button
              className={styles.primary}
              type="button"
              disabled={
                loading ||
                submitting ||
                Boolean(error) ||
                (!canWithdraw && !unconfirmedPayout && Boolean(destination))
              }
              onClick={
                unconfirmedPayout
                  ? openWithdraw
                  : destination
                    ? openWithdraw
                    : openDestination
              }
            >
              <ArrowDownToLine size={17} aria-hidden="true" />
              {unconfirmedPayout
                ? 'Kiểm tra lại yêu cầu'
                : destination
                  ? 'Rút toàn bộ số dư'
                  : 'Thiết lập nơi nhận'}
            </button>
          </footer>
        </section>
        <section
          className={styles.card}
          aria-labelledby="earnings-destination-title"
        >
          <header className={styles.cardHeader}>
            <h2 id="earnings-destination-title">
              <CreditCard size={20} aria-hidden="true" />
              Nơi nhận tiền
            </h2>
            <span
              className={styles.badge}
              data-state={legacy ? 'LEGACY' : (destination?.status ?? 'NONE')}
            >
              <FadeText value={destinationBadge} />
            </span>
          </header>
          {destination ? (
            <div className={styles.destination}>
              <i>
                <Banknote size={24} aria-hidden="true" />
              </i>
              <div>
                <div className={styles.destinationName}>{destinationName}</div>
                <strong>{maskedHint(destination.displayHint)}</strong>
              </div>
              {destination.verifiedAt && !legacy && (
                <small>
                  {payos ? 'Xác nhận lúc ' : 'Xác minh lúc '}
                  {formatDate(destination.verifiedAt)}
                </small>
              )}
            </div>
          ) : (
            <div className={styles.destinationEmpty}>
              <CreditCard size={28} aria-hidden="true" />
              <h3>Chưa có nơi nhận tiền</h3>
              <p>
                {payos
                  ? 'Thêm tài khoản ngân hàng để yêu cầu chi trả.'
                  : 'Thêm ví MoMo hoặc tài khoản ngân hàng để yêu cầu chi trả.'}
              </p>
            </div>
          )}
          {pendingConfirmation && (
            <p className={styles.meta}>
              Chúng tôi kiểm tra tên chủ tài khoản một lần. Sau đó, tiền rút về
              tài khoản này sẽ được chuyển tự động.
            </p>
          )}
          {legacy && (
            <p className={styles.meta}>
              Ví MoMo không còn nhận tiền rút. Thêm tài khoản ngân hàng để tiếp
              tục.
            </p>
          )}
          <p className={styles.meta}>
            Thông tin đầy đủ không hiển thị lại sau khi lưu.
          </p>
          <button
            className={legacy ? styles.primary : styles.secondary}
            type="button"
            onClick={openDestination}
            disabled={changeDisabled}
          >
            {legacy
              ? 'Thêm tài khoản ngân hàng'
              : destination
                ? 'Cập nhật nơi nhận tiền'
                : 'Thiết lập nơi nhận tiền'}
          </button>
        </section>
      </div>
      <section className={styles.card} aria-labelledby="earnings-list-title">
        <header className={styles.cardHeader}>
          <div>
            <h2 id="earnings-list-title">Khoản thu theo phiên tư vấn</h2>
            <p>Khoản thu đã được ghi nhận và thời điểm có thể rút.</p>
          </div>
          <span className={styles.badge}>{sortedEarnings.length} khoản</span>
        </header>
        {sortedEarnings.length ? (
          <div className={styles.rows}>
            {sortedEarnings.map((earning) => (
              <article key={earning.id} className={styles.earningRow}>
                <span className={styles.rowIcon}>
                  <CalendarIcon />
                </span>
                <div>
                  <strong>Ghi nhận ngày {formatDate(earning.earnedAt)}</strong>
                  <small>
                    {earning.status === 'PENDING_SETTLEMENT'
                      ? 'Khả dụng từ ' +
                        formatDate(earning.settlementAvailableAt)
                      : earningLabels[earning.status]}
                  </small>
                </div>
                <b>{formatCurrency(earning.earningAmountVnd)}</b>
                <span className={styles.badge} data-state={earning.status}>
                  {earningLabels[earning.status]}
                </span>
                <Link
                  className={styles.rowLink}
                  href={
                    '/specialist/appointments?appointmentId=' +
                    encodeURIComponent(earning.appointmentId)
                  }
                  aria-label={
                    'Xem phiên có khoản thu ghi nhận ngày ' +
                    formatDate(earning.earnedAt)
                  }
                >
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <Wallet size={28} aria-hidden="true" />
            <h3>Chưa có thu nhập được ghi nhận</h3>
            <p>
              Khoản thu sẽ xuất hiện khi một phiên tư vấn hoàn tất và đủ điều
              kiện.
            </p>
          </div>
        )}
      </section>
      <section className={styles.card} aria-labelledby="earnings-payout-title">
        <header className={styles.cardHeader}>
          <div>
            <h2 id="earnings-payout-title">Lịch sử chi trả</h2>
            <p>Kết quả và tiến trình các yêu cầu rút tiền.</p>
          </div>
          <span className={styles.badge}>{sortedPayouts.length} yêu cầu</span>
        </header>
        {sortedPayouts.length ? (
          <div className={styles.rows}>
            <AnimatePresence initial={false}>
              {sortedPayouts.map((payout) => {
                const view = payoutView(payout)
                const finishing = celebrating.has(payout.id)
                return (
                  <motion.article
                    key={payout.id}
                    layout={reduced ? false : 'position'}
                    className={styles.payoutRow}
                    {...motionEnter()}
                  >
                    <Clock3 size={20} aria-hidden="true" />
                    <div>
                      <strong>{formatCurrency(payout.amountVnd)}</strong>
                      <small>Gửi lúc {formatDate(payout.requestedAt)}</small>
                      {payout.completedAt && (
                        <small>
                          Cập nhật kết quả lúc {formatDate(payout.completedAt)}
                        </small>
                      )}
                      <small>
                        {payout.provider === 'FAKE'
                          ? payoutProviderName.FAKE
                          : `Qua ${payoutProviderName[payout.provider]}`}
                      </small>
                    </div>
                    <span className={styles.badge} data-state={view.tone}>
                      <FadeText
                        value={finishing ? 'Đã thanh toán' : view.label}
                      />
                    </span>
                    {view.note && <p>{view.note}</p>}
                    <AnimatePresence initial={false}>
                      {(view.active || finishing) && (
                        <PayoutSteps key="steps" complete={finishing} />
                      )}
                    </AnimatePresence>
                  </motion.article>
                )
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className={styles.empty}>
            <Clock3 size={28} aria-hidden="true" />
            <h3>Chưa có yêu cầu rút tiền</h3>
            <p>Các yêu cầu và kết quả chi trả sẽ xuất hiện tại đây.</p>
          </div>
        )}
      </section>
      <Dialog
        open={dialog === 'destination'}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        labelledBy="destination-title"
        describedBy="destination-description"
        className={styles.dialog}
      >
        <header className={styles.dialogHeader}>
          <div>
            <h2 id="destination-title">
              {destination
                ? 'Cập nhật thông tin nhận'
                : 'Thiết lập thông tin nhận'}
            </h2>
            <div id="destination-description">
              <p>
                {payos
                  ? 'Nhập tài khoản ngân hàng của bạn.'
                  : 'Nhập thông tin ví MoMo hoặc tài khoản ngân hàng của bạn.'}
              </p>
              {payos && destination?.provider === 'PAYOS' && usable && (
                <p>
                  Tài khoản mới cần được xác nhận lại trước lần rút tiếp theo.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Đóng"
            disabled={submitting}
            onClick={closeDialog}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <form
          id="earnings-destination-form"
          onSubmit={saveDestination}
          noValidate
          className={styles.form}
          aria-busy={submitting}
        >
          <fieldset disabled={submitting}>
            {!payos && (
              <>
                <legend>Hình thức nhận</legend>
                <div className={styles.choices}>
                  {(['MOMO_WALLET', 'BANK_ACCOUNT'] as const).map((type) => (
                    <label key={type}>
                      <input
                        type="radio"
                        name="destination"
                        checked={destinationType === type}
                        onChange={() => {
                          setDestinationType(type)
                          setFormError('')
                          setInvalidField('')
                        }}
                      />
                      <span>
                        {type === 'MOMO_WALLET'
                          ? 'Ví MoMo'
                          : 'Tài khoản ngân hàng'}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}
            {payos && (
              <BankCombobox
                banks={banks}
                loading={banksLoading}
                loadFailed={banksFailed}
                onRetry={() => void loadBanks()}
                value={bankCode}
                onChange={setBankCode}
                invalid={invalidField === 'bank'}
                describedBy={
                  invalidField === 'bank' ? 'earnings-form-error' : undefined
                }
                disabled={submitting}
                inputRef={bankInput}
              />
            )}
            <div className={styles.fieldGroup}>
              <label className={styles.field}>
                <span>
                  {payos
                    ? 'Tên chủ tài khoản'
                    : 'Tên chủ tài khoản hoặc chủ ví'}
                </span>
                <input
                  ref={nameInput}
                  required
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize={payos ? 'characters' : undefined}
                  maxLength={100}
                  value={accountHolderName}
                  onChange={(e) =>
                    setAccountHolderName(
                      payos ? e.target.value.toUpperCase() : e.target.value,
                    )
                  }
                  placeholder={
                    payos ? 'NGUYEN VAN A' : 'Nhập đúng tên đã đăng ký'
                  }
                  aria-invalid={invalidField === 'name'}
                  aria-describedby={
                    invalidField === 'name'
                      ? 'earnings-form-error'
                      : payos
                        ? 'earnings-holder-hint'
                        : undefined
                  }
                />
              </label>
              {payos && (
                <small id="earnings-holder-hint">
                  Nhập đúng như tên in trên thẻ hoặc sao kê, không dấu.
                </small>
              )}
            </div>
            {!payos && destinationType === 'BANK_ACCOUNT' && (
              <label className={styles.field}>
                <span>Mã ngân hàng</span>
                <input
                  ref={bankInput}
                  required
                  autoComplete="off"
                  maxLength={32}
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value.toUpperCase())}
                  placeholder="Ví dụ: VCB"
                  aria-invalid={invalidField === 'bank'}
                  aria-describedby={
                    invalidField === 'bank' ? 'earnings-form-error' : undefined
                  }
                />
              </label>
            )}
            <label className={styles.field}>
              <span>
                {destinationType === 'MOMO_WALLET'
                  ? 'Số điện thoại MoMo'
                  : 'Số tài khoản'}
              </span>
              <input
                ref={referenceInput}
                required
                type="text"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                maxLength={32}
                value={accountReference}
                onChange={(e) =>
                  setAccountReference(e.target.value.replace(/\s/g, ''))
                }
                placeholder="Từ 6 đến 32 chữ số"
                aria-invalid={invalidField === 'reference'}
                aria-describedby={
                  invalidField === 'reference'
                    ? 'earnings-form-error'
                    : undefined
                }
              />
            </label>
          </fieldset>
          {formError && (
            <p
              className={styles.formError}
              id="earnings-form-error"
              role="alert"
            >
              {formError}
            </p>
          )}
        </form>
        <footer className={styles.dialogFooter}>
          <button
            className={styles.secondary}
            type="button"
            disabled={submitting}
            onClick={closeDialog}
          >
            Hủy
          </button>
          <button
            className={styles.primary}
            type="submit"
            form="earnings-destination-form"
            disabled={submitting}
          >
            {submitting && (
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={styles.spinning}
              />
            )}
            {submitting ? 'Đang lưu…' : 'Lưu thông tin nhận'}
          </button>
        </footer>
      </Dialog>
      <Dialog
        open={dialog === 'withdraw'}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        labelledBy="withdraw-title"
        describedBy="withdraw-description"
        className={styles.dialog}
      >
        <header className={styles.dialogHeader}>
          <div>
            <h2 id="withdraw-title">Rút toàn bộ số dư khả dụng</h2>
            <p id="withdraw-description">
              Hệ thống tự tính số tiền từ các khoản đủ điều kiện; bạn không cần
              nhập số tiền.
            </p>
          </div>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="Đóng"
            disabled={submitting}
            onClick={closeDialog}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className={styles.form}>
          <div className={styles.confirmAmount}>
            <small>
              {unconfirmedPayout
                ? 'Số dư ở lần tải gần nhất'
                : 'Số dư khả dụng ở lần tải gần nhất'}
            </small>
            <strong>{formatCurrency(data.balance.availableVnd)}</strong>
            <p>Số tiền thực tế được xác định khi hệ thống tiếp nhận yêu cầu.</p>
          </div>
          <div className={styles.destination}>
            <CreditCard size={22} aria-hidden="true" />
            <div>
              <small>Nơi nhận tiền</small>
              <strong>
                {destinationName} · {maskedHint(destination?.displayHint ?? '')}
              </strong>
            </div>
          </div>
          <p className={styles.meta}>
            Mỗi chuyên gia được tạo tối đa một yêu cầu trong ngày. Kiểm tra kết
            quả trong lịch sử chi trả.
          </p>
          {sandbox && (
            <p className={styles.meta}>
              Giao dịch thử nghiệm không chuyển tiền thật.
            </p>
          )}
          {formError && (
            <p className={styles.formError} role="alert">
              {formError}
            </p>
          )}
        </div>
        <footer className={styles.dialogFooter}>
          <button
            className={styles.secondary}
            type="button"
            disabled={submitting}
            onClick={closeDialog}
          >
            Quay lại
          </button>
          <button
            className={styles.primary}
            type="button"
            disabled={
              submitting ||
              loading ||
              Boolean(error) ||
              (!canWithdraw && !unconfirmedPayout)
            }
            onClick={() => void createPayout()}
          >
            {submitting && (
              <RefreshCw
                size={16}
                aria-hidden="true"
                className={styles.spinning}
              />
            )}
            {submitting
              ? 'Đang gửi…'
              : unconfirmedPayout
                ? 'Kiểm tra lại yêu cầu'
                : 'Xác nhận rút tiền'}
          </button>
        </footer>
      </Dialog>
    </div>
  )
}
function CalendarIcon() {
  return <CheckCircle2 size={20} aria-hidden="true" />
}
