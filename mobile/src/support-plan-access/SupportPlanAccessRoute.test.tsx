import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { AxiosInstance } from 'axios'

import { createApiClient } from '@/api/api-client'
import type { AppSession } from '@/auth/session'

import { SupportPlanAccessRoute } from './SupportPlanAccessRoute'
import {
  USER_A_SUBJECT,
  makeCatalogue,
  makeEntitlement,
} from './support-plan-access-test-fixtures'

let mockSession: AppSession | null = { subject: USER_A_SUBJECT, role: 'USER' }

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: mockSession }),
}))

jest.mock('@/config/runtime-config-context', () => ({
  useRuntimeConfig: () => ({
    apiBaseUrl: 'https://api.test.mentalbridge',
    apiTimeoutMs: 5000,
  }),
}))

jest.mock('@/security/credential-store', () => ({
  secureCredentialStore: {
    getAccessToken: jest.fn(async () => 'test-access-token'),
  },
}))

jest.mock('@/api/api-client', () => ({
  createApiClient: jest.fn(),
}))

const activeClients: QueryClient[] = []

function makeQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
  activeClients.push(client)
  return client
}

describe('SupportPlanAccessRoute', () => {
  afterEach(() => {
    cleanup()
    for (const client of activeClients.splice(0)) {
      client.clear()
    }
  })
  it('fails closed when session is unauthenticated or not USER, and binds NetInfo offline state when authenticated', async () => {
    let netInfoListener: ((state: NetInfoState) => void) | undefined
    ;(NetInfo.addEventListener as jest.Mock).mockImplementation((listener) => {
      netInfoListener = listener as (state: NetInfoState) => void
      return jest.fn()
    })

    const mockAxios = {
      get: jest.fn(async (url: string) => {
        if (url === '/api/v1/service-credits') {
          return { data: makeEntitlement({ accountId: USER_A_SUBJECT }) }
        }
        if (url === '/api/v1/service-plans') {
          return { data: makeCatalogue() }
        }
        return {
          data: {
            items: [],
            count: 0,
            generatedAt: '2026-11-15T10:00:00Z',
          },
        }
      }),
      post: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn(() => 1),
          eject: jest.fn(),
        },
      },
    } as unknown as AxiosInstance
    ;(createApiClient as jest.Mock).mockReturnValue(mockAxios)

    mockSession = null
    const view = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessRoute />
      </QueryClientProvider>,
    )

    expect(screen.getByTestId('support-plan-access-unavailable')).toBeTruthy()
    expect(mockAxios.get).not.toHaveBeenCalled()

    mockSession = { subject: USER_A_SUBJECT, role: 'SPECIALIST' }
    await view.rerender(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessRoute />
      </QueryClientProvider>,
    )
    expect(screen.getByTestId('support-plan-access-unavailable')).toBeTruthy()
    expect(mockAxios.get).not.toHaveBeenCalled()

    mockSession = { subject: USER_A_SUBJECT, role: 'USER' }
    await view.rerender(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessRoute />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })

    await act(async () => {
      netInfoListener?.({ isConnected: false } as NetInfoState)
    })
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-offline-notice')).toBeTruthy()
    })
  })
})
