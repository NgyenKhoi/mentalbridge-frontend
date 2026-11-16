import { useEffect, useState, type ReactNode } from 'react'

import { DashboardFontContext } from '@/theme/dashboard'

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

// For routes a deep link can reach without passing through Home.
export function DashboardFontProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const loaded = useDashboardFonts()
  return (
    <DashboardFontContext.Provider value={loaded ? 'DashboardSans' : undefined}>
      {children}
    </DashboardFontContext.Provider>
  )
}
