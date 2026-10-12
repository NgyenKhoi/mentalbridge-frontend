import type { NotificationAction } from './notification-contract'

// Never pass a server href directly to router or Linking. Pair the action and
// target with the exact published web path, then select an installed mobile route.
export function notificationDestination(action: NotificationAction | null) {
  if (!action) return null
  if (
    action.type === 'OPEN_RESOURCE' ||
    action.type === 'OPEN_COMMUNITY_POST'
  ) {
    if (!action.targetId) return null
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
}
