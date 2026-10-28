import type { MamIntent } from './mam-targets'

// A page control (the Mầm button on a card) asks the one global host to open
// its bubble at the card the control sits in. The host ignores it while hidden
// or suppressed, and when the control is not inside a registered target.
export const MAM_SUMMON_EVENT = 'mam:summon'

export type MamSummonRequest = Readonly<{
  source: HTMLElement
  intent: MamIntent
}>

export const requestMamSummon = (source: HTMLElement, intent: MamIntent) =>
  window.dispatchEvent(
    new CustomEvent<MamSummonRequest>(MAM_SUMMON_EVENT, {
      detail: { source, intent },
    }),
  )
