import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type Manifest = {
  catalogue: { atomicRows: number; aggregateRows: number }
  denominator: number
  numerator: number
  closurePercent: number
  counts: Record<string, number>
  evidenceClassifications: string[]
  snapshots: { backendDev: string; frontendDev: string }
}

type GapDrafts = { issues: Array<{ draftId: string; wbs: number[] }> }

function parseCsv(input: string): Record<string, string>[] {
  const records: string[][] = []
  let record: string[] = []
  let value = ''
  let quoted = false

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      record.push(value)
      value = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1
      record.push(value)
      value = ''
      if (record.some((cell) => cell.length > 0)) records.push(record)
      record = []
    } else {
      value += character
    }
  }

  expect(quoted).toBe(false)
  const [headers, ...rows] = records
  return rows.map((row) =>
    Object.fromEntries(
      headers.map((header, index) => [header, row[index] ?? '']),
    ),
  )
}

const reportRoot = resolve(process.cwd(), 'docs/reports/mb-624')
const manifest = JSON.parse(
  readFileSync(resolve(reportRoot, 'manifest-v1.json'), 'utf8'),
) as Manifest
const gapDrafts = JSON.parse(
  readFileSync(resolve(reportRoot, 'jira-gap-issue-drafts-v1.json'), 'utf8'),
) as GapDrafts
const rows = parseCsv(
  readFileSync(resolve(reportRoot, 'uc-traceability-v1.csv'), 'utf8'),
)

describe('MB-624 atomic UC traceability report', () => {
  it('uses one complete atomic denominator and keeps aggregate rows separate', () => {
    expect(manifest.catalogue.atomicRows).toBe(162)
    expect(manifest.catalogue.aggregateRows).toBe(7)
    expect(manifest.denominator).toBe(162)
    expect(rows).toHaveLength(162)

    expect(rows.map((row) => row.atomic_uc_id)).toEqual(
      Array.from(
        { length: 162 },
        (_, index) => `WBS-${String(index + 1).padStart(3, '0')}`,
      ),
    )
    expect(new Set(rows.map((row) => row.catalogue_row)).size).toBe(162)
  })

  it('reproduces the declared state counts and closure percentage', () => {
    const actualCounts = rows.reduce<Record<string, number>>((counts, row) => {
      counts[row.closure_state] = (counts[row.closure_state] ?? 0) + 1
      return counts
    }, {})

    expect(actualCounts).toEqual(manifest.counts)
    expect(manifest.numerator).toBe(actualCounts.CLOSED)
    expect(manifest.closurePercent).toBe(
      Number(((actualCounts.CLOSED / manifest.denominator) * 100).toFixed(2)),
    )
  })

  it('requires authoritative evidence and applicable channel coverage for closed rows', () => {
    for (const row of rows.filter(
      (candidate) => candidate.closure_state === 'CLOSED',
    )) {
      expect(row.authoritative_contract, row.atomic_uc_id).not.toMatch(
        /^(NONE|N\/A)/,
      )
      expect(row.backend_evidence, row.atomic_uc_id).not.toMatch(/^(NONE|N\/A)/)
      expect(row.evidence_classification, row.atomic_uc_id).toContain(
        'service-integration',
      )
      expect(row.web_coverage, row.atomic_uc_id).not.toMatch(/^(NONE|N\/A)/)
      if (row.mobile_applicability.startsWith('YES')) {
        expect(row.mobile_evidence, row.atomic_uc_id).not.toMatch(
          /^(NONE|N\/A)/,
        )
      }
    }
  })

  it('uses the approved evidence vocabulary without inventing live proof', () => {
    const allowed = new Set(manifest.evidenceClassifications)
    for (const row of rows) {
      for (const classification of row.evidence_classification.split('|')) {
        expect(allowed.has(classification), row.atomic_uc_id).toBe(true)
      }
    }

    expect(
      rows.some((row) =>
        row.evidence_classification.split('|').includes('live-cross-stack'),
      ),
    ).toBe(false)
  })

  it('pins backend links and resolves every referenced frontend evidence file', () => {
    for (const row of rows) {
      for (const field of ['authoritative_contract', 'backend_evidence']) {
        for (const reference of row[field]
          .split(';')
          .map((item) => item.trim())) {
          if (!reference.startsWith('https://github.com/')) continue
          expect(reference, row.atomic_uc_id).toContain(
            `/blob/${manifest.snapshots.backendDev}/`,
          )
        }
      }

      for (const field of ['web_coverage', 'mobile_evidence']) {
        for (const reference of row[field]
          .split(';')
          .map((item) => item.trim())) {
          if (!/^(mentalbridge|mobile)\//.test(reference)) continue
          expect(
            existsSync(resolve(process.cwd(), '..', reference)),
            reference,
          ).toBe(true)
        }
      }
    }
  })

  it('keeps unresolved gaps explicit and issue-ready', () => {
    for (const row of rows.filter(
      (candidate) => candidate.closure_state === 'GAP',
    )) {
      expect(row.jira_issues, row.atomic_uc_id).toContain('GAP-')
      expect(row.evidence_classification, row.atomic_uc_id).toBe('none')
      expect(row.stale_na_correction_or_blocker, row.atomic_uc_id).not.toBe('')
    }

    const draftById = new Map(
      gapDrafts.issues.map((issue) => [issue.draftId, issue.wbs]),
    )
    const referencedDraftIds = new Set<string>()
    for (const row of rows) {
      const wbs = Number(row.atomic_uc_id.slice(4))
      for (const draftId of row.jira_issues.match(/GAP-[A-Z-]+/g) ?? []) {
        referencedDraftIds.add(draftId)
        expect(
          draftById.get(draftId),
          `${row.atomic_uc_id} ${draftId}`,
        ).toContain(wbs)
      }
    }
    expect(referencedDraftIds).toEqual(new Set(draftById.keys()))
  })
})
