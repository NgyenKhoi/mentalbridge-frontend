import { Stack } from 'expo-router'

export default function PublicLayout() {
  return <Stack screenOptions={{ animation: 'none', headerShown: false }} />
}
