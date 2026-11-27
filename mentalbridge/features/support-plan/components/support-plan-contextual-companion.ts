export type ContextualCompanionSnapshot = Readonly<{
  requestId: number
  targetId: string
  supportPlanId: string
  actionId: string
  actionTitle: string
  surface: 'TODAY' | 'PLAN'
  status: 'loading' | 'ready' | 'fallback'
  message?: string
}>

export type ContextualCompanionRequest = Readonly<{
  targetId: string
  supportPlanId: string
  actionId: string
  actionTitle: string
  surface: 'TODAY' | 'PLAN'
}>
