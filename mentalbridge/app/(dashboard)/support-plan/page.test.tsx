import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import type SupportPlanEntry from '@/features/support-plan/components/SupportPlanEntry'
vi.mock('@/features/support-plan/components/SupportPlanEntry', () => ({
  default: (props: ComponentProps<typeof SupportPlanEntry>) => (
    <pre data-testid="entry">{JSON.stringify(props)}</pre>
  ),
}))
import SupportPlanPage from './page'
const fields = {
  occurrenceId: '30000000-0000-4000-8000-000000000642',
  actionId: '20000000-0000-4000-8000-000000000642',
  localDate: '2026-10-14',
}
async function propsFor(query: Record<string, string | string[]>) {
  render(
    await SupportPlanPage({
      params: Promise.resolve({}),
      searchParams: Promise.resolve(query),
    }),
  )
  return JSON.parse(screen.getByTestId('entry').textContent ?? '{}')
}
describe('SupportPlan return route discrimination', () => {
  it('passes Journal origin separately and never as an Emotion origin', async () => {
    expect(
      await propsFor({
        source: 'journal',
        ...fields,
        journalId: '70000000-0000-4000-8000-000000000642',
      }),
    ).toEqual({
      journalOrigin: {
        source: 'journal',
        ...fields,
        journalId: '70000000-0000-4000-8000-000000000642',
      },
    })
  })
  it.each([
    { source: ['journal', 'journal'], ...fields },
    {
      source: 'journal',
      ...fields,
      occurrenceId: [fields.occurrenceId, fields.occurrenceId],
    },
    {
      source: 'journal',
      ...fields,
      journalId: [
        '70000000-0000-4000-8000-000000000642',
        '70000000-0000-4000-8000-000000000642',
      ],
    },
    { source: 'unknown', ...fields },
    { ...fields, journalId: '70000000-0000-4000-8000-000000000642' },
  ])(
    'shows recovery instead of rerouting an invalid Journal origin %j',
    async (query) => {
      expect(await propsFor(query)).toEqual({ invalidJournalOrigin: true })
    },
  )
  it('preserves the existing Emotion route without a Journal discriminator', async () => {
    expect(await propsFor(fields)).toEqual({ origin: fields })
  })
})
