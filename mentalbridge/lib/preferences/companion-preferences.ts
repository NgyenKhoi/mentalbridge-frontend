// Device-local companion preferences (SupportPlan companion, Mầm). Storage can
// be blocked, so every value also lives in memory for the page lifetime.

const PREFERENCE_EVENT = 'mentalbridge:companion-preference'
const memoryPreferences = new Map<string, string>()
const volatilePreferences = new Set<string>()

export type PreferenceScope = 'local' | 'session'

export function subscribePreferences(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null) {
      volatilePreferences.clear()
    } else {
      volatilePreferences.delete(event.key)
    }
    onChange()
  }

  window.addEventListener('storage', onStorage)
  window.addEventListener(PREFERENCE_EVENT, onChange)

  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(PREFERENCE_EVENT, onChange)
  }
}

function preferenceStorage(scope: PreferenceScope) {
  return scope === 'session' ? window.sessionStorage : window.localStorage
}

export function readPreference(key: string, scope: PreferenceScope) {
  if (volatilePreferences.has(key)) {
    return memoryPreferences.get(key) ?? null
  }
  try {
    const value = preferenceStorage(scope).getItem(key)
    if (value === null) {
      memoryPreferences.delete(key)
    } else {
      memoryPreferences.set(key, value)
    }
    return value
  } catch {
    return memoryPreferences.get(key) ?? null
  }
}

export function storedPreference(
  key: string,
  expected: string,
  scope: PreferenceScope,
) {
  return readPreference(key, scope) === expected
}

export function writePreference(
  key: string,
  value: string,
  scope: PreferenceScope,
) {
  memoryPreferences.set(key, value)
  try {
    preferenceStorage(scope).setItem(key, value)
    volatilePreferences.delete(key)
  } catch {
    volatilePreferences.add(key)
    // Restricted storage keeps the preference for the current page lifetime.
  }
  window.dispatchEvent(new Event(PREFERENCE_EVENT))
}
