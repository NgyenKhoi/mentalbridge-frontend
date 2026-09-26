type ScrollLockState = {
  activeLocks: number
  previousOverflow: string
}

const scrollLockStates = new WeakMap<Document, ScrollLockState>()

export function lockBodyScroll(ownerDocument: Document = document) {
  const existingState = scrollLockStates.get(ownerDocument)
  const state =
    existingState ??
    ({
      activeLocks: 0,
      previousOverflow: ownerDocument.body.style.overflow,
    } satisfies ScrollLockState)

  if (!existingState) {
    scrollLockStates.set(ownerDocument, state)
    ownerDocument.body.style.overflow = 'hidden'
  }

  state.activeLocks += 1
  let released = false

  return () => {
    if (released) return
    released = true
    state.activeLocks -= 1

    if (state.activeLocks > 0) return

    ownerDocument.body.style.overflow = state.previousOverflow
    scrollLockStates.delete(ownerDocument)
  }
}
