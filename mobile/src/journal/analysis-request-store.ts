import * as SecureStore from 'expo-secure-store'
import { z } from 'zod'

const markerSchema = z
  .object({
    requestKey: z.string().min(16).max(128),
    jobId: z.uuid().optional(),
  })
  .strict()
export type AnalysisRequestMarker = z.infer<typeof markerSchema>
export interface AnalysisRequestStore {
  read(subject: string, target: string): Promise<AnalysisRequestMarker | null>
  write(
    subject: string,
    target: string,
    marker: AnalysisRequestMarker,
  ): Promise<void>
  remove(subject: string, target: string): Promise<void>
}
const key = (subject: string, target: string) =>
  `mentalbridge.journal.request.${subject}.${target}`
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

// Only correlation identifiers are retained. Every restore reads the server;
// neither Journal text nor AI output, consent, or entitlement is persisted.
export const analysisRequestStore: AnalysisRequestStore = {
  async read(subject, target) {
    const value = await SecureStore.getItemAsync(key(subject, target), options)
    if (!value) return null
    try {
      const parsed = markerSchema.safeParse(JSON.parse(value))
      return parsed.success ? parsed.data : null
    } catch {
      return null
    }
  },
  async write(subject, target, marker) {
    await SecureStore.setItemAsync(
      key(subject, target),
      JSON.stringify(markerSchema.parse(marker)),
      options,
    )
  },
  async remove(subject, target) {
    await SecureStore.deleteItemAsync(key(subject, target), options)
  },
}
