import type { AppSession } from '@/auth/session'

export type RouteGuards = Readonly<{
  public: boolean
  user: boolean
  specialist: boolean
}>

export function getRouteGuards(session: AppSession | null): RouteGuards {
  return {
    public: session === null,
    user: session?.role === 'USER',
    specialist: session?.role === 'SPECIALIST',
  }
}
