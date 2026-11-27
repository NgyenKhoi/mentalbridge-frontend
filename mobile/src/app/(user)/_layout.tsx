import { Stack, usePathname } from 'expo-router'
import { View } from 'react-native'

import { ScreenBottomInsetContext } from '@/components/Screen'
import { isUserTabPath, UserTabBar } from '@/navigation/UserTabBar'

export default function UserLayout() {
  const pathname = usePathname()
  const showTabs = isUserTabPath(pathname)

  return (
    <ScreenBottomInsetContext.Provider value={!showTabs}>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ animation: 'none', headerShown: false }} />
        {showTabs && <UserTabBar pathname={pathname} />}
      </View>
    </ScreenBottomInsetContext.Provider>
  )
}
