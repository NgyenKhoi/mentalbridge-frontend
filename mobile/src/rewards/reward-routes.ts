import type { paths as ContentProviderPaths } from '../../../mentalbridge/contracts/content.generated'

type HttpMethod = 'delete' | 'get' | 'put'
type ProviderPathFor<Method extends HttpMethod> = {
  [Path in keyof ContentProviderPaths]: NonNullable<
    ContentProviderPaths[Path][Method]
  > extends never
    ? never
    : Path
}[keyof ContentProviderPaths]

function providerRoute<
  Method extends HttpMethod,
  Path extends ProviderPathFor<Method>,
>(method: Method, path: Path) {
  return { method, path } as const
}

// These literals are compile-time checked against Content's generated OpenAPI
// contract. A provider path or HTTP method drift therefore fails typecheck.
export const contentOwnerRoutes = {
  achievements: providerRoute('get', '/api/v1/achievements'),
  achievementPreference: providerRoute(
    'put',
    '/api/v1/achievements/preference',
  ),
  resourceRewards: providerRoute('get', '/api/v1/resource-rewards'),
  resourceRewardPreference: providerRoute('put', '/api/v1/resource-rewards'),
  resourceBookmarks: providerRoute('get', '/api/v1/resource-bookmarks'),
  resourceBookmark: providerRoute(
    'put',
    '/api/v1/resource-bookmarks/{resourceId}',
  ),
  deleteResourceBookmark: providerRoute(
    'delete',
    '/api/v1/resource-bookmarks/{resourceId}',
  ),
  resourceBingo: providerRoute('get', '/api/v1/resource-bingo/{weekStart}'),
  resourceBingoPlanSync: providerRoute(
    'put',
    '/api/v1/resource-bingo/{weekStart}/plan-sync',
  ),
  resourceBingoSelfConfirmation: providerRoute(
    'put',
    '/api/v1/resource-bingo/{weekStart}/items/{position}/self-confirmation',
  ),
} as const

export function fillProviderRoute(
  template: string,
  parameters: Readonly<Record<string, string | number>>,
) {
  return Object.entries(parameters).reduce(
    (path, [name, value]) =>
      path.replace(`{${name}}`, encodeURIComponent(String(value))),
    template,
  )
}
