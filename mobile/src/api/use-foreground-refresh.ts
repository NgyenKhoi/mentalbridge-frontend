import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'

// The USER inbox is a pull API. Refresh only the visible screen, never in
// the background, and catch up when the user comes back.
const REFRESH_INTERVAL_MS = 15_000

export function useForegroundRefresh(refresh: () => void, enabled = true) {
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return
      let active = AppState.currentState === 'active'
      const subscription = AppState.addEventListener('change', (state) => {
        const resumed = !active && state === 'active'
        active = state === 'active'
        if (resumed) refreshRef.current()
      })
      const timer = setInterval(() => {
        if (active) refreshRef.current()
      }, REFRESH_INTERVAL_MS)
      return () => {
        clearInterval(timer)
        subscription.remove()
      }
    }, [enabled]),
  )
}
