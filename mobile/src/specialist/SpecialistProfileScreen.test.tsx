import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { ReactElement } from 'react'

import { ApiError } from '@/api/api-error'

import type { SpecialistApi } from './specialist-api'
import { SpecialistProfileScreen } from './SpecialistProfileScreen'
import {
  makeAvailabilityList,
  makeSpecialistProfile,
} from './specialist-test-fixtures'

const mockPush = jest.fn()
const mockSignOut = jest.fn()

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: (path: string) => mockPush(path) },
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    session: {
      subject: '11111111-1111-4111-8111-111111111111',
      role: 'SPECIALIST',
    },
    signOut: mockSignOut,
  }),
}))

function makeApi(overrides: Partial<SpecialistApi> = {}): SpecialistApi {
  return {
    getProfile: jest.fn().mockResolvedValue(makeSpecialistProfile()),
    saveProfile: jest
      .fn()
      .mockResolvedValue(makeSpecialistProfile({ version: 2 })),
    submitProfile: jest.fn().mockResolvedValue(
      makeSpecialistProfile({
        submittedAt: '2026-10-09T00:00:00.000Z',
        version: 2,
      }),
    ),
    resubmitProfile: jest.fn().mockResolvedValue(
      makeSpecialistProfile({
        submittedAt: '2026-10-09T00:00:00.000Z',
        version: 3,
      }),
    ),
    listAvailability: jest.fn().mockResolvedValue(makeAvailabilityList()),
    publishAvailability: jest.fn(),
    withdrawAvailability: jest.fn(),
    ...overrides,
  }
}

async function renderScreen(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
  return await render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  )
}

describe('SPECIALIST professional profile screen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a draft using only specialist-owned fields', async () => {
    const saved = makeSpecialistProfile()
    const api = makeApi({
      getProfile: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'SPECIALIST_PROFILE_NOT_FOUND',
          message: 'missing',
          status: 404,
        }),
      ),
      saveProfile: jest.fn().mockResolvedValue(saved),
    })
    await renderScreen(<SpecialistProfileScreen api={api} />)

    expect(await screen.findByText('Chưa tạo hồ sơ')).toBeOnTheScreen()
    await fireEvent.changeText(
      screen.getByLabelText('Tên hiển thị nghề nghiệp'),
      'Chuyên gia An',
    )
    await fireEvent.changeText(
      screen.getByLabelText('Giới thiệu nghề nghiệp'),
      'Đồng hành an toàn.',
    )
    await fireEvent.press(
      screen.getByRole('checkbox', {
        name: 'Khó khăn liên quan lo âu',
      }),
    )
    await fireEvent.changeText(screen.getByLabelText('Số năm kinh nghiệm'), '5')
    await fireEvent.press(
      screen.getByRole('button', { name: 'Tạo hồ sơ chuyên gia' }),
    )

    await waitFor(() =>
      expect(api.saveProfile).toHaveBeenCalledWith(
        {
          displayName: 'Chuyên gia An',
          bio: 'Đồng hành an toàn.',
          supportAreas: ['ANXIETY_SYMPTOMS'],
          languages: ['vi'],
          yearsOfExperience: 5,
          timezone: 'Asia/Ho_Chi_Minh',
        },
        undefined,
      ),
    )
  })

  it('submits a saved draft with the authoritative version', async () => {
    const draft = makeSpecialistProfile({ version: 4 })
    const api = makeApi({ getProfile: jest.fn().mockResolvedValue(draft) })
    await renderScreen(<SpecialistProfileScreen api={api} />)

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Gửi xét duyệt' }),
    )

    await waitFor(() => expect(api.submitProfile).toHaveBeenCalledWith(draft))
    expect(await screen.findByText('Đang chờ xét duyệt')).toBeOnTheScreen()
  })

  it('updates a draft with its authoritative version', async () => {
    const draft = makeSpecialistProfile({ version: 6 })
    const updated = makeSpecialistProfile({
      bio: 'Nội dung đã cập nhật.',
      version: 7,
    })
    const api = makeApi({
      getProfile: jest.fn().mockResolvedValue(draft),
      saveProfile: jest.fn().mockResolvedValue(updated),
    })
    await renderScreen(<SpecialistProfileScreen api={api} />)

    await screen.findByText('Bản nháp chưa gửi')
    await fireEvent.changeText(
      screen.getByLabelText('Giới thiệu nghề nghiệp'),
      'Nội dung đã cập nhật.',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() =>
      expect(api.saveProfile).toHaveBeenCalledWith(
        {
          displayName: draft.displayName,
          bio: 'Nội dung đã cập nhật.',
          supportAreas: draft.supportAreas,
          languages: draft.languages,
          yearsOfExperience: draft.yearsOfExperience,
          timezone: draft.timezone,
        },
        6,
      ),
    )
  })

  it('requires confirmation before an edit withdraws a pending review', async () => {
    const pending = makeSpecialistProfile({
      submittedAt: '2026-10-09T00:00:00.000Z',
      version: 4,
    })
    const api = makeApi({ getProfile: jest.fn().mockResolvedValue(pending) })
    await renderScreen(<SpecialistProfileScreen api={api} />)

    await screen.findByText('Đang chờ xét duyệt')
    await fireEvent.changeText(
      screen.getByLabelText('Giới thiệu nghề nghiệp'),
      'Bản chỉnh sửa cần xét duyệt lại.',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(
      await screen.findByText('Lưu thay đổi và rút hồ sơ khỏi hàng đợi?'),
    ).toBeOnTheScreen()
    expect(api.saveProfile).not.toHaveBeenCalled()

    await fireEvent.press(
      screen.getByRole('button', { name: 'Lưu và rút hồ sơ' }),
    )
    await waitFor(() => expect(api.saveProfile).toHaveBeenCalledTimes(1))
  })

  it('shows rejection feedback and resubmits the saved revision', async () => {
    const rejected = makeSpecialistProfile({
      approvalStatus: 'REJECTED',
      decisionReasonCode: 'PROFILE_INFORMATION_INCOMPLETE',
      submittedAt: '2026-10-03T00:00:00.000Z',
      reviewedAt: '2026-10-04T00:00:00.000Z',
      reviewedBy: '99999999-9999-4999-8999-999999999999',
      version: 8,
    })
    const api = makeApi({ getProfile: jest.fn().mockResolvedValue(rejected) })
    await renderScreen(<SpecialistProfileScreen api={api} />)

    expect(
      await screen.findByText('Thông tin hồ sơ chưa đầy đủ.'),
    ).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Gửi lại để xét duyệt' }),
    )

    await waitFor(() =>
      expect(api.resubmitProfile).toHaveBeenCalledWith(rejected),
    )
  })

  it.each([
    ['APPROVED', 'Đã được phê duyệt'],
    ['SUSPENDED', 'Đang tạm ngưng'],
  ] as const)('keeps %s profiles read-only', async (approvalStatus, label) => {
    const profile = makeSpecialistProfile({
      approvalStatus,
      decisionReasonCode:
        approvalStatus === 'SUSPENDED' ? 'QUALITY_REVIEW_REQUIRED' : null,
    })
    const api = makeApi({ getProfile: jest.fn().mockResolvedValue(profile) })
    await renderScreen(<SpecialistProfileScreen api={api} />)

    expect(await screen.findByText(label)).toBeOnTheScreen()
    expect(screen.getByLabelText('Tên hiển thị nghề nghiệp')).toBeDisabled()
    expect(
      screen.queryByTestId('specialist-profile-save'),
    ).not.toBeOnTheScreen()
    expect(api.saveProfile).not.toHaveBeenCalled()
  })

  it('opens availability only from an approved profile', async () => {
    const api = makeApi({
      getProfile: jest
        .fn()
        .mockResolvedValue(
          makeSpecialistProfile({ approvalStatus: 'APPROVED' }),
        ),
    })
    await renderScreen(<SpecialistProfileScreen api={api} />)

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Quản lý lịch khả dụng' }),
    )

    expect(mockPush).toHaveBeenCalledWith('./availability')
  })
})
