import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import { resetCompanionStateForTests } from './companion-state'
import { useCompanionState } from './use-companion-state'

const state = (goal: 'SLEEP' | null, revision: number) => ({
  focus: goal ? { goal, chosenOn: '2026-11-27' } : null,
  chapters: [],
  commitments: [],
  ui: { guide: null, seen: [] },
  revision,
})

describe('useCompanionState', () => {
  beforeEach(() => resetCompanionStateForTests())

  it('loads the state once and follows a patch made through it', async () => {
    mockServer.use(
      http.get('/api/companion-state', () => HttpResponse.json(state(null, 1))),
      http.patch('/api/companion-state', () =>
        HttpResponse.json(state('SLEEP', 2)),
      ),
    )

    const { result } = renderHook(() => useCompanionState('acc-hook'))
    expect(result.current.state).toBeNull()
    await waitFor(() => expect(result.current.state?.revision).toBe(1))

    await act(async () => {
      await result.current.patch({
        focus: { goal: 'SLEEP', chosenOn: '2026-11-27' },
      })
    })

    expect(result.current.state?.focus?.goal).toBe('SLEEP')
  })

  it('stays null, without throwing, when there is no account or the server fails', async () => {
    mockServer.use(http.get('/api/companion-state', () => HttpResponse.error()))

    const signedOut = renderHook(() => useCompanionState(null))
    await expect(signedOut.result.current.refresh()).resolves.toBeNull()
    await expect(
      signedOut.result.current.patch({ guide: null }),
    ).resolves.toBeNull()

    const failing = renderHook(() => useCompanionState('acc-down'))
    await expect(failing.result.current.refresh()).resolves.toBeNull()
    expect(failing.result.current.state).toBeNull()
  })
})
