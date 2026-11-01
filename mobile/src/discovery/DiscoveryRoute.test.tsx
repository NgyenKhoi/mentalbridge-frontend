import { act, render } from '@testing-library/react-native'

import type { SlotSelection } from './discovery-model'
import { DiscoveryRoute } from './DiscoveryRoute'

const evaluationId = '40000000-0000-4000-8000-000000000725'
const planActionId = '50000000-0000-4000-8000-000000000725'
const mockDiscoveryProps = jest.fn()
const mockAppointmentProps = jest.fn()
const mockRequestUse = jest.fn(() => 1)
const mockRequestEject = jest.fn()
let mockParams: Record<string, unknown> = {}

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}))
jest.mock('@/api/api-client', () => ({
  createApiClient: () => ({
    interceptors: {
      request: { use: mockRequestUse, eject: mockRequestEject },
    },
  }),
}))
jest.mock('@/appointments/appointment-api', () => ({
  createAppointmentApi: () => ({ kind: 'appointments' }),
}))
jest.mock('@/appointments/AppointmentsScreen', () => ({
  AppointmentsScreen: (props: unknown) => {
    mockAppointmentProps(props)
    return null
  },
}))
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    session: {
      subject: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      role: 'USER',
    },
  }),
}))
jest.mock('@/config/runtime-config-context', () => ({
  useRuntimeConfig: () => ({
    apiBaseUrl: 'https://edge.invalid',
    apiTimeoutMs: 5000,
  }),
}))
jest.mock('@/security/credential-store', () => ({
  secureCredentialStore: { getAccessToken: jest.fn() },
}))
jest.mock('./discovery-api', () => ({
  createDiscoveryApi: () => ({ kind: 'discovery' }),
}))
jest.mock('./DiscoveryScreen', () => ({
  DiscoveryScreen: (props: unknown) => {
    mockDiscoveryProps(props)
    return null
  },
}))

beforeEach(() => {
  mockParams = {}
  jest.clearAllMocks()
})

it('binds exact owned evaluation context while retaining plan-action booking attribution', async () => {
  mockParams = { supportEvaluationId: evaluationId, planActionId }
  await render(<DiscoveryRoute />)

  const discovery = mockDiscoveryProps.mock.calls.at(-1)![0] as {
    onBook: (selection: SlotSelection) => void
    supportEvaluationId?: string
  }
  expect(discovery.supportEvaluationId).toBe(evaluationId)

  await act(async () => {
    discovery.onBook({} as SlotSelection)
  })
  expect(mockAppointmentProps).toHaveBeenCalledWith(
    expect.objectContaining({
      originatingPlanActionId: planActionId,
      supportEvaluationId: evaluationId,
    }),
  )
})

it.each([
  { supportEvaluationId: 'not-owned-reference' },
  { supportEvaluationId: [evaluationId] },
])(
  'falls back to neutral browse for malformed route context',
  async (params) => {
    mockParams = params
    await render(<DiscoveryRoute />)

    const discovery = mockDiscoveryProps.mock.calls.at(-1)![0] as {
      supportEvaluationId?: string
    }
    expect(discovery.supportEvaluationId).toBeUndefined()
  },
)
