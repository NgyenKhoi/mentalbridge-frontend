import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SupportPlanCompanionShell from './SupportPlanCompanionShell'
import {
  companionStateCopy,
  transitionSupportPlanCompanion,
  type SupportPlanCompanionEvent,
} from './support-plan-companion-state'

function installMotionPreference(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

describe('SupportPlanCompanionShell', () => {
  beforeEach(() => {
    window.localStorage.clear()
    installMotionPreference()
  })

  it.each([
    ['CONTENT_READY', 'idle'],
    ['SURFACE_ENTERED', 'greeting'],
    ['REQUEST_STARTED', 'thinking'],
    ['NEXT_STEP_AVAILABLE', 'encouraging'],
    ['EXPLICIT_COMPLETION_ACKNOWLEDGED', 'celebrating-light'],
    ['SENSITIVE_CONTEXT_ENTERED', 'calm-empathetic'],
    ['WAITING_FOR_USER', 'waiting'],
  ] satisfies ReadonlyArray<[SupportPlanCompanionEvent, string]>)(
    'maps %s to the deterministic %s visual state',
    (event, expected) => {
      expect(transitionSupportPlanCompanion('idle', event)).toBe(expected)
      expect(transitionSupportPlanCompanion('thinking', event)).toBe(expected)
    },
  )

  it.each(Object.entries(companionStateCopy))(
    'renders the %s state as text as well as motion',
    (state, copy) => {
      render(
        <SupportPlanCompanionShell
          state={state as keyof typeof companionStateCopy}
          surface="today"
        />,
      )

      expect(screen.getAllByText(copy.label).length).toBeGreaterThan(0)
      expect(screen.getByText(copy.description)).toBeVisible()
      expect(
        screen.getByText('Bạn có thể chọn một bước phù hợp với nhịp hôm nay.'),
      ).toBeVisible()
    },
  )

  it('persists presentation preferences and collapses without plan actions', () => {
    render(<SupportPlanCompanionShell state="idle" surface="plan" />)

    const mute = screen.getByRole('button', {
      name: 'Tắt lời nhắc của bạn đồng hành',
    })
    const motion = screen.getByRole('button', { name: 'Giảm chuyển động' })
    const collapse = screen.getByRole('button', {
      name: 'Thu gọn bạn đồng hành',
    })

    fireEvent.click(mute)
    expect(mute).toHaveAttribute('aria-pressed', 'true')
    expect(
      window.localStorage.getItem('mentalbridge_support_plan_companion_muted'),
    ).toBe('true')

    fireEvent.click(motion)
    expect(
      window.localStorage.getItem('mentalbridge_support_plan_companion_motion'),
    ).toBe('reduced')

    fireEvent.click(collapse)
    expect(
      screen.getByRole('button', { name: 'Mở rộng bạn đồng hành' }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen
        .getByText(companionStateCopy.idle.description)
        .closest('.support-plan-companion-body'),
    ).toHaveAttribute('hidden')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('keeps a static pose when the device requests reduced motion', () => {
    installMotionPreference(true)
    render(<SupportPlanCompanionShell state="greeting" surface="today" />)

    expect(
      screen.getByRole('complementary', {
        name: 'Bạn đồng hành trong kế hoạch hỗ trợ',
      }),
    ).toHaveAttribute('data-motion', 'reduced')
    expect(
      screen.getByRole('button', { name: 'Bật chuyển động nhẹ' }),
    ).toBeDisabled()
  })

  it('falls back to a static character if an optional runtime fails', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    function BrokenCharacter(): never {
      throw new Error('animation runtime failed')
    }

    const { container } = render(
      <SupportPlanCompanionShell
        state="waiting"
        surface="adjust"
        CharacterRenderer={BrokenCharacter}
      />,
    )

    expect(
      container.querySelector('.support-plan-companion-static'),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'Bạn có thể xem kỹ từng lựa chọn trước khi xác nhận thay đổi.',
      ),
    ).toBeVisible()
    error.mockRestore()
  })
})
