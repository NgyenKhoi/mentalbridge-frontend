import { z } from 'zod'

import type { MobileRole } from '@/auth/session'
import {
  notificationActionSchema,
  notificationKindSchema,
} from '@/notifications/notification-contract'
import { notificationDestination } from '@/notifications/notification-link'

// Backend push `data` (ADR 0044): reviewed ids and a closed action only.
const pushDataSchema = z.object({
  notificationId: z.uuid(),
  kind: notificationKindSchema,
  action: notificationActionSchema.nullable(),
})

export type PushData = z.infer<typeof pushDataSchema>

export type PushDestination =
  | NonNullable<ReturnType<typeof notificationDestination>>
  | { pathname: '/(user)/user'; params: { focus: 'emotion' } }
  | { pathname: '/(user)/notifications' }
  | { pathname: '/(specialist)/notifications' }

export function parsePushData(data: unknown): PushData | null {
  const parsed = pushDataSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}

// Old app / new server, missing or malformed data: never throw, open the inbox.
export function pushDestination(
  data: unknown,
  role: MobileRole,
): PushDestination {
  const inbox =
    role === 'SPECIALIST'
      ? ({ pathname: '/(specialist)/notifications' } as const)
      : ({ pathname: '/(user)/notifications' } as const)
  const parsed = parsePushData(data)
  if (!parsed) return inbox

  if (
    role === 'USER' &&
    (parsed.kind === 'EMOTION_CHECKIN_REMINDER' ||
      parsed.kind === 'EMOTION_STREAK_MILESTONE')
  ) {
    return { pathname: '/(user)/user', params: { focus: 'emotion' } }
  }
  return notificationDestination(parsed.action, role) ?? inbox
}
