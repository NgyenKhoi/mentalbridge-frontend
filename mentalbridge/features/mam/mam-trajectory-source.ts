// What the trajectory and the cheer gate need from Care, and nothing more (MB-897). Built from the look-back
// composition with no conversations, so no text of the user's own ever reaches Mầm's code path.
import type { LookBack } from '@/features/look-back/look-back-model'

export type MamBandStatus = Readonly<{
  /** Care's screening history and progress were both read. */
  readable: boolean
  /** A current band of moderate or higher on any screening in the window. */
  moderatePlus: boolean
  /** The last band transition in the window; null with nothing to compare. */
  transition: 'LOWER' | 'SAME' | 'HIGHER' | null
}>

export type MamTrajectoryView = Readonly<{
  asOfLocalDate: string
  days: ReadonlyArray<
    Readonly<{ localDate: string; emotionLevel: number | null }>
  >
  narrative: LookBack['narrative']
  band: MamBandStatus
  partial: boolean
}>

/** `degraded`: the history or a progress read failed (the look-back's own flag, without the companion). */
export function toMamTrajectoryView(
  lookBack: LookBack,
  degraded: boolean,
): MamTrajectoryView {
  const directions = lookBack.screening.map((item) => item.direction)
  return {
    asOfLocalDate: lookBack.asOfLocalDate,
    days: lookBack.days.map(({ localDate, emotionLevel }) => ({
      localDate,
      emotionLevel,
    })),
    narrative: lookBack.narrative,
    band: {
      readable: !degraded,
      moderatePlus: lookBack.professionalPointer,
      transition: directions.includes('HIGHER')
        ? 'HIGHER'
        : directions.includes('LOWER')
          ? 'LOWER'
          : directions.length
            ? 'SAME'
            : null,
    },
    partial: lookBack.partial,
  }
}

/**
 * Cheering needs a readable mood, a readable band, no moderate-or-higher band and nothing missing from the
 * data: a band that failed to load must never read as "no band".
 */
export const mamCheerable = (view: MamTrajectoryView) =>
  view.narrative !== 'HARDER' &&
  view.narrative !== 'UNKNOWN' &&
  view.band.readable &&
  !view.band.moderatePlus &&
  !view.partial
