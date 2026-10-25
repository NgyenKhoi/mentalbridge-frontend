import { QueryClientProvider } from '@tanstack/react-query'
import {
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
})
