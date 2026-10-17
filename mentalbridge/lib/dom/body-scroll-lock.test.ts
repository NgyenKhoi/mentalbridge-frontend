import { afterEach, describe, expect, it } from 'vitest'

import { lockBodyScroll } from './body-scroll-lock'

describe('lockBodyScroll', () => {
  afterEach(() => {
    document.body.style.removeProperty('overflow')
  })

  it('restores the original overflow after the final lock is released', () => {
    document.body.style.overflow = 'auto'
    const releaseFirst = lockBodyScroll()
    const releaseSecond = lockBodyScroll()

    releaseFirst()
    expect(document.body.style.overflow).toBe('hidden')

    releaseSecond()
    expect(document.body.style.overflow).toBe('auto')
  })

  it('allows a lock to be released more than once safely', () => {
    const release = lockBodyScroll()

    release()
    release()

    expect(document.body.style.overflow).toBe('')
  })
})
