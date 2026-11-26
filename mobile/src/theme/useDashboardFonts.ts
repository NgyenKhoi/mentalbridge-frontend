import { useEffect, useState } from 'react'

export function useDashboardFonts() {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let active = true
    // Older development builds can keep rendering with the system fonts.
    void import('expo-font')
      .then(({ loadAsync }) =>
        loadAsync({
          DashboardSans: require('../../assets/fonts/PlusJakartaSans.ttf'),
          DashboardSerif: require('../../assets/fonts/Lora.ttf'),
        }),
      )
      .then(() => {
        if (active) setLoaded(true)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])
  return loaded
}
