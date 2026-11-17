import { fireEvent, render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

import { useSafetyButtonLift } from '@/crisis-support/safety-button-lift'

import { Screen } from './Screen'

function Probe() {
  return <Text>{`lift:${useSafetyButtonLift()}`}</Text>
}

const layout = (height: number) => ({
  nativeEvent: { layout: { height, width: 360, x: 0, y: 0 } },
})

describe('Screen safety button lift', () => {
  it('lifts by the footer height and resets when the screen unmounts', async () => {
    const page = (withScreen: boolean) => (
      <>
        <Probe />
        {withScreen && (
          <Screen footer={<Text>Gửi</Text>}>
            <Text>Nội dung</Text>
          </Screen>
        )}
      </>
    )
    const view = await render(page(true))
    await fireEvent(screen.getByText('Gửi').parent!, 'layout', layout(84))
    expect(screen.getByText('lift:84')).toBeOnTheScreen()
    await view.rerender(page(false))
    expect(screen.getByText('lift:0')).toBeOnTheScreen()
  })

  it('leaves the lift at 0 for a screen without a footer', async () => {
    await render(
      <>
        <Probe />
        <Screen>
          <Text>Nội dung</Text>
        </Screen>
      </>,
    )
    expect(screen.getByText('lift:0')).toBeOnTheScreen()
  })

  it('keeps a header outside the scrolling content', async () => {
    await render(
      <Screen layout="bleed" header={<Text>Tiêu đề</Text>}>
        <Text>Nội dung</Text>
      </Screen>,
    )
    const header = screen.getByText('Tiêu đề')
    const body = screen.getByText('Nội dung')
    expect(header.parent).toBe(body.parent?.parent?.parent?.parent)
  })
})
