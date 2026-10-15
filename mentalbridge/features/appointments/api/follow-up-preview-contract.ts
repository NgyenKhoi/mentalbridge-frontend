export type FollowUpLane = 'attention' | 'inProgress' | 'ready'
export type FollowUpPopupKind = 'encourage' | 'screening' | 'summary' | 'progress' | 'prepare' | 'questions' | 'chat'

export type FollowUpPreviewItem = {
  id: string
  name: string
  initials: string
  lane: FollowUpLane
  context: string
  badge: string
  headline: string
  detail: string
  nextAt: string | null
  lastAt: string | null
  progress: { completed: number; total: number; label: string } | null
  chatAppointmentId?: string
  actions: { label: string; kind: FollowUpPopupKind; primary?: boolean }[]
}

export type FollowUpPreviewBoard = {
  items: FollowUpPreviewItem[]
}

export type FollowUpPreviewResponse =
  | { enabled: true; board: FollowUpPreviewBoard }
  | { enabled: false }
