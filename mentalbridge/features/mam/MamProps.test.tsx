import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MamProp, mamPropLayers, type MamPropId } from './MamProps'

const IDS: MamPropId[] = [
  'parachute',
  'plantPot',
  'cheerSign',
  'umbrella',
  'butterfly',
]

/** jsdom has no matchMedia: without one the hook reports reduced motion, so each test says which it wants. */
function motion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query.includes('reduce'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

describe('MamProp (MB-896 host props)', () => {
  beforeEach(() => motion(false))
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('draws each prop per layer, decorative, click-through and in the character box', () => {
    for (const id of IDS) {
      for (const layer of mamPropLayers(id)) {
        const { container, unmount } = render(
          <MamProp
            id={id}
            phase="in"
            layer={layer}
            size={96}
            onGone={() => {}}
          />,
        )
        const svg = container.querySelector('svg')!
        expect(svg, `${id}:${layer}`).not.toBeNull()
        expect(svg.getAttribute('aria-hidden')).toBe('true')
        expect(svg.getAttribute('focusable')).toBe('false')
        expect(
          container.querySelector('button, a, input, [tabindex]'),
        ).toBeNull()
        unmount()
      }
    }
  })

  it('hides the butterfly box from assistive technology too', () => {
    const { container } = render(
      <MamProp
        id="butterfly"
        phase="in"
        layer="front"
        size={96}
        onGone={() => {}}
      />,
    )
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe(
      'true',
    )
  })

  it('splits the pot into a back layer and a front lip, and the sign carries its words', () => {
    expect(mamPropLayers('plantPot')).toEqual(['back', 'front'])
    expect(mamPropLayers('parachute')).toEqual(['mover'])
    const { container } = render(
      <MamProp
        id="cheerSign"
        phase="in"
        layer="back"
        size={96}
        onGone={() => {}}
      />,
    )
    expect(container.textContent).toBe('Giỏi lắm!')
  })

  it('keeps the sign text at 12 px or more on the 96 px and the 72 px dock, on the right or above her', () => {
    for (const [size, side] of [
      [96, 'right'],
      [96, 'above'],
      [72, 'right'],
      [72, 'above'],
    ] as const) {
      const { container, unmount } = render(
        <MamProp
          id="cheerSign"
          phase="in"
          layer="back"
          size={size}
          side={side}
          onGone={() => {}}
        />,
      )
      const text = container.querySelector('text')!
      expect(
        (Number(text.getAttribute('font-size')) * size) / 512,
        `${size} ${side}`,
      ).toBeGreaterThanOrEqual(12)
      // The board stays inside a 4 px page gutter at 375: no more than 1.7 boxes to the right of her left edge.
      const boards = [...container.querySelectorAll('rect')].filter(
        (rect) => rect.getAttribute('rx') === '20',
      )
      const right = Math.max(
        ...boards.map(
          (rect) =>
            Number(rect.getAttribute('x')) + Number(rect.getAttribute('width')),
        ),
      )
      expect(right / 512, `${size} ${side}`).toBeLessThanOrEqual(1.7)
      const origin = container.querySelector('svg')!.style.transformOrigin
      expect(origin, `${size} ${side}`).toMatch(/%/)
      unmount()
    }
  })

  it('puts the sign above her head when told there is no room on the right', () => {
    const { container } = render(
      <MamProp
        id="cheerSign"
        phase="in"
        layer="back"
        size={72}
        side="above"
        onGone={() => {}}
      />,
    )
    const board = [...container.querySelectorAll('rect')].find(
      (rect) => rect.getAttribute('rx') === '20',
    )!
    // Above: the board's bottom is above the head, and there is no pole.
    expect(
      Number(board.getAttribute('y')) + Number(board.getAttribute('height')),
    ).toBeLessThanOrEqual(30)
    expect(container.querySelectorAll('ellipse')).toHaveLength(0)
  })

  it('retires a prop only when its own exit animation ends, never a looping child', () => {
    const onGone = vi.fn()
    const { container, rerender } = render(
      <MamProp
        id="parachute"
        phase="in"
        layer="mover"
        size={96}
        onGone={onGone}
      />,
    )
    fireEvent.animationEnd(container.querySelector('svg')!)
    expect(onGone).not.toHaveBeenCalled()
    rerender(
      <MamProp
        id="parachute"
        phase="out"
        layer="mover"
        size={96}
        onGone={onGone}
      />,
    )
    fireEvent.animationEnd(container.querySelector('g')!)
    expect(onGone).not.toHaveBeenCalled()
    fireEvent.animationEnd(container.querySelector('svg')!)
    expect(onGone).toHaveBeenCalledWith('parachute')
  })

  it('under reduced motion an exiting prop is retired at once: no animation runs, so none would end', () => {
    motion(true)
    const onGone = vi.fn()
    const { rerender } = render(
      <MamProp
        id="plantPot"
        phase="in"
        layer="back"
        size={96}
        onGone={onGone}
      />,
    )
    expect(onGone).not.toHaveBeenCalled()
    rerender(
      <MamProp
        id="plantPot"
        phase="out"
        layer="back"
        size={96}
        onGone={onGone}
      />,
    )
    expect(onGone).toHaveBeenCalledWith('plantPot')
  })

  it('retires the butterfly as soon as its sequence takes it away', () => {
    const onGone = vi.fn()
    const { rerender } = render(
      <MamProp
        id="butterfly"
        phase="in"
        layer="front"
        size={96}
        onGone={onGone}
      />,
    )
    expect(onGone).not.toHaveBeenCalled()
    rerender(
      <MamProp
        id="butterfly"
        phase="out"
        layer="front"
        size={96}
        onGone={onGone}
      />,
    )
    expect(onGone).toHaveBeenCalledWith('butterfly')
  })

  it('animates the butterfly along its path, cancels it on unmount, and does not animate under reduced motion', () => {
    const cancel = vi.fn()
    const animate = vi.fn(() => ({ cancel }))
    Object.defineProperty(SVGElement.prototype, 'animate', {
      value: animate,
      configurable: true,
      writable: true,
    })
    try {
      const { unmount } = render(
        <MamProp
          id="butterfly"
          phase="in"
          layer="front"
          size={96}
          onGone={() => {}}
        />,
      )
      expect(animate).toHaveBeenCalledTimes(1)
      const [frames, timing] = animate.mock.calls[0] as unknown as [
        Array<{ offset: number; opacity: number }>,
        { duration: number },
      ]
      expect(frames[0]).toMatchObject({ offset: 0, opacity: 0 })
      expect(frames.at(-1)).toMatchObject({ offset: 1, opacity: 0 })
      expect(timing.duration).toBeGreaterThan(3000)
      unmount()
      expect(cancel).toHaveBeenCalled()

      motion(true)
      animate.mockClear()
      render(
        <MamProp
          id="butterfly"
          phase="in"
          layer="front"
          size={96}
          onGone={() => {}}
        />,
      )
      expect(animate).not.toHaveBeenCalled()
    } finally {
      Reflect.deleteProperty(SVGElement.prototype, 'animate')
    }
  })
})
