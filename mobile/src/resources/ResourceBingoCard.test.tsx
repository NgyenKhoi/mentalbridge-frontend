import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'
import type { RewardApi } from '@/rewards/reward-api'
import { bingo } from '@/rewards/reward-test-fixtures'
import { nativePlan } from '@/support-plan/native-plan-test-fixtures'
import type { SupportPlanActionApi } from '@/support-plan/support-plan-action-api'

import { ResourceBingoCard } from './ResourceBingoCard'

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))

async function mount({
  syncBingo = jest.fn().mockResolvedValue({
    board: { ...bingo, unavailableActions: [] },
    etag: '"5"',
  }),
  setBingoSelfConfirmation = jest.fn().mockResolvedValue({
    board: {
      ...bingo,
      version: '6',
      items: bingo.items.map((item) =>
        item.position === 1
          ? {
              ...item,
              evidence: 'SELF_CONFIRMED',
              selfConfirmedAt: '2026-11-03T04:00:00Z',
            }
          : item,
      ),
    },
    etag: '"6"',
  }),
} = {}) {
  const api = { syncBingo, setBingoSelfConfirmation } as unknown as RewardApi
  const planApi = {
    getCurrent: jest.fn().mockResolvedValue(nativePlan()),
  } as unknown as SupportPlanActionApi
  await render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false, gcTime: 0 },
          },
        })
      }
    >
      <ResourceBingoCard
        api={api}
        planApi={planApi}
        subject="owner"
        today="2026-11-03"
        timezone="Asia/Ho_Chi_Minh"
        fontsLoaded={false}
      />
    </QueryClientProvider>,
  )
  return { syncBingo, setBingoSelfConfirmation }
}

it('uses the saved board and its version, and keeps verified and retired items read only', async () => {
  const { syncBingo, setBingoSelfConfirmation } = await mount()
  const tile = await screen.findByRole('checkbox', { name: 'Thở chậm ba phút' })
  expect(syncBingo).toHaveBeenCalledWith('2026-11-02', 'Asia/Ho_Chi_Minh')
  expect(screen.getByRole('checkbox', { name: 'Đi bộ nhẹ' })).toBeDisabled()
  expect(
    screen.getByRole('checkbox', { name: 'Hoạt động kế hoạch cũ' }),
  ).toBeDisabled()
  await fireEvent.press(tile)
  await waitFor(() =>
    expect(setBingoSelfConfirmation).toHaveBeenCalledWith(
      '2026-11-02',
      1,
      true,
      '"5"',
    ),
  )
  await waitFor(() =>
    expect(
      screen.getByRole('checkbox', { name: 'Thở chậm ba phút', checked: true }),
    ).toBeTruthy(),
  )
})

it('reloads after a stale version and disables marks while the owner board is unavailable', async () => {
  const syncBingo = jest
    .fn()
    .mockResolvedValueOnce({
      board: { ...bingo, unavailableActions: [] },
      etag: '"5"',
    })
    .mockRejectedValue(
      new ApiError({
        status: 503,
        code: 'UNAVAILABLE',
        message: 'Unavailable',
      }),
    )
  const setBingoSelfConfirmation = jest.fn().mockRejectedValue(
    new ApiError({
      status: 412,
      code: 'VERSION_MISMATCH',
      message: 'Stale version',
    }),
  )
  await mount({ syncBingo, setBingoSelfConfirmation })
  await fireEvent.press(
    await screen.findByRole('checkbox', { name: 'Thở chậm ba phút' }),
  )
  await waitFor(() => expect(syncBingo).toHaveBeenCalledTimes(2))
  await screen.findByText('Chưa thể tải Bingo tuần này.')
  expect(
    screen.getByRole('checkbox', { name: 'Thở chậm ba phút', checked: false }),
  ).toBeDisabled()
})

it('renders a partially populated board without duplicate keys and marks the correct position', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  try {
    const item = { ...bingo.items[0]!, position: 4 }
    const syncBingo = jest.fn().mockResolvedValue({
      board: { ...bingo, items: [item], unavailableActions: [] },
      etag: '"5"',
    })
    const setBingoSelfConfirmation = jest.fn().mockResolvedValue({
      board: {
        ...bingo,
        items: [
          {
            ...item,
            selfConfirmedAt: '2026-11-03T04:00:00Z',
            evidence: 'SELF_CONFIRMED',
          },
        ],
        unavailableActions: [],
      },
      etag: '"6"',
    })
    await mount({ syncBingo, setBingoSelfConfirmation })
    await fireEvent.press(
      await screen.findByRole('checkbox', { name: item.label }),
    )
    await waitFor(() =>
      expect(setBingoSelfConfirmation).toHaveBeenCalledWith(
        '2026-11-02',
        4,
        true,
        '"5"',
      ),
    )
    expect(screen.getAllByLabelText('Ô trống')).toHaveLength(8)
    expect(error.mock.calls.flat().join(' ')).not.toMatch(
      /same key|unique.*key/i,
    )
  } finally {
    error.mockRestore()
  }
})
