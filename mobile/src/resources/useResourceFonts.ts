import { useEffect, useState } from 'react'

let loading: Promise<void> | undefined

// These are the families used by the web breathing resource stylesheet.
// Load them as assets so the existing development APK needs no native rebuild.
export function useResourceFonts() {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let active = true
    loading ??= import('expo-font')
      .then(({ loadAsync }) =>
        loadAsync({
          ResourceSans: require('../../assets/fonts/resource-web/BeVietnamPro-Regular.ttf'),
          ResourceSansSemibold: require('../../assets/fonts/resource-web/BeVietnamPro-SemiBold.ttf'),
          ResourceSerif: require('../../assets/fonts/resource-web/Fraunces.ttf'),
          ResourceSerifItalic: require('../../assets/fonts/resource-web/Fraunces-Italic.ttf'),
        }),
      )
      .catch((error: unknown) => {
        loading = undefined
        throw error
      })
    void loading
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
