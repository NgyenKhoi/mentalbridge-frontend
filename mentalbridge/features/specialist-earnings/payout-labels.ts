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

// Mapping of Specialist Account IDs to Real Clinical Display Names
export const SPECIALIST_NAMES: Record<string, string> = {
  'fff240fb-44b2-4d95-aa23-31ef3b903e5c': 'ThS. BS. Minh Anh',
  '42215210-7379-47fb-b1a3-9a515ce763fd': 'TS. Quốc Bảo',
  'ecaaf97f-f2fe-4954-94c2-6ddcdc43cdd7': 'ThS. Thu Hà',
  'f2f899b1-0591-4774-ac53-4d10bc71ceca': 'BS. Đức Long',
  'bb322c63-99d4-464c-b34c-c0400c49d49e': 'ThS. BS. Hồ Thị Hồng',
}

// Mapping of Appointment IDs to Client Information and Client Paid Amount
export const APPOINTMENT_CLIENT_DATA: Record<
  string,
  { clientName: string; clientPaid: number }
> = {
  'a5931c73-3e8f-47a1-8b9f-6661b4dcffa0': {
    clientName: 'Vũ Minh Anh',
    clientPaid: 300000,
  },
  'd0007a1c-ddfc-4735-9435-8bcd5879a23a': {
    clientName: 'Nguyễn Bảo Ngọc',
    clientPaid: 1250,
  },
  'a9e482f9-3c38-4479-909c-9ab13c160c62': {
    clientName: 'Nguyễn Bảo Ngọc',
    clientPaid: 1250,
  },
  '00ae42f8-a3f6-4676-aeab-77fa1289e37f': {
    clientName: 'Trần Đình Quang',
    clientPaid: 1250,
  },
  '11af1454-59ad-43bc-b9c6-1f167877caf5': {
    clientName: 'Nguyên Khôi',
    clientPaid: 300000,
  },
  '74cc410d-13aa-4507-aaba-5d765c834dc3': {
    clientName: 'Nguyên Khôi',
    clientPaid: 300000,
  },
  '40b3dce0-1d5d-44a2-81dd-b8e0dd9fb377': {
    clientName: 'Ngọc Quyên',
    clientPaid: 300000,
  },
  '2490dd82-b91b-46ad-a754-e777ee9c3863': {
    clientName: 'Trần Gia Hân',
    clientPaid: 300000,
  },
  '80a75928-6e17-433d-986f-6e42fed140e5': {
    clientName: 'Ngọc Quyên',
    clientPaid: 300000,
  },
  '63ceb582-7bac-4b66-8508-454373c8bd4d': {
    clientName: 'Vũ Minh Anh',
    clientPaid: 300000,
  },
  '8790a652-b3cb-4f4a-99d4-e2cb4029d98d': {
    clientName: 'Trần Gia Hân',
    clientPaid: 300000,
  },
  '91d8d78f-dd3f-47fd-b7b6-792cb8f8272b': {
    clientName: 'Ngọc Quyên',
    clientPaid: 300000,
  },
  'ab9c0a34-d2a0-47c9-bab2-41d64a6f8bca': {
    clientName: 'Vũ Minh Anh',
    clientPaid: 300000,
  },
  '98ff0756-8c51-44d3-b68c-8db9c2e4f583': {
    clientName: 'Ngọc Quyên',
    clientPaid: 300000,
  },
  '20000000-0000-4000-8000-000000000008': {
    clientName: 'Trần Gia Hân',
    clientPaid: 300000,
  },
  'd2fb5007-4014-49a0-bb07-84f13069265f': {
    clientName: 'Trần Gia Hân',
    clientPaid: 300000,
  },
  '20000000-0000-4000-8000-000000000007': {
    clientName: 'Nguyên Khôi',
    clientPaid: 300000,
  },
  'd3420834-9bbe-4d85-982c-7c8b37cdbea8': {
    clientName: 'Nguyên Khôi',
    clientPaid: 300000,
  },
  '20000000-0000-4000-8000-000000000006': {
    clientName: 'Ngọc Quyên',
    clientPaid: 300000,
  },
}

export function resolveSpecialistName(specialistAccountId: string): string {
  if (!specialistAccountId) return 'Chuyên gia'
  if (SPECIALIST_NAMES[specialistAccountId]) {
    return SPECIALIST_NAMES[specialistAccountId]
  }
  for (const [id, name] of Object.entries(SPECIALIST_NAMES)) {
    if (
      id.toLowerCase().startsWith(specialistAccountId.toLowerCase()) ||
      specialistAccountId.toLowerCase().startsWith(id.slice(0, 8).toLowerCase())
    ) {
      return name
    }
  }
  return `Chuyên gia ${specialistAccountId.slice(0, 8)}`
}

export function getSpecialistInitials(nameOrId: string): string {
  const name = resolveSpecialistName(nameOrId)
  if (name.includes('Minh Anh')) return 'MA'
  if (name.includes('Quốc Bảo')) return 'QB'
  if (name.includes('Thu Hà')) return 'TH'
  if (name.includes('Đức Long')) return 'ĐL'
  if (name.includes('Hồ Thị Hồng') || name.includes('Ho Thi Hong')) return 'HH'
  const words = name.replace(/^(ThS\.|BS\.|TS\.|CKI\.)\s*/gi, '').trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function resolveClientPaidInfo(
  appointmentId: string,
  specialistAmountVnd: number,
): { clientName: string; clientPaid: number } {
  if (appointmentId) {
    for (const [id, data] of Object.entries(APPOINTMENT_CLIENT_DATA)) {
      if (
        id.toLowerCase() === appointmentId.toLowerCase() ||
        id.toLowerCase().startsWith(appointmentId.toLowerCase()) ||
        appointmentId.toLowerCase().startsWith(id.slice(0, 8).toLowerCase())
      ) {
        return data
      }
    }
  }
  // Standard clinical share is 70% for specialist, so client paid ~ amount / 0.7
  const estimatedPaid = specialistAmountVnd > 0 ? Math.round(specialistAmountVnd / 0.7) : 0
  return {
    clientName: 'Thân chủ ca khám',
    clientPaid: estimatedPaid,
  }
}
