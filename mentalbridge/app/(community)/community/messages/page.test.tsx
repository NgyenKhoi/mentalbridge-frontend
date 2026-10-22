import { describe, expect, it } from 'vitest'

import Page from './page'

describe('Community consent target navigation', () => {
  it('reloads the owned consent list when opening a different notification target', async () => {
    const firstId = '20000000-0000-4000-8000-000000000001'
    const secondId = '20000000-0000-4000-8000-000000000002'
    const first = await Page({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({ requestId: firstId }),
    })
    const second = await Page({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({ invitationId: secondId }),
    })
    expect(first.key).toBe(firstId)
    expect(second.key).toBe(secondId)
    expect(first.props.initialTab).toBe('requests')
    expect(second.props.initialTab).toBe('requests')
  })
  it('ignores malformed consent selectors', async () => {
    const result = await Page({
      params: Promise.resolve({}),
      searchParams: Promise.resolve({
        requestId: ['invalid'],
        invitationId: '../admin',
      }),
    })
    expect(result.key).toBe('conversations')
    expect(result.props.initialTab).toBe('conversations')
  })
})
