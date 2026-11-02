import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  hasSeenOnboarding,
  onboardingStorageKey,
  rememberOnboarding,
} from './tour-storage'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('onboarding progress', () => {
  it('keeps specialist and USER progress independent for the same account', () => {
    const accountId = 'dual-workspace-owner'
    expect(onboardingStorageKey(accountId)).toBe(
      `mentalbridge:onboarding:v1:${accountId}`,
    )
    rememberOnboarding(accountId, 'completed')
    expect(hasSeenOnboarding(accountId, 'specialist')).toBe(false)
    rememberOnboarding(accountId, 'skipped', 'specialist')
    expect(hasSeenOnboarding(accountId)).toBe(true)
    expect(hasSeenOnboarding(accountId, 'specialist')).toBe(true)
    expect(window.localStorage.getItem(onboardingStorageKey(accountId))).toBe(
      'completed',
    )
    expect(
      window.localStorage.getItem(
        onboardingStorageKey(accountId, 'specialist'),
      ),
    ).toBe('skipped')
    expect(hasSeenOnboarding('another-specialist', 'specialist')).toBe(false)
  })

  it('persists completion and scopes it to the signed-in account', () => {
    expect(hasSeenOnboarding('completion-owner')).toBe(false)
    expect(rememberOnboarding('completion-owner', 'completed')).toBe('local')
    expect(hasSeenOnboarding('completion-owner')).toBe(true)
    expect(hasSeenOnboarding('different-owner')).toBe(false)
    expect(
      window.localStorage.getItem(onboardingStorageKey('completion-owner')),
    ).toBe('completed')
  })

  it('treats an explicit skip as seen without mistaking unknown values for completion', () => {
    window.localStorage.setItem(onboardingStorageKey('skip-owner'), 'skipped')
    window.localStorage.setItem(
      onboardingStorageKey('invalid-owner'),
      'invalid',
    )
    expect(hasSeenOnboarding('skip-owner')).toBe(true)
    expect(hasSeenOnboarding('invalid-owner')).toBe(false)
  })

  it('keeps a session fallback when browser storage writes are blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    expect(rememberOnboarding('blocked-write-owner', 'skipped')).toBe('session')
    expect(hasSeenOnboarding('blocked-write-owner')).toBe(true)
  })

  it('can still start for a new account when storage reads are blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    expect(hasSeenOnboarding('blocked-read-owner')).toBe(false)
    rememberOnboarding('blocked-read-owner', 'completed')
    expect(hasSeenOnboarding('blocked-read-owner')).toBe(true)
  })
})
