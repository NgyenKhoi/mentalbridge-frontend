import { QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { Button, View } from 'react-native'

import { createQueryClient } from '@/query/query-client'

import type { SessionService } from './identity-session-service'
import { SessionProvider, useSession } from './session-context'
import { useCompanionSessionPreferences } from '@/support-plan-companion/companion-session'

function createSessionService(): jest.Mocked<SessionService> {
  return {
    signIn: jest.fn(),
    restore: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    registerUser: jest.fn(),
    verifyEmail: jest.fn(),
    requestEmailVerification: jest.fn(),
    requestPasswordRecovery: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
  }
}

function SignOutHarness() {
  const { signOut, status } = useSession()
  const { muted, setMuted } = useCompanionSessionPreferences('account-1')

  return (
    <View>
      <Button title={status} onPress={() => void signOut()} />
      <Button
        title={muted ? 'companion-muted' : 'companion-unmuted'}
        onPress={() => setMuted(!muted)}
      />
    </View>
  )
}

function PasswordChangeHarness() {
  const { changePassword, status } = useSession()

  return (
    <Button
      title={status}
      onPress={() =>
        void changePassword('correct-password', 'new-correct-password')
      }
    />
  )
}

describe('mobile session context', () => {
  it('clears account-scoped server state after logout succeeds', async () => {
    const queryClient = createQueryClient()
    const service = createSessionService()
    service.logout.mockResolvedValue()
    queryClient.setQueryData(['care-profile', 'account-1'], {
      displayName: 'Sensitive profile',
    })

    await render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider
          initialSession={{ role: 'USER', subject: 'account-1' }}
          service={service}
        >
          <SignOutHarness />
        </SessionProvider>
      </QueryClientProvider>,
    )

    await fireEvent.press(
      screen.getByRole('button', { name: 'companion-unmuted' }),
    )
    expect(
      screen.getByRole('button', { name: 'companion-muted' }),
    ).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'authenticated' }))

    await waitFor(() => {
      expect(service.logout).toHaveBeenCalledTimes(1)
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
      expect(
        screen.getByRole('button', { name: 'unauthenticated' }),
      ).toBeOnTheScreen()
      expect(
        screen.getByRole('button', { name: 'companion-unmuted' }),
      ).toBeOnTheScreen()
    })
  })

  it('clears account-scoped server state when server revocation is unavailable', async () => {
    const queryClient = createQueryClient()
    const service = createSessionService()
    service.logout.mockRejectedValue(new Error('Identity unavailable'))
    queryClient.setQueryData(['care-profile', 'account-1'], {
      displayName: 'Sensitive profile',
    })

    await render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider
          initialSession={{ role: 'USER', subject: 'account-1' }}
          service={service}
        >
          <SignOutHarness />
        </SessionProvider>
      </QueryClientProvider>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'authenticated' }))

    await waitFor(() => {
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
      expect(
        screen.getByRole('button', { name: 'unauthenticated' }),
      ).toBeOnTheScreen()
    })
  })

  it('runs the before-sign-out hook before logout, and still logs out when it fails', async () => {
    const service = createSessionService()
    service.logout.mockResolvedValue()
    const order: string[] = []
    service.logout.mockImplementation(async () => {
      order.push('logout')
    })
    const beforeSignOut = jest.fn(async () => {
      order.push('hook')
      throw new Error('revoke failed')
    })

    await render(
      <QueryClientProvider client={createQueryClient()}>
        <SessionProvider
          beforeSignOut={beforeSignOut}
          initialSession={{ role: 'USER', subject: 'account-1' }}
          service={service}
        >
          <SignOutHarness />
        </SessionProvider>
      </QueryClientProvider>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'authenticated' }))

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'unauthenticated' }),
      ).toBeOnTheScreen()
    })
    expect(order).toEqual(['hook', 'logout'])
  })

  it('does not wait longer than the bound for a hung before-sign-out hook', async () => {
    jest.useFakeTimers()
    try {
      const service = createSessionService()
      service.logout.mockResolvedValue()

      await render(
        <QueryClientProvider client={createQueryClient()}>
          <SessionProvider
            beforeSignOut={() => new Promise<void>(() => undefined)}
            initialSession={{ role: 'USER', subject: 'account-1' }}
            service={service}
          >
            <SignOutHarness />
          </SessionProvider>
        </QueryClientProvider>,
      )

      await fireEvent.press(
        screen.getByRole('button', { name: 'authenticated' }),
      )
      expect(service.logout).not.toHaveBeenCalled()

      await act(async () => {
        jest.advanceTimersByTime(3_000)
      })
      expect(service.logout).toHaveBeenCalledTimes(1)
    } finally {
      jest.useRealTimers()
    }
  })

  it('clears the authenticated state only after Identity changes the password', async () => {
    const queryClient = createQueryClient()
    const service = createSessionService()
    service.changePassword.mockResolvedValue()
    queryClient.setQueryData(['care-profile', 'account-1'], {
      displayName: 'Sensitive profile',
    })

    await render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider
          initialSession={{ role: 'USER', subject: 'account-1' }}
          service={service}
        >
          <PasswordChangeHarness />
        </SessionProvider>
      </QueryClientProvider>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'authenticated' }))

    await waitFor(() => {
      expect(service.changePassword).toHaveBeenCalledWith(
        'correct-password',
        'new-correct-password',
      )
      expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
      expect(
        screen.getByRole('button', { name: 'unauthenticated' }),
      ).toBeOnTheScreen()
    })
  })

  it('transitions to unauthenticated immediately when logout starts before server revocation resolves', async () => {
    const queryClient = createQueryClient()
    const service = createSessionService()
    let resolveLogout!: () => void
    service.logout.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLogout = resolve
      }),
    )
    queryClient.setQueryData(['care-profile', 'account-1'], {
      displayName: 'Sensitive profile',
    })

    await render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider
          initialSession={{ role: 'USER', subject: 'account-1' }}
          service={service}
        >
          <SignOutHarness />
        </SessionProvider>
      </QueryClientProvider>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'authenticated' }))

    expect(service.logout).toHaveBeenCalledTimes(1)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(
      screen.getByRole('button', { name: 'unauthenticated' }),
    ).toBeOnTheScreen()

    resolveLogout()
  })

  it('hides authenticated UI immediately while keeping credentials available for beforeSignOut', async () => {
    const queryClient = createQueryClient()
    const service = createSessionService()
    let credentialsValid = true
    let hookObservedCredentials = false
    let resolveHook!: () => void
    const beforeSignOut = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          hookObservedCredentials = credentialsValid
          resolveHook = resolve
        }),
    )
    service.logout.mockImplementation(async () => {
      credentialsValid = false
    })

    await render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider
          beforeSignOut={beforeSignOut}
          initialSession={{ role: 'USER', subject: 'account-1' }}
          service={service}
        >
          <SignOutHarness />
        </SessionProvider>
      </QueryClientProvider>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'authenticated' }))

    expect(
      screen.getByRole('button', { name: 'unauthenticated' }),
    ).toBeOnTheScreen()
    expect(beforeSignOut).toHaveBeenCalledTimes(1)
    expect(hookObservedCredentials).toBe(true)
    expect(service.logout).not.toHaveBeenCalled()

    await act(async () => {
      resolveHook()
    })
    expect(service.logout).toHaveBeenCalledTimes(1)
  })

  it('ignores a pending signIn that resolves after signOut and revokes stale credentials', async () => {
    const queryClient = createQueryClient()
    const service = createSessionService()
    let resolveSignIn!: (value: {
      session: { role: 'USER'; subject: string }
      accessExpiresAt: string
    }) => void
    service.signIn.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve
      }),
    )
    service.logout.mockResolvedValue()

    function ConcurrencyHarness() {
      const { session, signIn, signOut, status } = useSession()
      return (
        <View>
          <Button
            title={`${status}:${session?.subject ?? 'none'}`}
            onPress={() => void signOut()}
          />
          <Button
            title="start-sign-in"
            onPress={() => void signIn('user@example.com', 'password')}
          />
        </View>
      )
    }

    await render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider
          initialSession={{ role: 'USER', subject: 'account-1' }}
          service={service}
        >
          <ConcurrencyHarness />
        </SessionProvider>
      </QueryClientProvider>,
    )

    await fireEvent.press(screen.getByRole('button', { name: 'start-sign-in' }))
    await fireEvent.press(
      screen.getByRole('button', { name: 'authenticated:account-1' }),
    )

    expect(
      screen.getByRole('button', { name: 'unauthenticated:none' }),
    ).toBeOnTheScreen()

    await act(async () => {
      resolveSignIn({
        session: { role: 'USER', subject: 'account-stale' },
        accessExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
      })
    })

    expect(
      screen.getByRole('button', { name: 'unauthenticated:none' }),
    ).toBeOnTheScreen()
    expect(service.logout).toHaveBeenCalledTimes(2)
  })

  it('keeps the new session active when an earlier pending logout finishes after a new signIn', async () => {
    const queryClient = createQueryClient()
    const service = createSessionService()
    let resolveLogout!: () => void
    service.logout.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLogout = resolve
      }),
    )
    service.signIn.mockResolvedValue({
      session: { role: 'USER', subject: 'account-2' },
      accessExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })

    function ConcurrencyHarness() {
      const { session, signIn, signOut, status } = useSession()
      return (
        <View>
          <Button
            title={`${status}:${session?.subject ?? 'none'}`}
            onPress={() => void signOut()}
          />
          <Button
            title="sign-in-2"
            onPress={() => void signIn('user2@example.com', 'password')}
          />
        </View>
      )
    }

    await render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider
          initialSession={{ role: 'USER', subject: 'account-1' }}
          service={service}
        >
          <ConcurrencyHarness />
        </SessionProvider>
      </QueryClientProvider>,
    )

    await fireEvent.press(
      screen.getByRole('button', { name: 'authenticated:account-1' }),
    )
    expect(
      screen.getByRole('button', { name: 'unauthenticated:none' }),
    ).toBeOnTheScreen()

    await fireEvent.press(screen.getByRole('button', { name: 'sign-in-2' }))
    expect(
      await screen.findByRole('button', { name: 'authenticated:account-2' }),
    ).toBeOnTheScreen()

    await act(async () => {
      resolveLogout()
    })

    expect(
      screen.getByRole('button', { name: 'authenticated:account-2' }),
    ).toBeOnTheScreen()
  })

  it('ignores a pending token refresh that resolves after signOut', async () => {
    const queryClient = createQueryClient()
    const service = createSessionService()
    let resolveRefresh!: (value: {
      session: { role: 'USER'; subject: string }
      accessExpiresAt: string
    }) => void
    service.refresh.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve
      }),
    )
    service.logout.mockResolvedValue()

    await render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider
          initialAccessExpiresAt={new Date(Date.now() + 60_000).toISOString()}
          initialSession={{ role: 'USER', subject: 'account-1' }}
          service={service}
        >
          <SignOutHarness />
        </SessionProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(service.refresh).toHaveBeenCalledTimes(1))
    await fireEvent.press(screen.getByRole('button', { name: 'authenticated' }))
    expect(
      screen.getByRole('button', { name: 'unauthenticated' }),
    ).toBeOnTheScreen()

    await act(async () => {
      resolveRefresh({
        session: { role: 'USER', subject: 'account-1' },
        accessExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
      })
    })

    expect(
      screen.getByRole('button', { name: 'unauthenticated' }),
    ).toBeOnTheScreen()
  })
})
