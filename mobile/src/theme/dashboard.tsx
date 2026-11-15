import { createContext, useContext } from 'react'
import { Text, type TextProps } from 'react-native'

import { colors as baseColors } from '@/theme/tokens'

// Palette of the USER home dashboard (a refinement of the base tokens).
export const dashboardColors = {
  ...baseColors,
  surfaceSoft: '#F2F4F2',
  ink: '#1A1C1E',
  inkSoft: '#5B6470',
  inkFaint: '#596573',
  teal: '#1F5C3F',
  tealDeep: '#174A32',
  tealPale: '#D9F3E4',
  line: 'rgba(26, 28, 30, 0.07)',
}

// Set by the dashboard once its web fonts are registered; plain system font otherwise.
export const DashboardFontContext = createContext<string | undefined>(undefined)

export function Txt({ style, ...props }: TextProps) {
  const fontFamily = useContext(DashboardFontContext)
  return <Text {...props} style={[style, fontFamily ? { fontFamily } : null]} />
}
