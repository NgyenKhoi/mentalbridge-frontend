import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllCompanionDrafts,
  clearCompanionDraft,
  clearCompanionPending,
  readCompanionDraft,
  readCompanionPending,
  writeCompanionDraft,
  writeCompanionPending,
} from './companion-draft-storage'

describe('companion draft storage', () => {
  beforeEach(() => window.sessionStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('keeps a draft per account and conversation in sessionStorage only', () => {
    writeCompanionDraft('acc-a', 'conv-1', 'Bản nháp A')
    expect(
      window.sessionStorage.getItem('mb.companion.draft.acc-a.conv-1'),
    ).toBe('Bản nháp A')
    expect(window.localStorage.length).toBe(0)
    expect(readCompanionDraft('acc-a', 'conv-1')).toBe('Bản nháp A')
    expect(readCompanionDraft('acc-b', 'conv-1')).toBe('')
    expect(readCompanionDraft('acc-a', 'conv-2')).toBe('')
  })

  it('removes the key for an empty or blank draft', () => {
    writeCompanionDraft('acc-a', 'conv-1', 'x')
    writeCompanionDraft('acc-a', 'conv-1', '')
    expect(window.sessionStorage.length).toBe(0)
    writeCompanionDraft('acc-a', 'conv-1', 'x')
    writeCompanionDraft('acc-a', 'conv-1', '   ')
    expect(window.sessionStorage.length).toBe(0)
    writeCompanionDraft('acc-a', 'conv-1', 'x')
    clearCompanionDraft('acc-a', 'conv-1')
    expect(window.sessionStorage.length).toBe(0)
  })

  it('clears every companion draft on logout and nothing else', () => {
    writeCompanionDraft('acc-a', 'conv-1', 'a')
    writeCompanionDraft('acc-b', 'conv-2', 'b')
    writeCompanionPending('acc-a', 'conv-1', { key: 'k1', text: 'a' })
    writeCompanionPending('acc-b', 'conv-2', { key: 'k2', text: 'b' })
    window.sessionStorage.setItem('other.key', 'keep')
    clearAllCompanionDrafts()
    expect(window.sessionStorage.length).toBe(1)
    expect(window.sessionStorage.getItem('other.key')).toBe('keep')
  })

  it('keeps a pending command per account and conversation', () => {
    writeCompanionPending('acc-a', 'conv-1', { key: 'k1', text: 'Tin A' })
    writeCompanionPending('acc-a', 'conv-2', { key: 'k2', text: 'Tin B' })
    expect(readCompanionPending('acc-a', 'conv-1')).toEqual({
      key: 'k1',
      text: 'Tin A',
    })
    expect(readCompanionPending('acc-a', 'conv-2')?.key).toBe('k2')
    expect(readCompanionPending('acc-b', 'conv-1')).toBeNull()
    expect(window.localStorage.length).toBe(0)
    clearCompanionPending('acc-a', 'conv-1')
    expect(readCompanionPending('acc-a', 'conv-1')).toBeNull()
    expect(readCompanionPending('acc-a', 'conv-2')).not.toBeNull()
  })

  it('ignores a malformed stored pending command', () => {
    window.sessionStorage.setItem('mb.companion.pending.acc-a.conv-1', '{oops')
    expect(readCompanionPending('acc-a', 'conv-1')).toBeNull()
    window.sessionStorage.setItem(
      'mb.companion.pending.acc-a.conv-1',
      JSON.stringify({ key: 1 }),
    )
    expect(readCompanionPending('acc-a', 'conv-1')).toBeNull()
  })

  it('never throws when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readCompanionDraft('a', 'c')).toBe('')
    expect(() => writeCompanionDraft('a', 'c', 'x')).not.toThrow()
    expect(() => writeCompanionDraft('a', 'c', '')).not.toThrow()
    expect(readCompanionPending('a', 'c')).toBeNull()
    expect(() =>
      writeCompanionPending('a', 'c', { key: 'k', text: 'x' }),
    ).not.toThrow()
    expect(() => clearCompanionPending('a', 'c')).not.toThrow()
    expect(() => clearAllCompanionDrafts()).not.toThrow()
  })
})
