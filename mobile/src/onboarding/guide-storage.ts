import * as SecureStore from 'expo-secure-store'
import type { GuideRole } from './guide-steps'

const seen = new Set<string>()
export const guideKey = (subject: string, role: GuideRole) =>
  `onboarding.v1.${role}.${subject}`
export async function hasSeenGuide(subject: string, role: GuideRole) {
  const key = guideKey(subject, role)
  if (seen.has(key)) return true
  try {
    const value = await SecureStore.getItemAsync(key)
    return seen.has(key) || value === 'completed' || value === 'skipped'
  } catch {
    return seen.has(key)
  }
}
export async function rememberGuide(
  subject: string,
  role: GuideRole,
  outcome: 'completed' | 'skipped',
) {
  const key = guideKey(subject, role)
  seen.add(key)
  try {
    await SecureStore.setItemAsync(key, outcome)
  } catch {
    /* Keep the session preference when device storage is unavailable. */
  }
}
