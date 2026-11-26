import { useLayoutEffect, useRef } from 'react'
import type { View } from 'react-native'
import { render, screen } from '@testing-library/react-native'
import {
  TourTargetsProvider,
  useRegisterTourTarget,
  useTourTargets,
  findTourTarget,
  measureTourTarget,
} from './tour-target'
import { TourOverlay } from './tour-overlay'
import { GUIDE_STEPS } from './guide-steps'

it('registers real native refs by route and removes them on unmount', async () => {
  let registry: ReturnType<typeof useTourTargets> = null
  const measureInWindow = jest.fn(
    (callback: (x: number, y: number, width: number, height: number) => void) =>
      callback(100, 200, 80, 44),
  )
  function Anchor({ route }: { route: string }) {
    const node = useRef({ measureInWindow } as unknown as View)
    useRegisterTourTarget('tab', route, node)
    const targets = useTourTargets()
    useLayoutEffect(() => {
      registry = targets
    }, [targets])
    return null
  }
  const view = await render(
    <TourTargetsProvider>
      <Anchor route="/specialist" />
      <Anchor route="/appointments" />
    </TourTargetsProvider>,
  )
  const target = findTourTarget(registry, 'tab', '/appointments')
  expect(target?.route).toBe('/appointments')
  expect(await measureTourTarget(target!.node.current!)).toEqual({
    x: 100,
    y: 200,
    width: 80,
    height: 44,
  })
  expect(findTourTarget(registry, 'tab', '/profile')).toBeUndefined()
  await view.unmount()
  expect(findTourTarget(registry, 'tab', '/appointments')).toBeUndefined()
})

it('renders a real spotlight and arrow with accessible progress and reachable dismissal', async () => {
  const onSkip = jest.fn()
  await render(
    <TourOverlay
      step={GUIDE_STEPS.SPECIALIST[0]}
      index={0}
      count={6}
      rect={{ x: 15, y: 740, width: 70, height: 58 }}
      viewport={{ width: 390, height: 844, top: 24, bottom: 24 }}
      unavailable={false}
      onBack={jest.fn()}
      onNext={jest.fn()}
      onSkip={onSkip}
      onRetry={jest.fn()}
    />,
  )
  expect(screen.getByTestId('tour-spotlight')).toBeOnTheScreen()
  expect(screen.getByTestId('tour-arrow')).toBeOnTheScreen()
  expect(
    screen.getByRole('header', { name: 'Bước 1 trên 6. Tổng quan công việc' }),
  ).toBeOnTheScreen()
  expect(screen.getByRole('button', { name: 'Bỏ qua hướng dẫn' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Quay lại' })).toBeDisabled()
})

it('does not draw a misleading hole when a target is missing and offers retry', async () => {
  await render(
    <TourOverlay
      step={GUIDE_STEPS.SPECIALIST[0]}
      index={0}
      count={6}
      rect={null}
      viewport={{ width: 390, height: 844, top: 24, bottom: 24 }}
      unavailable
      onBack={jest.fn()}
      onNext={jest.fn()}
      onSkip={jest.fn()}
      onRetry={jest.fn()}
    />,
  )
  expect(screen.queryByTestId('tour-spotlight')).toBeNull()
  expect(screen.getByRole('button', { name: 'Tìm lại vị trí' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Bỏ qua hướng dẫn' })).toBeEnabled()
})
