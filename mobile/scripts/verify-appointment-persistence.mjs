// Protected disposable-provider verification, not application business logic.
if (
  process.env.CI !== 'true' ||
  process.env.PROVIDER_EVIDENCE !== 'protected-controlled-real-contract' ||
  process.env.MOBILE_EVIDENCE_FEATURE !== 'appointments'
)
  throw new Error('Protected controlled appointment provider required.')
const base = 'http://127.0.0.1:8088/api/v1'
async function json(path, options) {
  const response = await fetch(`${base}${path}`, options)
  if (!response.ok)
    throw new Error(
      `Controlled contract verification failed: HTTP ${response.status}`,
    )
  return response.json()
}
const login = await json('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: process.env.MAESTRO_MB_USER_EMAIL,
    password: process.env.MAESTRO_MB_USER_PASSWORD,
  }),
})
const headers = { Authorization: `Bearer ${login.accessToken}` }
const [list, account] = await Promise.all([
  json('/appointments', { headers }),
  json('/service-credits', { headers }),
])
const matches = list.items.filter(
  (item) => item.slotId === process.env.MAESTRO_MB_DISCOVERY_SLOT_ID,
)
if (
  matches.length !== 1 ||
  matches[0].status !== 'REQUESTED' ||
  matches[0].creditState !== 'HELD' ||
  !matches[0].history.some(
    (entry) => entry.reason === 'APPOINTMENT_REQUESTED',
  ) ||
  account.source !== 'DEMO' ||
  account.balance.held !== 1 ||
  account.reservationCapacity.active !== 1
)
  throw new Error(
    'Persisted owner appointment/held-credit/capacity proof failed.',
  )
console.log(
  'Real owner GET verified one persisted REQUESTED appointment for the exact fixture slot, one held credit and one active reservation. No identifiers or payload retained.',
)
