import type { AxiosInstance } from 'axios'
import { z } from 'zod'

import { ApiError, toApiError } from '@/api/api-error'

import {
  careCurrentSupportPlanV3Schema,
  careDraftSupportPlanV3Schema,
  careSupportPlanHistoryV3Schema,
  createCareOwnershipAdapter,
  planPaymentHistorySchema,
  planPaymentSchema,
  serviceCreditEntitlementSchema,
  servicePlanCatalogueSchema,
  type CareOwnershipAdapter,
  type CareOwnershipSessionBinding,
  type PlanPayment,
  type PlanPaymentHistory,
  type ServiceCreditEntitlement,
  type ServicePlanCatalogue,
} from './support-plan-access-contract'

const uuidSchema = z.uuid()
const idempotencyKeySchema = z.string().regex(/^[!-~]{16,128}$/)

export interface SupportPlanAccessApi {
  getEntitlement(): Promise<ServiceCreditEntitlement>
  getServicePlans(): Promise<ServicePlanCatalogue>
  startCheckout(
    planVersionId: string,
    idempotencyKey: string,
  ): Promise<PlanPayment>
  getPaymentHistory(): Promise<PlanPaymentHistory>
  getPayment(paymentId: string): Promise<PlanPayment>
}

function invalidContract(
  code: string,
  message: string,
  cause?: unknown,
): ApiError {
  return new ApiError({
    code,
    message,
    cause,
  })
}

/**
 * Consultation entitlement & billing API adapter using the app's single authenticated
 * Axios client (`EXPO_PUBLIC_API_BASE_URL`). Verifies subject binding on reads.
 */
export function createSupportPlanAccessApi(
  client: AxiosInstance,
  authenticatedSubject: string,
): SupportPlanAccessApi {
  const expectedSubject = uuidSchema.parse(authenticatedSubject)

  return {
    async getEntitlement() {
      let data: unknown
      try {
        data = (await client.get('/api/v1/service-credits')).data
      } catch (error) {
        throw toApiError(error)
      }

      const parsed = serviceCreditEntitlementSchema.safeParse(data)
      if (!parsed.success) {
        throw invalidContract(
          'ENTITLEMENT_CONTRACT_MISMATCH',
          'Dữ liệu quyền gói từ Consultation không đúng định dạng.',
          parsed.error,
        )
      }
      if (parsed.data.accountId !== expectedSubject) {
        throw invalidContract(
          'ENTITLEMENT_SUBJECT_MISMATCH',
          'Dữ liệu quyền gói không khớp tài khoản hiện tại.',
        )
      }
      return parsed.data
    },

    async getServicePlans() {
      let data: unknown
      try {
        data = (await client.get('/api/v1/service-plans')).data
      } catch (error) {
        throw toApiError(error)
      }

      const parsed = servicePlanCatalogueSchema.safeParse(data)
      if (!parsed.success) {
        throw invalidContract(
          'SERVICE_PLANS_CONTRACT_MISMATCH',
          'Danh sách gói dịch vụ không đúng định dạng.',
          parsed.error,
        )
      }
      return parsed.data
    },

    async startCheckout(planVersionId, idempotencyKey) {
      const validPlanVersionId = uuidSchema.parse(planVersionId)
      const validKey = idempotencyKeySchema.parse(idempotencyKey)

      let data: unknown
      try {
        data = (
          await client.post(
            '/api/v1/subscriptions/checkout',
            { planVersionId: validPlanVersionId },
            { headers: { 'Idempotency-Key': validKey } },
          )
        ).data
      } catch (error) {
        throw toApiError(error)
      }

      const parsed = planPaymentSchema.safeParse(data)
      if (!parsed.success) {
        throw invalidContract(
          'PAYMENT_CONTRACT_MISMATCH',
          'Thông tin giao dịch trả về không hợp lệ.',
          parsed.error,
        )
      }
      return parsed.data
    },

    async getPaymentHistory() {
      let data: unknown
      try {
        data = (await client.get('/api/v1/payments')).data
      } catch (error) {
        throw toApiError(error)
      }

      const parsed = planPaymentHistorySchema.safeParse(data)
      if (!parsed.success) {
        throw invalidContract(
          'PAYMENT_HISTORY_CONTRACT_MISMATCH',
          'Lịch sử thanh toán không đúng định dạng.',
          parsed.error,
        )
      }
      return parsed.data
    },

    async getPayment(paymentId) {
      const validPaymentId = uuidSchema.parse(paymentId)
      let data: unknown
      try {
        data = (
          await client.get(
            `/api/v1/payments/${encodeURIComponent(validPaymentId)}`,
          )
        ).data
      } catch (error) {
        throw toApiError(error)
      }

      const parsed = planPaymentSchema.safeParse(data)
      if (!parsed.success) {
        throw invalidContract(
          'PAYMENT_CONTRACT_MISMATCH',
          'Trạng thái thanh toán không đúng định dạng.',
          parsed.error,
        )
      }
      if (parsed.data.paymentId !== validPaymentId) {
        throw invalidContract(
          'PAYMENT_IDENTITY_MISMATCH',
          'Mã giao dịch phản hồi không khớp yêu cầu.',
        )
      }
      return parsed.data
    },
  }
}

/**
 * Creates a session-bound `CareOwnershipAdapter` backed directly by the app's single
 * authenticated Care `AxiosInstance` (`GET /api/v2/support-plans/current`,
 * `GET /api/v2/support-plans/current-draft`, `GET /api/v2/support-plans/history`).
 *
 * Compatible with MB-702 `createSupportPlanActionApi(client)` (`getCurrent`, `getDraft`,
 * `getHistory`) while preserving strict Care v3 schema validation and session binding.
 */
export function createHttpCareOwnershipAdapter(
  client: AxiosInstance,
  sessionBinding: CareOwnershipSessionBinding | string,
): CareOwnershipAdapter {
  const cursorSchema = z.string().min(1).max(256)
  return createCareOwnershipAdapter(
    {
      async getCurrent() {
        let data: unknown
        try {
          data = (await client.get('/api/v2/support-plans/current')).data
        } catch (error) {
          throw toApiError(error)
        }
        const parsed = careCurrentSupportPlanV3Schema.safeParse(data)
        if (!parsed.success) {
          throw invalidContract(
            'CARE_SUPPORT_PLAN_CONTRACT_MISMATCH',
            'Dữ liệu Kế hoạch hỗ trợ hiện tại từ Care không đúng định dạng v3.',
            parsed.error,
          )
        }
        return parsed.data
      },

      async getDraft() {
        let data: unknown
        try {
          data = (await client.get('/api/v2/support-plans/current-draft')).data
        } catch (error) {
          throw toApiError(error)
        }
        const parsed = careDraftSupportPlanV3Schema.safeParse(data)
        if (!parsed.success) {
          throw invalidContract(
            'CARE_SUPPORT_PLAN_DRAFT_CONTRACT_MISMATCH',
            'Dữ liệu bản nháp Kế hoạch hỗ trợ từ Care không đúng định dạng v3.',
            parsed.error,
          )
        }
        return parsed.data
      },

      async getHistory(cursor?: string) {
        const validCursor =
          cursor === undefined ? undefined : cursorSchema.parse(cursor)
        let data: unknown
        try {
          data = (
            await client.get('/api/v2/support-plans/history', {
              params: {
                limit: 10,
                ...(validCursor ? { cursor: validCursor } : {}),
              },
            })
          ).data
        } catch (error) {
          throw toApiError(error)
        }
        const parsed = careSupportPlanHistoryV3Schema.safeParse(data)
        if (!parsed.success) {
          throw invalidContract(
            'CARE_SUPPORT_PLAN_HISTORY_CONTRACT_MISMATCH',
            'Lịch sử Kế hoạch hỗ trợ từ Care không đúng định dạng v3.',
            parsed.error,
          )
        }
        return parsed.data
      },
    },
    sessionBinding,
  )
}
