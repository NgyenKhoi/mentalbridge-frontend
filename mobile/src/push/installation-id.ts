import { randomUUID } from 'expo-crypto'
import * as SecureStore from 'expo-secure-store'
import { z } from 'zod'

import { INSTALLATION_ID_KEY } from './push-constants'

// App-generated, not a hardware identifier; survives sign-out so revoke targets the same row.
export async function getInstallationId(): Promise<string> {
  const stored = await SecureStore.getItemAsync(INSTALLATION_ID_KEY)
  const existing = z.uuid().safeParse(stored)
  if (existing.success) return existing.data

  const created = randomUUID()
  await SecureStore.setItemAsync(INSTALLATION_ID_KEY, created)
  return created
}
