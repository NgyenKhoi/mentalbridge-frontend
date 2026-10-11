import { appendFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

if (
  process.env.CI !== 'true' ||
  process.env.PROVIDER_EVIDENCE !== 'protected-controlled-real-contract' ||
  !process.env.GITHUB_ENV
)
  throw new Error('This setup only supports disposable protected CI services.')
const password = process.env.MAESTRO_MB_USER_PASSWORD
if (!password) throw new Error('Dedicated fixture password required.')
const compose = [
  'compose',
  '--project-name',
  'mentalbridge-controlled-e2e',
  '--env-file',
  '.env.mobile-resources-e2e',
  '-f',
  'docker-compose.local.yml',
  '-f',
  'docker-compose.e2e.yml',
  '-f',
  'docker-compose.e2e.local.yml',
  '-f',
  '../mobile/ci/docker-compose.mobile-resources-e2e.yml',
  '-f',
  '../mobile/ci/docker-compose.mobile-discovery-e2e.yml',
]
const uuid = (value) => {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new Error('Fixture identity contract failed.')
  return value
}
function provision(service, database, sql) {
  const result = spawnSync(
    'docker',
    [
      ...compose,
      'exec',
      '-T',
      service,
      'psql',
      '-U',
      database,
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      cwd: resolve('..', 'backend-provider'),
      input: sql,
      encoding: 'utf8',
    },
  )
  if (result.status !== 0)
    throw new Error(`Disposable ${service} fixture provisioning failed.`)
}
const adminId = randomUUID()
provision(
  'identity-postgres',
  'mentalbridge_identity',
  `
  begin;
  update account set role_code='SPECIALIST', version=version+1
    where email='e2e-user-b@synthetic.invalid' and role_code='USER';
  insert into account (id,email,password_hash,status,email_verified_at,role_code)
    select '${adminId}','e2e-discovery-admin@synthetic.invalid',password_hash,'ACTIVE',now(),'ADMIN'
    from account where email='e2e-user-a@synthetic.invalid' and role_code='USER';
  commit;
`,
)
async function session(email, expectedRole) {
  const login = await fetch('http://127.0.0.1:8080/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!login.ok)
    throw new Error(`Dedicated fixture login failed: ${login.status}`)
  const tokens = await login.json()
  if (typeof tokens.accessToken !== 'string')
    throw new Error('Fixture login contract failed.')
  const headers = {
    Authorization: `Bearer ${tokens.accessToken}`,
    'Content-Type': 'application/json',
  }
  const account = await fetch('http://127.0.0.1:8080/api/v1/account', {
    headers,
  })
  if (!account.ok) throw new Error('Fixture account verification failed.')
  const owner = await account.json()
  if (
    !Array.isArray(owner.roles) ||
    owner.roles.length !== 1 ||
    owner.roles[0] !== expectedRole ||
    owner.status !== 'ACTIVE' ||
    owner.emailVerified !== true
  )
    throw new Error('Fixture authoritative role mismatch.')
  return { headers, id: uuid(owner.accountId) }
}
const user = await session('e2e-user-a@synthetic.invalid', 'USER')
const specialist = await session('e2e-user-b@synthetic.invalid', 'SPECIALIST')
const admin = await session('e2e-discovery-admin@synthetic.invalid', 'ADMIN')
const base = 'http://127.0.0.1:8082/api/v1'
async function command(path, headers, body, expectedStatus) {
  const response = await fetch(`${base}${path}`, {
    method: path === '/specialist-profile' ? 'PUT' : 'POST',
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  if (response.status !== expectedStatus)
    throw new Error(
      `Synthetic Consultation command failed: ${path} HTTP ${response.status}`,
    )
  return { body: await response.json(), etag: response.headers.get('etag') }
}
const profile = await command(
  '/specialist-profile',
  specialist.headers,
  {
    displayName: 'MB629 synthetic specialist',
    bio: 'Synthetic public profile for the protected mobile discovery journey.',
    supportAreas: ['ANXIETY_SYMPTOMS'],
    languages: ['vi'],
    yearsOfExperience: 5,
    timezone: 'Asia/Ho_Chi_Minh',
  },
  201,
)
const submitted = await command(
  '/specialist-profile/submit',
  { ...specialist.headers, 'If-Match': profile.etag },
  null,
  200,
)
const approved = await command(
  `/admin/specialist-profiles/${specialist.id}/approve`,
  { ...admin.headers, 'If-Match': submitted.etag },
  null,
  200,
)
if (approved.body.approvalStatus !== 'APPROVED')
  throw new Error('Authoritative approval failed.')
const start = new Date(Date.now() + 172_800_000)
start.setUTCMinutes(0, 0, 0)
const slot = await command(
  '/availability-slots',
  { ...specialist.headers, 'Idempotency-Key': randomUUID() },
  {
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + 3_600_000).toISOString(),
    timezone: 'Asia/Ho_Chi_Minh',
    modality: 'IN_APP_CHAT',
  },
  201,
)
async function browse() {
  const response = await fetch(`${base}/specialists`, { headers: user.headers })
  if (!response.ok)
    throw new Error(`Real public discovery failed: ${response.status}`)
  return response.json()
}
const free = await browse()
if (
  free.packageCode !== 'FREE' ||
  free.bookingHandoff !== 'BROWSE_ONLY' ||
  !free.items.some((item) => item.specialistAccountId === specialist.id)
)
  throw new Error('FREE public discovery preflight failed.')
provision(
  'consultation-postgres',
  'mentalbridge_consultation',
  `
  insert into current_service_entitlement
    (account_id,package_code,source,source_reference,established_by,effective_from,effective_until,policy_version)
  values ('${user.id}','PLUS','DEMO','mb-629-protected-synthetic-demo','${admin.id}',
    now()-interval '1 minute',now()+interval '${process.env.MOBILE_EVIDENCE_FEATURE === 'appointments' ? '7 days' : '1 day'}','service-entitlement-v1');
`,
)
if (process.env.MOBILE_EVIDENCE_FEATURE === 'appointments') {
  const response = await fetch(`${base}/service-credits`, {
    headers: user.headers,
  })
  if (!response.ok) throw new Error('Real credit provisioning failed.')
  const credits = await response.json()
  if (
    credits.accountId !== user.id ||
    credits.balance.available < 1 ||
    credits.reservationCapacity.remaining < 1 ||
    credits.source !== 'DEMO'
  )
    throw new Error('Dedicated DEMO credit/capacity preflight failed.')
  console.log(
    'Real owner service-credit read provisioned DEMO credits covering the exact slot. No ledger or paid facts seeded.',
  )
}
const demo = await browse()
if (
  demo.packageCode !== 'PLUS' ||
  demo.bookingHandoff !== 'BOOKING_POLICY_CHECK_REQUIRED'
)
  throw new Error('Explicit DEMO handoff policy preflight failed.')
appendFileSync(
  process.env.GITHUB_ENV,
  `MAESTRO_MB_DISCOVERY_SPECIALIST_ID=${specialist.id}\nMAESTRO_MB_DISCOVERY_SLOT_ID=${uuid(slot.body.id)}\n`,
)
console.log(
  'Dedicated roles verified through real Identity; profile submitted/approved and exact slot published through public Consultation. FREE browse and explicit DEMO handoff verified. No paid lifecycle, booking or real user data.',
)
