import { browserApiClient } from '@/lib/api/browser-client'
import {
  parseVideoSession,
  parseVideoAccess,
  parseVideoCompletion,
} from '@/lib/consultation/video-validation'

export const videoBrowserClient = {
  async session(appointmentId: string) {
    const { data } = await browserApiClient.get(
      `/consultation/appointments/${encodeURIComponent(appointmentId)}/video-session`,
    )
    const parsed = parseVideoSession(data)
    if (!parsed || parsed.appointmentId !== appointmentId)
      throw new Error('Video session unavailable.')
    return parsed
  },
  async access(appointmentId: string) {
    const { data } = await browserApiClient.post(
      `/consultation/appointments/${encodeURIComponent(appointmentId)}/video-access`,
    )
    const parsed = parseVideoAccess(data)
    if (!parsed || parsed.appointmentId !== appointmentId)
      throw new Error('Video access unavailable.')
    return parsed
  },
  async complete(appointmentId: string, version: number, key: string) {
    const { data } = await browserApiClient.post(
      `/consultation/specialist/appointments/${encodeURIComponent(appointmentId)}/video-completion`,
      { confirmation: 'CONSULTATION_FINISHED' },
      { headers: { 'If-Match': `"${version}"`, 'Idempotency-Key': key } },
    )
    const parsed = parseVideoCompletion(data)
    if (!parsed || parsed.appointmentId !== appointmentId)
      throw new Error('Video confirmation unavailable.')
    return parsed
  },
}
