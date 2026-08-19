import type {
  AccountStatus,
  IdentityRole,
} from '@/features/auth/api/identity-contract'

export type CurrentAccount = Readonly<{
  accountId: string
  status: AccountStatus
  roles: readonly IdentityRole[]
  emailVerified: boolean
}>

export type Workspace = Readonly<{
  role: IdentityRole
  label: string
  path: string
}>

const WORKSPACES: Readonly<Record<IdentityRole, Workspace>> = {
  ADMIN: {
    role: 'ADMIN',
    label: 'Quản trị',
    path: '/admin/dashboard',
  },
  SPECIALIST: {
    role: 'SPECIALIST',
    label: 'Chuyên gia',
    path: '/specialist/dashboard',
  },
  USER: {
    role: 'USER',
    label: 'Cá nhân',
    path: '/dashboard',
  },
}

const ROLE_PRECEDENCE: readonly IdentityRole[] = ['ADMIN', 'SPECIALIST', 'USER']

const ACCOUNT_STATUSES = new Set<AccountStatus>([
  'PENDING_EMAIL_VERIFICATION',
  'ACTIVE',
  'DISABLED',
  'DELETION_PENDING',
  'DELETED',
])
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIdentityRole(value: unknown): value is IdentityRole {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(WORKSPACES, value)
  )
}

export function resolveWorkspaces(roles: readonly unknown[]) {
  if (
    roles.length === 0 ||
    roles.some((role) => !isIdentityRole(role)) ||
    new Set(roles).size !== roles.length
  ) {
    return null
  }

  return ROLE_PRECEDENCE.filter((role) => roles.includes(role)).map(
    (role) => WORKSPACES[role],
  )
}

export function primaryWorkspacePath(roles: readonly unknown[]) {
  return resolveWorkspaces(roles)?.[0]?.path ?? null
}

export function parseCurrentAccountResponse(value: unknown) {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== 'account')) {
    return null
  }

  const account = value.account
  if (
    !isRecord(account) ||
    Object.keys(account).some(
      (key) => !['accountId', 'status', 'roles', 'emailVerified'].includes(key),
    ) ||
    typeof account.accountId !== 'string' ||
    !UUID_PATTERN.test(account.accountId) ||
    !ACCOUNT_STATUSES.has(account.status as AccountStatus) ||
    !Array.isArray(account.roles) ||
    resolveWorkspaces(account.roles) === null ||
    typeof account.emailVerified !== 'boolean'
  ) {
    return null
  }

  return account as CurrentAccount
}

export function isUsableAccount(account: CurrentAccount) {
  return account.status === 'ACTIVE' && account.emailVerified
}
