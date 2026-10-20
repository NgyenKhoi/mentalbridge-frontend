import { useSyncExternalStore } from 'react'

export type CompanionSessionPreferences = Readonly<{
  muted: boolean
  hidden: boolean
}>

const defaults: CompanionSessionPreferences = { muted: false, hidden: false }
const preferences = new Map<string, CompanionSessionPreferences>()
const listeners = new Map<string, Set<() => void>>()

function read(subject: string) {
  return preferences.get(subject) ?? defaults
}

function subscribe(subject: string, listener: () => void) {
  const current = listeners.get(subject) ?? new Set<() => void>()
  current.add(listener)
  listeners.set(subject, current)
  return () => {
    current.delete(listener)
    if (current.size === 0) listeners.delete(subject)
  }
}

function write(subject: string, change: Partial<CompanionSessionPreferences>) {
  preferences.set(subject, { ...read(subject), ...change })
  listeners.get(subject)?.forEach((listener) => listener())
}

export function useCompanionSessionPreferences(subject: string) {
  const value = useSyncExternalStore(
    (listener) => subscribe(subject, listener),
    () => read(subject),
    () => defaults,
  )
  return {
    ...value,
    setMuted: (muted: boolean) => write(subject, { muted }),
    setHidden: (hidden: boolean) => write(subject, { hidden }),
  }
}

export function resetCompanionSessionPreferences() {
  preferences.clear()
  listeners.forEach((group) => group.forEach((listener) => listener()))
}
