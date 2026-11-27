import NetInfo from '@react-native-community/netinfo'
import { focusManager, onlineManager } from '@tanstack/react-query'
import { AppState } from 'react-native'

export function bindQueryLifecycle(): () => void {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected === true)
    }),
  )

  const appStateSubscription = AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active')
  })

  return () => {
    appStateSubscription.remove()
    onlineManager.setEventListener(() => () => undefined)
    focusManager.setFocused(undefined)
  }
}
