import {
  isMamLoopingBehavior,
  isMamOneShot,
  MAM_BEHAVIORS,
  MAM_VIEW_MODEL,
  type MamBehavior,
  type MamLoopingBehavior,
  type MamOneShot,
} from './mam-contract'

/** The slice of a Rive `ViewModelInstance` the adapter needs. */
export interface MamViewModelPort {
  enum(path: string): {
    value: string
    on(callback: () => void): void
    off(callback?: () => void): void
  } | null
  number(path: string): { value: number } | null
  boolean(path: string): { value: boolean } | null
  trigger(path: string): { trigger(): void } | null
}

export interface MamControlsSnapshot {
  behavior: MamBehavior
  attention: number
  reducedMotion: boolean
  visible: boolean
}

export interface MamControls {
  setBehavior(behavior: MamLoopingBehavior): void
  setAttention(direction: number): void
  setReducedMotion(reduced: boolean): void
  setVisible(visible: boolean): void
  /** Starts a one-shot. Refused (false) while hidden or in reduced motion. */
  playOnce(kind: MamOneShot): boolean
  returnToDock(): void
  /** Reads back from the asset: one-shots rewrite `behaviorState` themselves. */
  read(): MamControlsSnapshot
  /** Notifies on every `behaviorState` change, including the asset's own writes. */
  onBehaviorChange(listener: () => void): () => void
}

export class MamContractError extends Error {
  constructor(property: string) {
    super(`Mầm asset is missing view-model property "${property}".`)
    this.name = 'MamContractError'
  }
}

function required<T>(value: T | null, property: string): T {
  if (value === null) throw new MamContractError(property)
  return value
}

const clampAttention = (direction: number) =>
  Number.isFinite(direction) ? Math.min(1, Math.max(-1, direction)) : 0

/** Binds the frozen `MamControls` view model; throws if the asset does not match. */
export function createMamControls(viewModel: MamViewModelPort): MamControls {
  const vm = MAM_VIEW_MODEL
  const behavior = required(viewModel.enum(vm.behavior), vm.behavior)
  const attention = required(viewModel.number(vm.attention), vm.attention)
  const tier = required(viewModel.enum(vm.tier), vm.tier)
  const play = required(viewModel.trigger(vm.playOnce), vm.playOnce)
  const dock = required(viewModel.trigger(vm.returnToDock), vm.returnToDock)
  const reduced = required(
    viewModel.boolean(vm.reducedMotion),
    vm.reducedMotion,
  )
  const visible = required(viewModel.boolean(vm.visible), vm.visible)

  return {
    setBehavior(next) {
      // Guards callers that bypass the type; one-shots never start from a plain set.
      if (!isMamLoopingBehavior(next)) return
      behavior.value = next
    },
    setAttention(direction) {
      attention.value = clampAttention(direction)
    },
    setReducedMotion(next) {
      reduced.value = next
    },
    setVisible(next) {
      visible.value = next
    },
    playOnce(kind) {
      if (!isMamOneShot(kind) || !visible.value || reduced.value) return false
      tier.value = 'none'
      behavior.value = kind
      play.trigger()
      return true
    },
    returnToDock() {
      dock.trigger()
    },
    read() {
      const current = behavior.value
      return {
        behavior: (MAM_BEHAVIORS as readonly string[]).includes(current)
          ? (current as MamBehavior)
          : 'idle',
        attention: attention.value,
        reducedMotion: reduced.value,
        visible: visible.value,
      }
    },
    onBehaviorChange(listener) {
      behavior.on(listener)
      return () => behavior.off(listener)
    },
  }
}
