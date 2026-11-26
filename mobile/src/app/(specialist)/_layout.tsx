import { Stack } from 'expo-router'

export const unstable_settings = { initialRouteName: 'specialist' }

export default function SpecialistLayout() {
  return <Stack screenOptions={{ animation: 'none', headerShown: false }} />
}
