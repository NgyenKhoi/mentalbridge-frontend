import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { ComponentProps } from 'react'
import { Text } from 'react-native'
import * as reanimated from 'react-native-reanimated'

import { Avatar, relativeTime } from './community-avatar'
import type { Reaction } from './community-contract'
import { BottomSheet } from './CommunityBottomSheet'
import { ReactionControl } from './CommunityReactions'
import { CommunityTabBar } from './CommunityTabBar'

const reduced = jest.mocked(reanimated.useReducedMotion)
const sequence = jest.mocked(reanimated.withSequence)
// Avatars are hidden from the screen reader, so queries must opt in.
const hidden = { includeHiddenElements: true }

describe('Avatar', () => {
  const base = {
    displayName: 'Lan',
    avatarPreset: null,
    state: 'ACTIVE',
  } as const
  it.each([
    [
      'image',
      { ...base, avatarImage: { url: 'https://cdn.invalid/a.png' } },
      undefined,
    ],
    ['preset', { ...base, avatarPreset: 'LEAF' }, 'icon-leaf'],
    ['initial', base, undefined],
    [
      'anonymous',
      { ...base, displayName: 'Ẩn danh', state: 'ANONYMOUS' },
      'icon-incognito',
    ],
    ['deleted', { ...base, state: 'DELETED' }, undefined],
  ] as const)(
    'renders the %s variant hidden from the screen reader',
    async (variant, author, icon) => {
      await render(<Avatar author={author} />)
      const node = screen.getByTestId(`community-avatar-${variant}`, hidden)
      expect(node.props.accessible).toBe(false)
      expect(node.props.importantForAccessibility).toBe('no-hide-descendants')
      if (icon) expect(screen.getByTestId(icon, hidden)).toBeOnTheScreen()
    },
  )
  it('shows the first letter of the name, and the dash for a deleted author', async () => {
    await render(<Avatar author={base} />)
    expect(screen.getByText('L', hidden)).toBeOnTheScreen()
    await render(<Avatar author={{ ...base, state: 'DELETED' }} />)
    expect(screen.getByText('—', hidden)).toBeOnTheScreen()
  })
})

describe('ReactionControl', () => {
  const control = (
    reaction: Reaction | null,
    onChange = jest.fn(),
    extra: Partial<ComponentProps<typeof ReactionControl>> = {},
  ) => (
    <ReactionControl
      reaction={reaction}
      count={3}
      onChange={onChange}
      {...extra}
    />
  )
  beforeEach(() => {
    sequence.mockClear()
    reduced.mockReturnValue(false)
  })
  it('shows a grey heart and the count when unreacted, and a tap sets SUPPORT', async () => {
    const onChange = jest.fn()
    await render(control(null, onChange))
    expect(screen.getByText('🤍')).toBeOnTheScreen()
    expect(screen.getByText('3')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Thả cảm xúc' }))
    expect(onChange).toHaveBeenCalledWith('SUPPORT')
  })
  it('says the current state and a tap clears the reaction', async () => {
    const onChange = jest.fn()
    await render(control('RELATE', onChange))
    expect(screen.getByText('🤗')).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Bạn đã thả: Mình đồng cảm' }),
    )
    expect(onChange).toHaveBeenCalledWith(null)
  })
  it('opens the tray on a long press and a choice sets that kind', async () => {
    const onChange = jest.fn()
    await render(control(null, onChange))
    await fireEvent(
      screen.getByRole('button', { name: 'Thả cảm xúc' }),
      'longPress',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Mình đồng cảm' }))
    expect(onChange).toHaveBeenLastCalledWith('RELATE')
    expect(screen.queryByRole('button', { name: 'Cảm ơn bạn' })).toBeNull()
    await fireEvent(
      screen.getByRole('button', { name: 'Thả cảm xúc' }),
      'longPress',
    )
    await fireEvent.press(screen.getByRole('button', { name: 'Cảm ơn bạn' }))
    expect(onChange).toHaveBeenLastCalledWith('THANK_YOU')
  })
  it('closes the tray on an outside tap without changing anything', async () => {
    const onChange = jest.fn()
    await render(control('SUPPORT', onChange))
    await fireEvent(
      screen.getByRole('button', { name: 'Bạn đã thả: Mình ở đây' }),
      'longPress',
    )
    expect(
      screen.getByRole('button', { name: 'Mình ở đây' }).props
        .accessibilityState.selected,
    ).toBe(true)
    await fireEvent.press(screen.getByLabelText('Đóng khay cảm xúc', hidden))
    expect(screen.queryByRole('button', { name: 'Mình đồng cảm' })).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })
  it('exposes the three choices and clear as accessibility actions', async () => {
    const onChange = jest.fn()
    await render(control('SUPPORT', onChange))
    const button = screen.getByRole('button', {
      name: 'Bạn đã thả: Mình ở đây',
    })
    expect(
      button.props.accessibilityActions.map(
        (action: { label: string }) => action.label,
      ),
    ).toEqual(['Mình ở đây', 'Mình đồng cảm', 'Cảm ơn bạn', 'Bỏ cảm xúc'])
    await fireEvent(button, 'accessibilityAction', {
      nativeEvent: { actionName: 'react-THANK_YOU' },
    })
    expect(onChange).toHaveBeenLastCalledWith('THANK_YOU')
    await fireEvent(button, 'accessibilityAction', {
      nativeEvent: { actionName: 'react-clear' },
    })
    expect(onChange).toHaveBeenLastCalledWith(null)
  })
  it('pops once when the reaction is committed and floats emoji for it', async () => {
    const view = await render(control(null))
    expect(sequence).not.toHaveBeenCalled()
    await view.rerender(control('SUPPORT'))
    expect(sequence).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('❤️').length).toBeGreaterThan(1)
    await view.rerender(control(null))
    expect(sequence).toHaveBeenCalledTimes(1)
  })
  it('only changes state under reduced motion', async () => {
    reduced.mockReturnValue(true)
    const view = await render(control(null))
    await view.rerender(control('SUPPORT'))
    expect(sequence).not.toHaveBeenCalled()
    expect(screen.getAllByText('❤️')).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: 'Bạn đã thả: Mình ở đây' }).props
        .accessibilityState.selected,
    ).toBe(true)
  })
  it('labels the comment variant with its target, hides the count and floats nothing', async () => {
    const small = { size: 'small', target: 'bình luận của Lan' } as const
    const view = await render(control(null, jest.fn(), small))
    expect(
      screen.getByRole('button', {
        name: 'Thả cảm xúc cho bình luận của Lan',
      }),
    ).toBeOnTheScreen()
    expect(screen.queryByText('3')).toBeNull()
    await view.rerender(control('SUPPORT', jest.fn(), small))
    expect(screen.getAllByText('❤️')).toHaveLength(1)
  })
})

describe('CommunityTabBar', () => {
  it('marks the active tab and reports the pressed one', async () => {
    const onSelect = jest.fn()
    await render(<CommunityTabBar active="feed" onSelect={onSelect} />)
    expect(
      screen.getByRole('tab', { name: 'Bảng tin' }).props.accessibilityState
        .selected,
    ).toBe(true)
    for (const [name, tab] of [
      ['Khoảnh khắc', 'moments'],
      ['Viết', 'compose'],
      ['Tin nhắn', 'chat'],
      ['Trang của tôi', 'me'],
    ] as const) {
      await fireEvent.press(screen.getByRole('tab', { name }))
      expect(onSelect).toHaveBeenLastCalledWith(tab)
    }
  })
})

describe('BottomSheet', () => {
  it('closes on a scrim tap and on hardware back, and unmounts after closing', async () => {
    reduced.mockReturnValue(true)
    const onClose = jest.fn()
    const sheet = (visible: boolean) => (
      <BottomSheet visible={visible} onClose={onClose} title="An toàn">
        <Text>Nội dung</Text>
      </BottomSheet>
    )
    const view = await render(sheet(true))
    expect(screen.getByText('Nội dung')).toBeOnTheScreen()
    expect(screen.getByRole('header', { name: 'An toàn' })).toBeOnTheScreen()
    await fireEvent.press(screen.getByTestId('community-bottom-sheet-scrim'))
    expect(onClose).toHaveBeenCalledTimes(1)
    await fireEvent(
      screen.getByTestId('community-bottom-sheet'),
      'requestClose',
    )
    expect(onClose).toHaveBeenCalledTimes(2)
    await view.rerender(sheet(false))
    await waitFor(() => expect(screen.queryByText('Nội dung')).toBeNull())
  })
})

describe('relativeTime', () => {
  const now = Date.parse('2026-11-16T12:00:00Z')
  it.each([
    ['2026-11-16T11:59:40Z', 'Vừa xong'],
    ['2026-11-16T11:30:00Z', '30 phút trước'],
    ['2026-11-16T09:00:00Z', '3 giờ trước'],
    ['2026-11-14T12:00:00Z', '2 ngày trước'],
    ['not a date', ''],
  ])('%s -> %s', (iso, expected) =>
    expect(relativeTime(iso, now)).toBe(expected),
  )
})
