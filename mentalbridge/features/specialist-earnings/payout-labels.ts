import type { components } from '@/contracts/consultation.generated'

type Provider = components['schemas']['SpecialistPayout']['provider']
type Reconciliation = NonNullable<
  components['schemas']['SpecialistPayout']['reconciliationStatus']
>

// One name per provider on every payout screen (specialist, admin, reconciliation).
export const payoutProviderName: Record<Provider, string> = {
  PAYOS: 'PayOS',
  MOMO: 'MoMo',
  FAKE: 'Mô phỏng',
}

// Admin-facing failure lines; the specialist never sees these raw codes.
export const adminFailureLines: Record<string, string> = {
  PAYOUT_INSUFFICIENT_BALANCE:
    'Số dư chi hộ PayOS không đủ. Nạp thêm rồi chuyển lại.',
  PAYOUT_SERVICE_CREDITS_INSUFFICIENT:
    'Hết phí dịch vụ PayOS. Nạp thêm rồi chuyển lại.',
  PAYOUT_PROVIDER_REJECTED: 'Ngân hàng từ chối giao dịch.',
  PAYOUT_SUBMISSION_UNKNOWN:
    'Chưa rõ PayOS đã nhận lệnh hay chưa. Đang đối soát.',
  PAYOUT_RECONCILIATION_OVERDUE:
    'Quá 24 giờ chưa có kết quả. Kiểm tra trên PayOS trước khi xử lý.',
}

export const adminPayoutStatusLabels: Record<string, string> = {
  PENDING: 'Đang tiếp nhận',
  PROCESSING: 'Đang xử lý',
  SUCCEEDED: 'Đã thanh toán',
  FAILED: 'Chưa thành công',
  UNKNOWN: 'Cần đối soát',
}

// Needs-review beats the raw status so an operator never reads UNKNOWN as "failed".
export function adminPayoutStatusLabel(
  status: string,
  reconciliationStatus?: Reconciliation | null,
  closedAt?: string | null,
) {
  if (closedAt) return 'Đã đóng'
  if (reconciliationStatus === 'NEEDS_REVIEW') return 'Cần kiểm tra'
  return adminPayoutStatusLabels[status] ?? status
}

// "970436 ****7890" -> "••••7890": the BIN is a system detail. Other hint formats pass through.
export function maskedHint(hint: string) {
  const match = /^\d{6}\s+[*•]+(\S+)$/.exec(hint.trim())
  return match ? `••••${match[1]}` : hint
}
