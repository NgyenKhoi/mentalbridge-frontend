import { useQuery } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { QueryProvider } from './query-provider'

function QueryConsumer() {
  const query = useQuery({
    queryKey: ['story-211-provider'],
    queryFn: async () => 'query-ready',
  })

  return <output>{query.data ?? 'query-loading'}</output>
}

describe('QueryProvider', () => {
  it('provides an isolated QueryClient to interactive descendants', async () => {
    render(
      <QueryProvider>
        <QueryConsumer />
      </QueryProvider>,
    )

    expect(await screen.findByText('query-ready')).toBeVisible()
  })
})
