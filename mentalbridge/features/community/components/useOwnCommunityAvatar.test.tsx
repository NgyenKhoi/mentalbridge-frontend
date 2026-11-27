import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AccountAvatar from './AccountAvatar'
import { useOwnCommunityAvatar } from './useOwnCommunityAvatar'

const CHANGED = 'mentalbridge:community-profile-changed'
const api = vi.hoisted(() => ({ getCommunityProfile: vi.fn() }))
vi.mock('@/features/community/api/browser-community', () => ({
  ...api,
  COMMUNITY_PROFILE_CHANGED: 'mentalbridge:community-profile-changed',
}))

const profile = (patch: object) => ({
  data: {
    communityProfileId: '11111111-1111-4111-8111-111111111111',
    displayName: 'Minh An',
    avatarPreset: null,
    status: 'ACTIVE',
    ...patch,
  },
  etag: '"1"',
})

function Probe() {
  const avatar = useOwnCommunityAvatar()
  return (
    <div data-testid="probe">
      <AccountAvatar avatar={avatar} fallback="MA" />
    </div>
  )
}

describe('own account avatar', () => {
  beforeEach(() => {
    api.getCommunityProfile.mockReset()
  })

  it('shows initials when there is no community profile, silently', async () => {
    api.getCommunityProfile.mockRejectedValue(new Error('404'))
    render(<Probe />)
    await waitFor(() => expect(api.getCommunityProfile).toHaveBeenCalled())
    expect(screen.getByTestId('probe')).toHaveTextContent('MA')
  })

  it('shows initials while the profile has neither photo nor preset', async () => {
    api.getCommunityProfile.mockResolvedValue(profile({}))
    render(<Probe />)
    await waitFor(() => expect(api.getCommunityProfile).toHaveBeenCalled())
    expect(screen.getByTestId('probe')).toHaveTextContent('MA')
  })

  it('swaps to the preset after the profile changes', async () => {
    api.getCommunityProfile.mockResolvedValueOnce(profile({}))
    render(<Probe />)
    await waitFor(() => expect(api.getCommunityProfile).toHaveBeenCalled())

    api.getCommunityProfile.mockResolvedValue(profile({ avatarPreset: 'LEAF' }))
    act(() => {
      window.dispatchEvent(new Event(CHANGED))
    })

    await waitFor(() =>
      expect(
        screen.getByTestId('probe').querySelector('.community-avatar.is-leaf'),
      ).toBeInTheDocument(),
    )
    expect(screen.getByTestId('probe')).not.toHaveTextContent('MA')
  })
})
