import { describe, expect, it } from 'vitest'
import { suggestionLink } from './suggestion-link'

const none = { resourceId: null, resourceTitle: null }

describe('suggestionLink', () => {
  it('maps each destination to a web-owned route and label', () => {
    expect(
      suggestionLink({
        destination: 'RESOURCE',
        resourceId: '44444444-4444-4444-8444-444444444444',
        resourceTitle: 'Thở 4-7-8',
      }),
    ).toEqual({
      href: '/resources/44444444-4444-4444-8444-444444444444?from=ai-companion',
      label: 'Mở bài: Thở 4-7-8',
    })
    expect(
      suggestionLink({ destination: 'RESOURCE_LIBRARY', ...none }),
    ).toEqual({ href: '/resources', label: 'Mở Thư viện tài nguyên' })
    expect(suggestionLink({ destination: 'JOURNAL', ...none })).toEqual({
      href: '/journal',
      label: 'Mở Nhật ký',
    })
    expect(
      suggestionLink({ destination: 'EMOTION_CHECK_IN', ...none }),
    ).toEqual({
      href: '/dashboard#emotion-check-in',
      label: 'Mở Check-in cảm xúc',
    })
    expect(suggestionLink({ destination: 'SUPPORT_PLAN', ...none })).toEqual({
      href: '/support-plan',
      label: 'Mở Kế hoạch hỗ trợ',
    })
    expect(
      suggestionLink({ destination: 'SPECIALIST_DISCOVERY', ...none }),
    ).toEqual({ href: '/specialists', label: 'Tìm chuyên gia' })
  })

  it('renders nothing for an unknown destination or a resource without id', () => {
    expect(
      suggestionLink({
        destination: 'SETTINGS' as 'JOURNAL',
        ...none,
      }),
    ).toBeNull()
    expect(suggestionLink({ destination: 'RESOURCE', ...none })).toBeNull()
    expect(suggestionLink(null)).toBeNull()
    expect(suggestionLink(undefined)).toBeNull()
  })

  it('encodes the resource id into the path', () => {
    expect(
      suggestionLink({
        destination: 'RESOURCE',
        resourceId: '../admin',
        resourceTitle: 'x',
      })?.href,
    ).toBe('/resources/..%2Fadmin?from=ai-companion')
  })
})
