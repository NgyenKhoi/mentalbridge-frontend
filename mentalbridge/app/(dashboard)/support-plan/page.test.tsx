import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import type SupportPlanWorkspace from '@/features/support-plan/workspace/SupportPlanWorkspace'
vi.mock('@/features/support-plan/workspace/SupportPlanWorkspace', () => ({
  default: (props: ComponentProps<typeof SupportPlanWorkspace>) => (
    <pre data-testid="workspace">{JSON.stringify(props)}</pre>
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
  return JSON.parse(screen.getByTestId('workspace').textContent ?? '{}')
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
      returnOrigin: {
        source: 'journal',
        kind: 'journal',
        ...fields,
        journalId: '70000000-0000-4000-8000-000000000642',
      },
    })
  })
  it('passes a Resource return as its own origin', async () => {
    expect(await propsFor({ source: 'resource', ...fields })).toEqual({
      returnOrigin: { kind: 'resource', ...fields },
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
    {
      source: 'resource',
      ...fields,
      journalId: '70000000-0000-4000-8000-000000000642',
    },
    { source: ['resource', 'resource'], ...fields },
    { ...fields, occurrenceId: 'not-a-uuid' },
  ])(
    'shows recovery instead of rerouting an invalid origin %j',
    async (query) => {
      expect(await propsFor(query)).toEqual({ invalidOrigin: true })
    },
  )
  it('preserves the existing Emotion route without a discriminator', async () => {
    expect(await propsFor(fields)).toEqual({
      returnOrigin: { kind: 'emotion', ...fields },
    })
  })
  it('opens plainly without return parameters', async () => {
    expect(await propsFor({})).toEqual({})
  })
})
