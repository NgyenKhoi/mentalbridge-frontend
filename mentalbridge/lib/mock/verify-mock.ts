import {
  parseProfile,
  parseSpecialistDashboard,
  parseAppointmentList,
  parseAvailabilitySlotList,
  parseSpecialistEarnings
} from '../consultation/consultation-validation'
import {
  parseSpecialistClientContinuityList,
  parseSpecialistConsultationBrief
} from '../care/consultation-brief-validation'
import {
  MOCK_SPECIALIST_PROFILE,
  MOCK_SPECIALIST_DASHBOARD,
  MOCK_SPECIALIST_APPOINTMENTS,
  MOCK_AVAILABILITY_SLOTS,
  MOCK_SPECIALIST_EARNINGS,
  MOCK_SPECIALIST_CLIENT_CONTINUITY,
  MOCK_SPECIALIST_CONSULTATION_BRIEF
} from './specialist-mock-data'

const checks: [string, unknown][] = [
  ['Profile', parseProfile(MOCK_SPECIALIST_PROFILE)],
  ['Dashboard', parseSpecialistDashboard(MOCK_SPECIALIST_DASHBOARD)],
  ['Appointments', parseAppointmentList(MOCK_SPECIALIST_APPOINTMENTS)],
  ['Availability', parseAvailabilitySlotList(MOCK_AVAILABILITY_SLOTS)],
  ['Earnings', parseSpecialistEarnings(MOCK_SPECIALIST_EARNINGS)],
  ['ClientContinuity', parseSpecialistClientContinuityList(MOCK_SPECIALIST_CLIENT_CONTINUITY)],
  ['ConsultationBrief', parseSpecialistConsultationBrief(MOCK_SPECIALIST_CONSULTATION_BRIEF)],
]

let allPassed = true
for (const [name, res] of checks) {
  if (res) {
    console.log(`[PASS] ${name}`)
  } else {
    console.error(`[FAIL] ${name}`)
    allPassed = false
  }
}

if (!allPassed) {
  process.exit(1)
} else {
  console.log('SUCCESS: All 7 mock datasets fully conform to schema validations!')
}

