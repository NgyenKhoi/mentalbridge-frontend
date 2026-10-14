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

  it('persists presentation preferences and collapses to a marked rail without plan actions', () => {
    const { container } = render(
      <SupportPlanCompanionShell state="idle" surface="plan" />,
    )

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
    expect(
      container
        .querySelector('.support-plan-companion-mark')
        ?.closest('.support-plan-companion-body'),
    ).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it.each([
    [
      'localStorage getter',
      () => {
        const originalStorage = window.localStorage
        const descriptor = Object.getOwnPropertyDescriptor(
          window,
          'localStorage',
        )
        Object.defineProperty(window, 'localStorage', {
          configurable: true,
          get: () => {
            throw new DOMException('Storage denied', 'SecurityError')
          },
        })
        return () => {
          if (descriptor) {
            Object.defineProperty(window, 'localStorage', descriptor)
          } else {
            Object.defineProperty(window, 'localStorage', {
              configurable: true,
              value: originalStorage,
            })
          }
        }
      },
    ],
    [
      'localStorage.getItem',
      () => {
        const spy = vi
          .spyOn(Storage.prototype, 'getItem')
          .mockImplementation(() => {
            throw new DOMException('Storage denied', 'SecurityError')
          })
        return () => spy.mockRestore()
      },
    ],
    [
      'localStorage.setItem',
      () => {
        const spy = vi
          .spyOn(Storage.prototype, 'setItem')
          .mockImplementation(() => {
            throw new DOMException('Storage denied', 'SecurityError')
          })
        return () => spy.mockRestore()
      },
    ],
  ] satisfies ReadonlyArray<[string, () => () => void]>)(
    'keeps presentation preferences and plan controls usable when %s throws',
    (_denial, installDenial) => {
      const restore = installDenial()
      const planAction = vi.fn()
      let mute: HTMLElement | undefined
      let motion: HTMLElement | undefined

      try {
        render(
          <>
            <SupportPlanCompanionShell state="idle" surface="plan" />
            <button type="button" onClick={planAction}>
              Lưu kế hoạch
            </button>
          </>,
        )

        expect(
          screen.getByRole('complementary', {
            name: 'Bạn đồng hành trong kế hoạch hỗ trợ',
          }),
        ).toBeVisible()
        mute = screen.getByRole('button', { name: /lời nhắc/ })
        motion = screen.getByRole('button', { name: /chuyển động/ })
        const mutedBefore = mute.getAttribute('aria-pressed')
        const motionBefore = motion.getAttribute('aria-pressed')

        fireEvent.click(mute)
        fireEvent.click(motion)
        fireEvent.click(screen.getByRole('button', { name: 'Lưu kế hoạch' }))

        expect(mute).toHaveAttribute(
          'aria-pressed',
          mutedBefore === 'true' ? 'false' : 'true',
        )
        expect(motion).toHaveAttribute(
          'aria-pressed',
          motionBefore === 'true' ? 'false' : 'true',
        )
        expect(planAction).toHaveBeenCalledOnce()
        expect(screen.queryByRole('textbox')).toBeNull()
      } finally {
        restore()
        if (mute && motion) {
          // A successful write clears the page-lifetime fallback between cases.
          fireEvent.click(mute)
          fireEvent.click(motion)
        }
      }
    },
  )

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
