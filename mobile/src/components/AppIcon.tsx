import { Image } from 'react-native'

const sources = {
  home: require('../../assets/icons/home.png'),
  clipboard: require('../../assets/icons/clipboard.png'),
  book: require('../../assets/icons/book.png'),
  plus: require('../../assets/icons/plus.png'),
  user: require('../../assets/icons/user.png'),
  calendar: require('../../assets/icons/calendar.png'),
  chat: require('../../assets/icons/chat.png'),
  video: require('../../assets/icons/video.png'),
  swap: require('../../assets/icons/swap.png'),
  close: require('../../assets/icons/close.png'),
  back: require('../../assets/icons/back.png'),
  chevron: require('../../assets/icons/chevron.png'),
  refresh: require('../../assets/icons/refresh.png'),
  lock: require('../../assets/icons/lock.png'),
  headphones: require('../../assets/icons/headphones.png'),
} as const

export type AppIconName = keyof typeof sources

export function AppIcon({
  name,
  size = 24,
  color = '#1E4A43',
}: Readonly<{ name: AppIconName; size?: number; color?: string }>) {
  return (
    <Image
      accessible={false}
      source={sources[name]}
      resizeMode="contain"
      style={{ width: size, height: size, tintColor: color }}
    />
  )
}
