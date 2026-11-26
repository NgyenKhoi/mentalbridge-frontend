import { render } from '@testing-library/react-native'
import { ReassessmentJourneyRoute } from './ReassessmentJourneyRoute'

const mockDismiss = jest.fn()
const mockPush = jest.fn()
const mockScreen = jest.fn()
jest.mock('expo-router', () => ({
  router: {
    dismissTo: (...args: unknown[]) => mockDismiss(...args),
    push: (...args: unknown[]) => mockPush(...args),
  },
  useFocusEffect: jest.fn(),
}))
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: { subject: 'test-user' } }),
}))
jest.mock('@/config/runtime-config-context', () => ({
  useRuntimeConfig: () => ({
    apiBaseUrl: 'https://test.example',
    apiTimeoutMs: 5000,
  }),
}))
jest.mock('@/api/api-client', () => ({ createApiClient: () => ({}) }))
jest.mock('@/journal/journal-api', () => ({ createJournalApi: () => ({}) }))
jest.mock('@/security/credential-store', () => ({
  secureCredentialStore: { getAccessToken: jest.fn() },
}))
jest.mock('./reassessment-api', () => ({ createReassessmentApi: () => ({}) }))
jest.mock('./ReassessmentJourneyScreen', () => ({
  ReassessmentJourneyScreen: (props: unknown) => {
    mockScreen(props)
    return null
  },
}))

it.each([false, true])(
  'preserves screening return context and separates review from ordinary plan navigation, embedded=%s',
  async (embedded) => {
    jest.clearAllMocks()
    await render(<ReassessmentJourneyRoute embedded={embedded} />)
    const props = mockScreen.mock.lastCall?.[0] as {
      onScreening: () => void
      onReturnToPlan: () => void
      onReviewPlan: () => void
    }
    expect(mockDismiss).not.toHaveBeenCalled()
    props.onScreening()
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(user)/assessment',
      params: {
        purpose: 'REASSESSMENT',
        returnTo: embedded ? 'assessments' : 'reassessment',
      },
    })
    props.onReviewPlan()
    expect(mockDismiss).toHaveBeenLastCalledWith({
      pathname: '/(user)/support-plan',
      params: { review: 'open' },
    })
    props.onReturnToPlan()
    expect(mockDismiss).toHaveBeenLastCalledWith('/(user)/support-plan')
  },
)
