import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CommunityAvatar from './CommunityAvatar'

const image = {
  mediaId: '30000000-0000-4000-8000-000000000001',
  url: 'https://res.cloudinary.com/test/image/upload/avatar.webp',
  width: 512,
  height: 512,
}

describe('CommunityAvatar', () => {
  it('shows a reserved-dimension image, falls back on load failure and resets for a new photo', () => {
    const view = render(
      <CommunityAvatar
        displayName="Minh An"
        avatarPreset="SPROUT"
        avatarImage={image}
      />,
    )
    const photo = view.container.querySelector('img')
    expect(photo).toHaveAttribute('width', '512')
    expect(photo).toHaveAttribute('height', '512')
    if (!photo) throw new Error('Expected the selected Community photo')
    fireEvent.error(photo)
    expect(view.container.querySelector('img')).toBeNull()
    expect(view.container.querySelector('.is-sprout svg')).not.toBeNull()
    view.rerender(
      <CommunityAvatar
        displayName="Minh An"
        avatarPreset="SPROUT"
        avatarImage={{ ...image, url: image.url + '?v=2' }}
      />,
    )
    expect(view.container.querySelector('img')).not.toBeNull()
  })
  it('never renders a supplied photo or identifying preset for anonymous and deleted authors', () => {
    const view = render(
      <CommunityAvatar
        displayName="Minh An"
        avatarPreset="SPROUT"
        avatarImage={image}
        anonymous
      />,
    )
    expect(view.container.querySelector('img, svg')).toBeNull()
    expect(view.container.textContent).toBe('Ẩn')
    view.rerender(
      <CommunityAvatar
        displayName="Minh An"
        avatarPreset="SPROUT"
        avatarImage={image}
        deleted
      />,
    )
    expect(view.container.querySelector('img, svg')).toBeNull()
    expect(view.container.textContent).toBe('—')
  })
})
