import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { ReactElement } from 'react'

import { ApiError } from '@/api/api-error'

import type { CareProfileApi } from './profile-api'
import type { CareProfile } from './profile-contract'
import { UserProfileScreen } from './UserProfileScreen'

const mockBack = jest.fn()
const mockSignOut = jest.fn()
let mockSessionSubject = '11111111-1111-4111-8111-111111111111'

jest.mock('expo-router', () => ({
  router: { back: () => mockBack(), push: jest.fn() },
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    session: { subject: mockSessionSubject, role: 'USER' },
    signOut: mockSignOut,
  }),
}))

const profile: CareProfile = {
  accountId: '11111111-1111-4111-8111-111111111111',
  displayName: 'Nguyễn An',
  dateOfBirth: '1998-05-12',
  gender: 'female',
  locale: 'vi-VN',
  timezone: 'Asia/Ho_Chi_Minh',
  reminderEnabled: false,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  version: 3,
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
      mutations: { gcTime: Infinity, retry: false },
    },
  })
}

async function renderProfile(
  ui: ReactElement,
  queryClient = createTestQueryClient(),
) {
  const result = await render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )

  return { ...result, queryClient }
}

function profileApi(overrides: Partial<CareProfileApi> = {}): CareProfileApi {
  return {
    getProfile: jest.fn().mockResolvedValue(profile),
    putProfile: jest.fn().mockResolvedValue({ ...profile, version: 4 }),
    ...overrides,
  }
}

describe('USER Care profile screen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSessionSubject = '11111111-1111-4111-8111-111111111111'
  })

  it('loads the persisted profile and replaces it with the current version', async () => {
    const api = profileApi()
    await renderProfile(<UserProfileScreen api={api} />)

    expect(await screen.findByDisplayValue('Nguyễn An')).toBeOnTheScreen()
    await fireEvent.changeText(
      screen.getByLabelText('Tên hiển thị'),
      'Nguyễn Bình',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() =>
      expect(api.putProfile).toHaveBeenCalledWith(
        {
          displayName: 'Nguyễn Bình',
          dateOfBirth: '1998-05-12',
          gender: 'female',
        },
        3,
      ),
    )
    expect(await screen.findByText('Đã lưu thay đổi hồ sơ.')).toBeOnTheScreen()
  })

  it('treats PROFILE_NOT_FOUND as onboarding and creates without If-Match', async () => {
    const api = profileApi({
      getProfile: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'PROFILE_NOT_FOUND',
          message: 'Missing',
          status: 404,
        }),
      ),
    })
    await renderProfile(<UserProfileScreen api={api} />)

    expect(await screen.findByText('Bạn chưa có hồ sơ')).toBeOnTheScreen()
    await fireEvent.changeText(
      screen.getByLabelText('Tên hiển thị'),
      'Nguyễn An',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo hồ sơ' }))

    await waitFor(() =>
      expect(api.putProfile).toHaveBeenCalledWith(
        { displayName: 'Nguyễn An', dateOfBirth: null, gender: null },
        undefined,
      ),
    )
  })

  it('keeps invalid input local and surfaces server-owned age validation', async () => {
    const invalidAge = new ApiError({
      code: 'VALIDATION_FAILED',
      message: 'Invalid',
      status: 400,
      problem: {
        type: 'about:blank',
        title: 'Validation failed',
        status: 400,
        code: 'VALIDATION_FAILED',
        correlationId: '11111111-1111-4111-8111-111111111111',
        violations: [{ field: 'dateOfBirth', code: 'MINIMUM_AGE_NOT_MET' }],
      },
    })
    const api = profileApi({
      putProfile: jest.fn().mockRejectedValueOnce(invalidAge),
    })
    await renderProfile(<UserProfileScreen api={api} />)

    await screen.findByDisplayValue('Nguyễn An')
    await fireEvent.changeText(screen.getByLabelText('Ngày sinh'), 'not-a-date')
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(
      await screen.findByText('Nhập ngày sinh theo định dạng YYYY-MM-DD.'),
    ).toBeOnTheScreen()
    expect(api.putProfile).not.toHaveBeenCalled()

    await fireEvent.changeText(screen.getByLabelText('Ngày sinh'), '2015-05-12')
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(
      await screen.findByText('Bạn cần đủ 18 tuổi để tạo hồ sơ.'),
    ).toBeOnTheScreen()
  })

  it('blocks repeated saves until stale recovery loads the authoritative version', async () => {
    const latest: CareProfile = {
      ...profile,
      displayName: 'Tên mới nhất',
      updatedAt: '2026-10-02T00:00:00.000Z',
      version: 4,
    }
    let resolveRefresh: (value: CareProfile) => void = () => undefined
    const pendingRefresh = new Promise<CareProfile>((resolve) => {
      resolveRefresh = resolve
    })
    const putProfile = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({
          code: 'VERSION_MISMATCH',
          message: 'Stale',
          status: 412,
        }),
      )
      .mockResolvedValueOnce({
        ...latest,
        displayName: 'Tên sau khi tải lại',
        version: 5,
      })
    const api = profileApi({
      getProfile: jest
        .fn()
        .mockResolvedValueOnce(profile)
        .mockReturnValueOnce(pendingRefresh),
      putProfile,
    })
    await renderProfile(<UserProfileScreen api={api} />)

    await screen.findByDisplayValue('Nguyễn An')
    await fireEvent.changeText(
      screen.getByLabelText('Tên hiển thị'),
      'Bản nháp cũ',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(
      await screen.findByText(/Hồ sơ vừa được cập nhật ở nơi khác/),
    ).toBeOnTheScreen()
    const blockedSave = screen.getByRole('button', { name: 'Đang tải lại…' })
    expect(blockedSave).toBeDisabled()
    await fireEvent.press(blockedSave)
    expect(putProfile).toHaveBeenCalledTimes(1)

    await act(async () => resolveRefresh(latest))
    expect(await screen.findByDisplayValue('Tên mới nhất')).toBeOnTheScreen()

    await fireEvent.changeText(
      screen.getByLabelText('Tên hiển thị'),
      'Tên sau khi tải lại',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() =>
      expect(putProfile).toHaveBeenLastCalledWith(
        {
          displayName: 'Tên sau khi tải lại',
          dateOfBirth: '1998-05-12',
          gender: 'female',
        },
        4,
      ),
    )
    expect(putProfile).toHaveBeenCalledTimes(2)
  })

  it('keeps saving blocked when stale recovery fails', async () => {
    const api = profileApi({
      getProfile: jest
        .fn()
        .mockResolvedValueOnce(profile)
        .mockRejectedValueOnce(
          new ApiError({
            code: 'CARE_UNAVAILABLE',
            message: 'Offline',
            status: 503,
          }),
        ),
      putProfile: jest.fn().mockRejectedValueOnce(
        new ApiError({
          code: 'VERSION_MISMATCH',
          message: 'Stale',
          status: 412,
        }),
      ),
    })
    await renderProfile(<UserProfileScreen api={api} />)

    await screen.findByDisplayValue('Nguyễn An')
    await fireEvent.changeText(
      screen.getByLabelText('Tên hiển thị'),
      'Bản nháp cũ',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(
      await screen.findByText(
        'Chưa thể tải thông tin mới nhất. Hãy thử tải lại trước khi tiếp tục chỉnh sửa.',
      ),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Cần tải lại hồ sơ' }),
    ).toBeDisabled()
    expect(screen.getByLabelText('Tên hiển thị')).toBeDisabled()
    expect(api.putProfile).toHaveBeenCalledTimes(1)
  })

  it('keeps cached profile data visible when a background refresh fails', async () => {
    const api = profileApi({
      getProfile: jest
        .fn()
        .mockResolvedValueOnce(profile)
        .mockRejectedValueOnce(
          new ApiError({
            code: 'CARE_UNAVAILABLE',
            message: 'Offline',
            status: 503,
          }),
        ),
    })
    const { queryClient } = await renderProfile(<UserProfileScreen api={api} />)

    expect(await screen.findByDisplayValue('Nguyễn An')).toBeOnTheScreen()
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: ['care-profile', '11111111-1111-4111-8111-111111111111'],
      })
    })

    expect(
      await screen.findByText(
        'Chưa thể làm mới hồ sơ. Bạn vẫn có thể xem thông tin đã tải trước đó.',
      ),
    ).toBeOnTheScreen()
    expect(screen.getByDisplayValue('Nguyễn An')).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: 'Thử tải lại' }),
    ).toBeOnTheScreen()
  })

  it('refetches the authoritative profile after the screen remounts', async () => {
    const reloaded: CareProfile = {
      ...profile,
      displayName: 'Tên sau khi mở lại',
      updatedAt: '2026-10-03T00:00:00.000Z',
      version: 4,
    }
    const api = profileApi({
      getProfile: jest
        .fn()
        .mockResolvedValueOnce(profile)
        .mockResolvedValueOnce(reloaded),
    })
    const queryClient = createTestQueryClient()
    const firstMount = await renderProfile(
      <UserProfileScreen api={api} />,
      queryClient,
    )

    await screen.findByDisplayValue('Nguyễn An')
    await firstMount.unmount()

    await renderProfile(<UserProfileScreen api={api} />, queryClient)

    expect(
      await screen.findByDisplayValue('Tên sau khi mở lại'),
    ).toBeOnTheScreen()
    expect(api.getProfile).toHaveBeenCalledTimes(2)
  })

  it('uses a separate cache entry when the Identity subject changes', async () => {
    const secondSubject = '22222222-2222-4222-8222-222222222222'
    const secondProfile: CareProfile = {
      ...profile,
      accountId: secondSubject,
      displayName: 'Trần Bình',
      updatedAt: '2026-10-04T00:00:00.000Z',
      version: 1,
    }
    const api = profileApi({
      getProfile: jest
        .fn()
        .mockResolvedValueOnce(profile)
        .mockResolvedValueOnce(secondProfile),
    })
    const queryClient = createTestQueryClient()
    const firstAccount = await renderProfile(
      <UserProfileScreen api={api} />,
      queryClient,
    )

    await screen.findByDisplayValue('Nguyễn An')
    await firstAccount.unmount()
    mockSessionSubject = secondSubject

    await renderProfile(<UserProfileScreen api={api} />, queryClient)

    expect(await screen.findByDisplayValue('Trần Bình')).toBeOnTheScreen()
    expect(
      queryClient.getQueryData([
        'care-profile',
        '11111111-1111-4111-8111-111111111111',
      ]),
    ).toEqual(profile)
    expect(queryClient.getQueryData(['care-profile', secondSubject])).toEqual(
      secondProfile,
    )
  })

  it('distinguishes unauthorized and dependency-unavailable loading failures', async () => {
    const unauthorizedApi = profileApi({
      getProfile: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'UNAUTHORIZED',
          message: 'Expired',
          status: 401,
        }),
      ),
    })
    const unauthorized = await renderProfile(
      <UserProfileScreen api={unauthorizedApi} />,
    )

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Đăng nhập lại' }),
    )
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    await unauthorized.unmount()

    const forbiddenApi = profileApi({
      getProfile: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'FORBIDDEN',
          message: 'Forbidden',
          status: 403,
        }),
      ),
    })
    const forbidden = await renderProfile(
      <UserProfileScreen api={forbiddenApi} />,
    )

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Quay lại' }),
    )
    expect(mockBack).toHaveBeenCalledTimes(1)
    await forbidden.unmount()

    const dependencyApi = profileApi({
      getProfile: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'CARE_UNAVAILABLE',
          message: 'Offline',
          status: 503,
        }),
      ),
    })
    await renderProfile(<UserProfileScreen api={dependencyApi} />)

    expect(
      await screen.findByText(
        'Chưa thể tải hồ sơ lúc này. Thông tin đã lưu không bị thay đổi.',
      ),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeOnTheScreen()
  })
})
