import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SessionProvider } from '../../../../mobile/src/auth/session-context'
import { SpecialistAppointmentDetailScreen } from '../../../../mobile/src/specialist-appointments/SpecialistAppointmentDetailScreen'
import { makeAppointment, makeAppointmentList, APPOINTMENT_ID, SPECIALIST_ID } from '../../../../mobile/src/specialist-appointments/specialist-appointment-test-fixtures'
import { AppointmentsScreen } from '../../../../mobile/src/appointments/AppointmentsScreen'
import { appointment, credits, subject } from '../../../../mobile/src/appointments/appointment-fixtures'

// Entire existing native route, including Screen/safe area/back/title/context.
// Router stack headers are disabled in both production layouts. Synthetic APIs
// make this visual evidence only, never an Android/LiveKit integration claim.
const specialist = new URLSearchParams(location.search).get('role') !== 'user'
const query = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const session = { subject: specialist ? SPECIALIST_ID : subject, role: specialist ? 'SPECIALIST' : 'USER' }
const service = { restore: async () => null }
createRoot(document.getElementById('root')).render(
  <SafeAreaProvider><QueryClientProvider client={query}><SessionProvider service={service} initialSession={session}>
    {specialist ? <SpecialistAppointmentDetailScreen
      appointmentId={APPOINTMENT_ID}
      appointmentApi={{ listAssigned: async () => makeAppointmentList([makeAppointment({ status: 'CONFIRMED', modality: 'IN_APP_VIDEO' })]) }}
      continuityApi={{ list: async () => ({ items: [], count: 0 }) }}
      summaryApi={{ list: async () => ({ items: [], count: 0 }) }}
      chatHandoff={{ available: false, openAppointmentChat() {} }}
    /> : <AppointmentsScreen
      api={{ list: async () => ({ items: [{ ...appointment, modality: 'IN_APP_VIDEO', status: 'CONFIRMED' }], count: 1, generatedAt: credits.generatedAt }), credits: async () => credits }}
      discovery={{ list: async () => ({ items: [], count: 0 }) }} onBack={() => {}}
    />}
  </SessionProvider></QueryClientProvider></SafeAreaProvider>
)
