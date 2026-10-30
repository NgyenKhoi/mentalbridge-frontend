import type { MobileRole } from '@/auth/session'
import type { NotificationAction } from './notification-contract'
import { z } from 'zod'

function specialistNotificationDestination(action: NotificationAction) {
  if (action.targetId !== null) return null

  switch (action.type) {
    case 'OPEN_MESSAGES':
      return action.href === '/messages'
        ? { pathname: '/(specialist)/messages' as const }
        : null
    case 'OPEN_SPECIALIST_APPOINTMENTS':
      return action.href === '/specialist/appointments'
        ? { pathname: '/(specialist)/appointments' as const }
        : null
    default:
      return null
  }
}

// Never pass a server href directly to router or Linking. Pair the action and
// target with the exact published web path, then select an installed mobile route.
export function notificationDestination(
  action: NotificationAction | null,
  role: MobileRole,
) {
  if (!action) return null
  if (role === 'SPECIALIST') return specialistNotificationDestination(action)

  if (
    action.type === 'OPEN_COMMUNITY_CONVERSATION' ||
    action.type === 'OPEN_COMMUNITY_REQUEST' ||
    action.type === 'OPEN_COMMUNITY_INVITATION'
  ) {
    if (!z.uuid().safeParse(action.targetId).success) return null
    const targetId = action.targetId
    if (!targetId) return null
    const segment =
      action.type === 'OPEN_COMMUNITY_CONVERSATION'
        ? 'conversations'
        : action.type === 'OPEN_COMMUNITY_REQUEST'
          ? 'requests'
          : 'invitations'
    if (action.href !== `/community/chat/${segment}/${targetId}`) return null
    const params =
      action.type === 'OPEN_COMMUNITY_CONVERSATION'
        ? { conversationId: targetId }
        : action.type === 'OPEN_COMMUNITY_REQUEST'
          ? { requestId: targetId }
          : { invitationId: targetId }
    return { pathname: '/(user)/community-chat' as const, params }
  }
  if (
    action.type === 'OPEN_RESOURCE' ||
    action.type === 'OPEN_COMMUNITY_POST'
  ) {
    if (!action.targetId || !z.uuid().safeParse(action.targetId).success)
      return null
    const isResource = action.type === 'OPEN_RESOURCE'
    if (
      action.href !==
      `/${isResource ? 'resources' : 'community'}/${action.targetId}`
    )
      return null
    return isResource
      ? {
          pathname: '/(user)/resources/[resourceId]' as const,
          params: { resourceId: action.targetId },
        }
      : {
          pathname: '/(user)/community' as const,
          params: { postId: action.targetId },
        }
  }
  if (action.targetId !== null) return null
  switch (action.type) {
    case 'OPEN_JOURNAL':
      return action.href === '/journal'
        ? { pathname: '/(user)/journal' as const }
        : null
    case 'OPEN_MESSAGES':
      return action.href === '/messages'
        ? { pathname: '/(user)/messages' as const }
        : null
    case 'OPEN_APPOINTMENTS':
      return action.href === '/appointments'
        ? { pathname: '/(user)/appointments' as const }
        : null
    case 'OPEN_RESOURCES':
      return action.href === '/resources'
        ? { pathname: '/(user)/resources' as const }
        : null
    case 'OPEN_ASSESSMENTS':
      return action.href === '/assessments'
        ? { pathname: '/(user)/assessment' as const }
        : null
  }
  return null
}
