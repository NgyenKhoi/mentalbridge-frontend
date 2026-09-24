import type { components } from '@/contracts/content.generated'

export type PublicResourceDetail = components['schemas']['PublicResourceDetail']

export class ResourceBrowserError extends Error {
  constructor(readonly status: number) {
    super('Resource request failed')
    this.name = 'ResourceBrowserError'
  }
}

export async function getResourceDetail(
  resourceId: string,
  contentVersion?: string,
  signal?: AbortSignal,
): Promise<PublicResourceDetail> {
  const query = new URLSearchParams()
  if (contentVersion !== undefined) query.set('contentVersion', contentVersion)
  const suffix = query.size > 0 ? `?${query.toString()}` : ''
  const response = await fetch(
    `/api/resources/${encodeURIComponent(resourceId)}${suffix}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    },
  )
  if (!response.ok) throw new ResourceBrowserError(response.status)
  return (await response.json()) as PublicResourceDetail
}
