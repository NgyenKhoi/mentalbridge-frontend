import type { VideoAccess } from './video-contract'

export type VideoMediaProps = Readonly<{
  access: VideoAccess | null
  previewAllowed: boolean
  onLeave: () => void
  onError: () => void
  role?: 'USER' | 'SPECIALIST' | undefined
  startsAt?: string | undefined
}>
