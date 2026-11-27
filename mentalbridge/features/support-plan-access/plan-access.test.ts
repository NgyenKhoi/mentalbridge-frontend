import { afterEach, describe, expect, it } from 'vitest'
import {
  clearUpgradeIntent,
  hasUpgradeIntent,
  planAccessFrom,
  rememberUpgradeIntent,
} from './plan-access'

describe('planAccessFrom', () => {
  it('reads paid, FREE and expired only from complete owner facts', () => {
    expect(
      planAccessFrom({
        source: 'PAID',
        packageCode: 'PLUS',
        entitlementState: 'ACTIVE',
        supportPlanEnabled: true,
      }),
    ).toBe('paid')
    expect(
      planAccessFrom({
        source: 'DEFAULT_FREE',
        packageCode: 'FREE',
        entitlementState: 'DEFAULT_FREE',
        supportPlanEnabled: false,
      }),
    ).toBe('free')
    expect(
      planAccessFrom({
        source: 'DEFAULT_FREE',
        packageCode: 'FREE',
        entitlementState: 'EXPIRED',
        supportPlanEnabled: false,
      }),
    ).toBe('expired')
  })

  it.each([
    {
      entitlementState: 'ACTIVE',
      supportPlanEnabled: true,
      packageCode: 'PLUS',
    },
    {
      entitlementState: 'ACTIVE',
      supportPlanEnabled: false,
      source: 'PAID',
      packageCode: 'PLUS',
    },
    {
      entitlementState: 'ACTIVE',
      supportPlanEnabled: true,
      source: 'PAID',
      packageCode: 'FREE',
    },
    {
      entitlementState: 'EXPIRED',
      supportPlanEnabled: false,
      source: 'PAID',
      packageCode: 'PLUS',
    },
    { entitlementState: 'DEFAULT_FREE', supportPlanEnabled: false },
    {
      entitlementState: 'DEFAULT_FREE',
      supportPlanEnabled: false,
      source: 'DEFAULT_FREE',
      packageCode: 'PREMIUM',
    },
  ])('rejects incomplete or contradictory access facts: %j', (facts) => {
    expect(planAccessFrom(facts)).toBe('unavailable')
  })

  it('treats missing, outdated or contradictory facts as unavailable, never FREE', () => {
    expect(planAccessFrom(null)).toBe('unavailable')
    expect(
      planAccessFrom({ source: 'DEFAULT_FREE', packageCode: 'FREE' }),
    ).toBe('unavailable')
    expect(
      planAccessFrom({
        source: 'DEFAULT_FREE',
        entitlementState: 'ACTIVE',
        supportPlanEnabled: true,
      }),
    ).toBe('unavailable')
    expect(
      planAccessFrom({
        source: 'DEFAULT_FREE',
        entitlementState: 'EXPIRED',
        supportPlanEnabled: true,
      }),
    ).toBe('unavailable')
  })
})

describe('upgrade intent', () => {
  afterEach(() => sessionStorage.clear())

  it('lasts thirty minutes in this tab and clears itself after', () => {
    rememberUpgradeIntent(1_000)
    expect(hasUpgradeIntent(1_000 + 29 * 60_000)).toBe(true)
    expect(hasUpgradeIntent(1_000 + 30 * 60_000)).toBe(false)
    expect(hasUpgradeIntent(1_000)).toBe(false)
  })

  it('ignores junk and can be cleared', () => {
    sessionStorage.setItem('mb.supportPlanUpgradeIntent', 'https://evil.test')
    expect(hasUpgradeIntent()).toBe(false)
    rememberUpgradeIntent()
    clearUpgradeIntent()
    expect(hasUpgradeIntent()).toBe(false)
  })
})
