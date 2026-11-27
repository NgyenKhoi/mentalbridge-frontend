import type { components } from '@/contracts/content.generated'

export type ResourceJourney = components['schemas']['ResourceJourney']

export class ResourceJourneyBrowserError extends Error {
  constructor(readonly status: number) {
    super('Resource journey request failed')
    this.name = 'ResourceJourneyBrowserError'
  }
}

export async function getResourceJourney(
  localDate: string,
  timeZone: string,
  signal?: AbortSignal,
): Promise<ResourceJourney> {
  const query = new URLSearchParams({ date: localDate, timeZone })
  const response = await fetch(`/api/resources/journey?${query}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  })
  if (!response.ok) throw new ResourceJourneyBrowserError(response.status)
  return (await response.json()) as ResourceJourney
}
