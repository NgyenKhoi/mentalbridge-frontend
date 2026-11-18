import { useLocalSearchParams } from 'expo-router'
import { NotificationRoute } from '@/notifications/NotificationRoute'

export default function UserNotifications() {
  const { filter } = useLocalSearchParams<{ filter?: string }>()
  return <NotificationRoute appointmentFilter={filter === 'appointments'} />
}
