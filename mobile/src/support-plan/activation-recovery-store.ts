import * as SecureStore from 'expo-secure-store'
import { z } from 'zod'

const markerSchema = z
  .object({
    planId: z.uuid(),
    version: z.number().int().nonnegative(),
    key: z.uuid(),
  })
  .strict()

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}
const storageKey = (subject: string) =>
  `mentalbridge.plan.activation.${z.uuid().parse(subject)}`

export const activationRecoveryStore = {
  async read(subject: string) {
    const value = await SecureStore.getItemAsync(storageKey(subject), options)
    if (value === null) return null
    return markerSchema.parse(JSON.parse(value))
  },
  async write(subject: string, marker: z.infer<typeof markerSchema>) {
    await SecureStore.setItemAsync(
      storageKey(subject),
      JSON.stringify(markerSchema.parse(marker)),
      options,
    )
  },
  async remove(subject: string) {
    await SecureStore.deleteItemAsync(storageKey(subject), options)
  },
}
