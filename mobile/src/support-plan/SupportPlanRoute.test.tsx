import { render } from '@testing-library/react-native'

import { SupportPlanRoute } from './SupportPlanRoute'

let mockParams: Record<string, unknown> = {}
const mockWorkspace = jest.fn()
jest.mock('expo-router', () => ({ useLocalSearchParams: () => mockParams }))
jest.mock('@/config/runtime-config-context', () => ({
  useRuntimeConfig: () => ({
    apiBaseUrl: 'https://private.test',
    apiTimeoutMs: 5000,
  }),
}))
jest.mock('@/api/api-client', () => ({ createApiClient: () => ({}) }))
jest.mock('@/security/credential-store', () => ({
  secureCredentialStore: { getAccessToken: jest.fn() },
}))
jest.mock('@/emotion/emotion-api', () => ({ createEmotionApi: () => ({}) }))
jest.mock('./support-plan-api', () => ({ createSupportPlanApi: () => ({}) }))
jest.mock('./support-plan-action-api', () => ({
  createSupportPlanActionApi: () => ({}),
}))
jest.mock('./SupportPlanActionWorkspace', () => ({
  SupportPlanActionWorkspace: (props: unknown) => {
    mockWorkspace(props)
    return null
  },
}))

const origin = {
  source: 'journal',
  occurrenceId: '30000000-0000-4000-8000-000000000642',
  actionId: '20000000-0000-4000-8000-000000000642',
  localDate: '2026-10-13',
  journalId: '60000000-0000-4000-8000-000000000642',
}
beforeEach(() => {
  jest.clearAllMocks()
  mockParams = {}
})
it('separates the Journal candidate route from the existing Emotion handoff', async () => {
  mockParams = origin
  await render(<SupportPlanRoute />)
  expect(mockWorkspace).toHaveBeenLastCalledWith(
    expect.objectContaining({
      origin: { state: 'none' },
      journalOrigin: { state: 'valid', value: origin },
    }),
  )
})
it.each([
  { ...origin, source: ['journal', 'journal'] },
  { ...origin, journalId: [origin.journalId] },
  { ...origin, returnUrl: 'https://untrusted.test' },
  {
    occurrenceId: origin.occurrenceId,
    actionId: origin.actionId,
    localDate: origin.localDate,
  },
])(
  'invalid Journal metadata never becomes an Emotion handoff',
  async (params) => {
    mockParams = params
    await render(<SupportPlanRoute />)
    expect(mockWorkspace).toHaveBeenLastCalledWith(
      expect.objectContaining({
        origin: { state: 'none' },
        journalOrigin: { state: 'invalid' },
      }),
    )
  },
)
it('preserves the existing typed Emotion origin', async () => {
  mockParams = { occurrenceId: origin.occurrenceId, actionId: origin.actionId }
  await render(<SupportPlanRoute />)
  expect(mockWorkspace).toHaveBeenLastCalledWith(
    expect.objectContaining({
      origin: { state: 'valid', value: mockParams },
      journalOrigin: { state: 'none' },
    }),
  )
})

it.each([
  ['RESOURCE', 'breathing-core'],
  ['ROUTINE_SELF_MANAGEMENT', origin.actionId],
  ['SELF_REPORT_REVIEW', origin.actionId],
] as const)(
  'separates the typed Home %s entry from Emotion and Journal origins',
  async (actionType, actionId) => {
    mockParams = {
      source: 'home',
      occurrenceId: origin.occurrenceId,
      actionId,
      actionType,
      localDate: origin.localDate,
    }
    await render(<SupportPlanRoute />)
    expect(mockWorkspace).toHaveBeenLastCalledWith(
      expect.objectContaining({
        origin: { state: 'none' },
        journalOrigin: { state: 'none' },
        homeOrigin: {
          state: 'valid',
          value: mockParams,
        },
      }),
    )
  },
)
