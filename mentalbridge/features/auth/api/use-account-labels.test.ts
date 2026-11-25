import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  useAccountLabels,
  useSubscriptionBuyerLabels,
} from './use-account-labels'

const api = vi.hoisted(() => ({
  profile: vi.fn(),
  account: vi.fn(),
  subscription: vi.fn(),
}))
vi.mock('@/features/specialist-profile/api/browser-client', () => ({
  browserConsultation: { detail: api.profile },
}))
vi.mock('./browser-admin-accounts', () => ({
  browserAdminAccounts: { detail: api.account },
}))
vi.mock('@/features/reconciliation/api/browser-client', () => ({
  browserCommercialReconciliation: { getSubscriptionDetail: api.subscription },
}))

// The label cache lives for the page session, so every test uses its own ids.
describe('useAccountLabels', () => {
  beforeEach(() => vi.clearAllMocks())

  it('names a specialist from the consultation profile and asks once per id', async () => {
    api.profile.mockResolvedValue({ data: { displayName: 'ThS. Thu Hà' } })
    const { result, rerender } = renderHook(
      ({ ids }) => useAccountLabels(ids, 'SPECIALIST'),
      { initialProps: { ids: ['spec-a', 'spec-a', ''] } },
    )
    await waitFor(() =>
      expect(result.current).toEqual({ 'spec-a': 'ThS. Thu Hà' }),
    )
    rerender({ ids: ['spec-a'] })
    expect(api.profile).toHaveBeenCalledTimes(1)
    expect(api.account).not.toHaveBeenCalled()
  })

  it('labels other accounts with their email and shares the lookup between hooks', async () => {
    api.account.mockResolvedValue({ data: { email: 'user@example.com' } })
    const first = renderHook(() => useAccountLabels(['user-a']))
    const second = renderHook(() => useAccountLabels(['user-a']))
    await waitFor(() =>
      expect(first.result.current['user-a']).toBe('user@example.com'),
    )
    await waitFor(() =>
      expect(second.result.current['user-a']).toBe('user@example.com'),
    )
    expect(api.account).toHaveBeenCalledTimes(1)
  })

  it('leaves a failed id unlabelled, keeps the rest, and retries on a later mount', async () => {
    api.account.mockImplementation(async (id: string) => {
      if (id === 'user-bad') throw new Error('boom')
      return { data: { email: 'ok@example.com' } }
    })
    const { result } = renderHook(() =>
      useAccountLabels(['user-bad', 'user-ok']),
    )
    await waitFor(() =>
      expect(result.current['user-ok']).toBe('ok@example.com'),
    )
    expect(result.current).not.toHaveProperty('user-bad')

    api.account.mockResolvedValue({ data: { email: 'back@example.com' } })
    const retry = renderHook(() => useAccountLabels(['user-bad']))
    await waitFor(() =>
      expect(retry.result.current['user-bad']).toBe('back@example.com'),
    )
  })

  it('resolves a subscription to its buyer email', async () => {
    api.subscription.mockResolvedValue({ userAccountId: 'buyer-1' })
    api.account.mockResolvedValue({ data: { email: 'buyer@example.com' } })
    const { result } = renderHook(() => useSubscriptionBuyerLabels(['sub-1']))
    await waitFor(() =>
      expect(result.current).toEqual({ 'sub-1': 'buyer@example.com' }),
    )
    expect(api.account).toHaveBeenCalledWith('buyer-1')
  })
})
