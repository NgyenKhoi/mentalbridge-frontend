import { resourceDetailHref } from './resource-route'

describe('resource detail route', () => {
  it('uses the registered absolute dynamic route and preserves catalogue state', () => {
    expect(
      resourceDetailHref(
        '00000000-0000-4000-8000-000000000205',
        '2026-10-08',
        'ARTICLE',
      ),
    ).toBe(
      '/resources/00000000-0000-4000-8000-000000000205?date=2026-10-08&category=ARTICLE',
    )
  })
})
