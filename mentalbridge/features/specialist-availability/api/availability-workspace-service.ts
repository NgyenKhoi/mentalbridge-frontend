import type {
  AvailabilitySlot,
  AvailabilitySlotList,
  PublishAvailabilityInput,
} from '@/lib/consultation/consultation-validation'
import { AvailabilityBrowserError, browserAvailability } from './browser-client'

export { AvailabilityBrowserError } from './browser-client'

type WorkspaceResponse = AvailabilitySlotList & {
  restDays?: string[]
  features?: { repeatWeekly?: boolean }
}

export const availabilityWorkspaceService = {
  async load() {
    const { data } = await browserAvailability.list()
    const response = data as WorkspaceResponse
    return {
      slots: response.items,
      videoEnabled: response.videoPublishingEnabled,
      restDays: Array.isArray(response.restDays) ? response.restDays : [],
      repeatWeeklyEnabled: response.features?.repeatWeekly === true,
    }
  },

  async publish(input: PublishAvailabilityInput, idempotencyKey: string, repeatWeekly: boolean) {
    if (!repeatWeekly) {
      const { data } = await browserAvailability.publish(input, idempotencyKey)
      return [data]
    }

    const response = await fetch('/api/consultation/availability-slots', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json, application/problem+json',
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ ...input, repeatWeekly: true }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      const problem = body as { title?: string; code?: string } | null
      throw new AvailabilityBrowserError(
        response.status,
        problem?.code ?? 'REQUEST_FAILED',
        problem?.title ?? 'Không thể xuất bản khung giờ.',
      )
    }
    if (!Array.isArray(body))
      throw new AvailabilityBrowserError(502, 'REQUEST_FAILED', 'Không thể đọc kết quả xuất bản khung giờ.')
    return body as AvailabilitySlot[]
  },

  async withdraw(slot: AvailabilitySlot) {
    const { data } = await browserAvailability.withdraw(slot.id, slot.version)
    return data
  },
}
