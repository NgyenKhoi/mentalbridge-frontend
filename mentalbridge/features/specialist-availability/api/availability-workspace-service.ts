import type {
  AvailabilitySlot,
  PublishAvailabilityInput,
} from '@/lib/consultation/consultation-validation'
import { AvailabilityBrowserError, browserAvailability } from './browser-client'

export { AvailabilityBrowserError } from './browser-client'

export const availabilityWorkspaceService = {
  async load() {
    const { data } = await browserAvailability.list()
    return {
      slots: data.items,
      videoEnabled: data.videoPublishingEnabled,
      restDays: [],
      repeatWeeklyEnabled: false,
    }
  },

  async publish(
    input: PublishAvailabilityInput,
    idempotencyKey: string,
    repeatWeekly: boolean,
  ) {
    if (repeatWeekly) {
      throw new AvailabilityBrowserError(
        422,
        'UNSUPPORTED_FEATURE',
        'Lặp lại hằng tuần chưa khả dụng.',
      )
    }
    const { data } = await browserAvailability.publish(input, idempotencyKey)
    return [data]
  },

  async withdraw(slot: AvailabilitySlot) {
    const { data } = await browserAvailability.withdraw(slot.id, slot.version)
    return data
  },
}
