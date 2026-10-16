import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type Manifest = {
  catalogue: { atomicRows: number; aggregateRows: number }
  codeDelivery: {
    denominator: number
    numerator: number
    closurePercent: number
    counts: Record<string, number>
  }
  evidenceClassifications: string[]
  channelVerificationStates: string[]
  channelVerification: {
    web: {
      applicableDenominator: number
      counts: Record<string, number>
      stagingVerifiedNumerator: number
      stagingVerifiedPercent: number
    }
    mobile: {
      applicableDenominator: number
      counts: Record<string, number>
      stagingVerifiedNumerator: number
      stagingVerifiedPercent: number
    }
  }
  snapshots: { backendDev: string; frontendDev: string }
}

type JiraReconciliation = {
  snapshotDate: string
  reconciliations: Array<{
    jiraKey: string
    status: string
    resolution: 'EXISTING_OWNER' | 'CREATED_GAP_OWNER'
    wbs: number[]
    linkedToParent: boolean
  }>
}

type ExactEvidence = {
  reportVersion: number
  entries: Array<{
    atomicUcId: string
    sourceTitle: string
    web: EvidenceBinding
    mobile: EvidenceBinding
  }>
}

type EvidenceBinding = {
  state: string
  source?: string
  scenario?: string
  assertions?: string[]
  authority?: string
  rationale?: string
}

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
const jiraReconciliation = JSON.parse(
  readFileSync(resolve(reportRoot, 'jira-gap-reconciliation-v2.json'), 'utf8'),
) as JiraReconciliation
const exactEvidence = JSON.parse(
  readFileSync(resolve(reportRoot, 'uc-specific-evidence-v3.json'), 'utf8'),
) as ExactEvidence
const rows = parseCsv(
  readFileSync(resolve(reportRoot, 'uc-traceability-v1.csv'), 'utf8'),
)

describe('MB-624 atomic UC traceability report', () => {
  it('uses one complete atomic denominator and keeps aggregate rows separate', () => {
    expect(manifest.catalogue.atomicRows).toBe(162)
    expect(manifest.catalogue.aggregateRows).toBe(7)
    expect(manifest.codeDelivery.denominator).toBe(162)
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
      counts[row.implementation_closure_state] =
        (counts[row.implementation_closure_state] ?? 0) + 1
      return counts
    }, {})

    expect(actualCounts).toEqual(manifest.codeDelivery.counts)
    expect(manifest.codeDelivery.numerator).toBe(actualCounts.CLOSED)
    expect(manifest.codeDelivery.closurePercent).toBe(
      Number(
        (
          (actualCounts.CLOSED / manifest.codeDelivery.denominator) *
          100
        ).toFixed(2),
      ),
    )
  })

  it('requires authoritative evidence and applicable channel coverage for closed rows', () => {
    for (const row of rows.filter(
      (candidate) => candidate.implementation_closure_state === 'CLOSED',
    )) {
      expect(row.authoritative_contract, row.atomic_uc_id).not.toMatch(
        /^(NONE|N\/A)/,
      )
      expect(row.backend_evidence, row.atomic_uc_id).not.toMatch(/^(NONE|N\/A)/)
      expect(row.evidence_classification, row.atomic_uc_id).toContain(
        'service-integration',
      )
      expect(row.web_coverage, row.atomic_uc_id).not.toMatch(/^(NONE|N\/A)/)
      expect(row.web_verification_state, row.atomic_uc_id).toMatch(
        /^(CODE_READY|STAGING_VERIFIED)$/,
      )
      if (row.mobile_applicability.startsWith('YES')) {
        expect(row.mobile_evidence, row.atomic_uc_id).not.toMatch(
          /^(NONE|N\/A)/,
        )
        expect(row.mobile_verification_state, row.atomic_uc_id).toMatch(
          /^(CODE_READY|E2E_AUTHORED_NOT_RUN|STAGING_VERIFIED)$/,
        )
      }
    }
  })

  it('keeps Web and Mobile verification stages explicit and fail-closed', () => {
    const allowed = new Set(manifest.channelVerificationStates)
    const channelCounts = {
      web: {} as Record<string, number>,
      mobile: {} as Record<string, number>,
    }

    for (const row of rows) {
      for (const channel of ['web', 'mobile'] as const) {
        const state = row[`${channel}_verification_state`]
        const reference = row[`${channel}_verification_reference`]
        expect(allowed.has(state), `${row.atomic_uc_id} ${channel}`).toBe(true)
        expect(reference, `${row.atomic_uc_id} ${channel}`).not.toBe('')
        channelCounts[channel][state] = (channelCounts[channel][state] ?? 0) + 1

        if (state === 'E2E_AUTHORED_NOT_RUN') {
          expect(reference, `${row.atomic_uc_id} ${channel}`).toContain(
            'mobile/.maestro/',
          )
          expect(reference, `${row.atomic_uc_id} ${channel}`).toContain(
            'not run',
          )
        }
        if (state === 'NONE') {
          expect(reference, `${row.atomic_uc_id} ${channel}`).toMatch(
            /no (?:exact |code-ready )?(?:code-ready )?(?:web |mobile )?(?:evidence|scenario)/i,
          )
        }
      }

      if (row.mobile_applicability.startsWith('YES')) {
        expect(row.mobile_verification_state, row.atomic_uc_id).not.toBe(
          'NOT_APPLICABLE',
        )
      } else {
        expect(row.mobile_verification_state, row.atomic_uc_id).toBe(
          'NOT_APPLICABLE',
        )
      }
    }

    expect(channelCounts.web).toEqual(manifest.channelVerification.web.counts)
    expect(channelCounts.mobile).toEqual(
      manifest.channelVerification.mobile.counts,
    )
    expect(manifest.channelVerification.web.applicableDenominator).toBe(
      rows.filter((row) => row.web_verification_state !== 'NOT_APPLICABLE')
        .length,
    )
    expect(manifest.channelVerification.mobile.applicableDenominator).toBe(
      rows.filter((row) => row.mobile_verification_state !== 'NOT_APPLICABLE')
        .length,
    )
    expect(manifest.channelVerification.web.stagingVerifiedNumerator).toBe(0)
    expect(manifest.channelVerification.mobile.stagingVerifiedNumerator).toBe(0)
    expect(manifest.channelVerification.web.stagingVerifiedPercent).toBe(0)
    expect(manifest.channelVerification.mobile.stagingVerifiedPercent).toBe(0)
    expect(
      rows.some((row) => row.web_verification_state === 'STAGING_VERIFIED'),
    ).toBe(false)
    expect(
      rows.some((row) => row.mobile_verification_state === 'STAGING_VERIFIED'),
    ).toBe(false)
  })

  it('binds every client claim to an exact scenario and rejects adjacent-feature evidence', () => {
    expect(exactEvidence.reportVersion).toBe(3)
    expect(exactEvidence.entries).toHaveLength(162)

    const byId = new Map(
      exactEvidence.entries.map((entry) => [entry.atomicUcId, entry]),
    )
    for (const row of rows) {
      const entry = byId.get(row.atomic_uc_id)
      expect(entry, row.atomic_uc_id).toBeDefined()
      expect(entry?.sourceTitle).toBe(row.source_title)

      for (const channel of ['web', 'mobile'] as const) {
        const binding = entry?.[channel]
        const state = row[`${channel}_verification_state`]
        expect(binding?.state, `${row.atomic_uc_id} ${channel}`).toBe(state)

        if (/^(CODE_READY|E2E_AUTHORED_NOT_RUN)$/.test(state)) {
          expect(binding?.source, `${row.atomic_uc_id} ${channel}`).toMatch(
            new RegExp(`^${channel === 'web' ? 'mentalbridge' : 'mobile'}/`),
          )
          expect(binding?.scenario, `${row.atomic_uc_id} ${channel}`).not.toBe(
            '',
          )
          const source = resolve(process.cwd(), '..', binding!.source!)
          expect(existsSync(source), binding?.source).toBe(true)
          const sourceText = readFileSync(source, 'utf8')
          expect(
            sourceText,
            `${row.atomic_uc_id} ${binding?.source}`,
          ).toContain(binding!.scenario!)
          for (const assertion of binding?.assertions ?? []) {
            expect(
              sourceText,
              `${row.atomic_uc_id} ${binding?.source} assertion ${assertion}`,
            ).toContain(assertion)
          }
          if (state === 'E2E_AUTHORED_NOT_RUN') {
            expect(binding?.source, row.atomic_uc_id).toMatch(
              /^mobile\/\.maestro\/[^/]+\.yaml$/,
            )
            expect(
              binding?.assertions?.length,
              row.atomic_uc_id,
            ).toBeGreaterThan(0)
          }
        } else {
          expect(
            binding?.rationale ?? binding?.authority,
            `${row.atomic_uc_id} ${channel}`,
          ).toBeTruthy()
        }
      }
    }

    const mobile = (number: number) =>
      byId.get(`WBS-${String(number).padStart(3, '0')}`)!.mobile
    const web = (number: number) =>
      byId.get(`WBS-${String(number).padStart(3, '0')}`)!.web

    expect(mobile(2).state).toBe('NOT_APPLICABLE')
    expect(mobile(2).authority).toContain('MB-607_AUTH_SESSION.md')
    expect(mobile(5).state).toBe('NOT_APPLICABLE')
    expect(mobile(6).state).toBe('NOT_APPLICABLE')
    expect(web(49).state).toBe('NONE')
    expect(web(80).state).toBe('NONE')
    expect(mobile(80).state).toBe('NONE')
    expect(web(82).state).toBe('NONE')
    expect(mobile(82).state).toBe('NONE')

    for (const number of [2, 5, 6, 49, 80, 82]) {
      const binding = mobile(number)
      expect(binding.source ?? '').not.toMatch(/mb-612-assessment|mb-631-chat/)
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
          .map((item) => item.trim().split(' :: ')[0])) {
          if (!reference.startsWith('https://github.com/')) continue
          expect(reference, row.atomic_uc_id).toContain(
            `/blob/${manifest.snapshots.backendDev}/`,
          )
        }
      }

      for (const field of [
        'web_coverage',
        'web_verification_reference',
        'mobile_evidence',
        'mobile_verification_reference',
      ]) {
        for (const reference of row[field]
          .split(';')
          .map((item) => item.trim().split(' :: ')[0])) {
          if (!/^(mentalbridge|mobile)\//.test(reference)) continue
          expect(
            existsSync(resolve(process.cwd(), '..', reference)),
            reference,
          ).toBe(true)
        }
      }
    }
  })

  it('binds every open gap to a real reconciled Jira owner and status', () => {
    expect(jiraReconciliation.snapshotDate).toBe('2026-10-16')
    const reconciledByKey = new Map(
      jiraReconciliation.reconciliations.map((issue) => [issue.jiraKey, issue]),
    )

    expect(
      jiraReconciliation.reconciliations.filter(
        (issue) => issue.resolution === 'CREATED_GAP_OWNER',
      ),
    ).toHaveLength(6)

    for (const issue of jiraReconciliation.reconciliations) {
      expect(issue.jiraKey).toMatch(/^MB-[0-9]+$/)
      expect(issue.status).toMatch(/^(To Do|In Review)$/)
      expect(issue.linkedToParent).toBe(true)
      for (const wbs of issue.wbs) {
        const row = rows[wbs - 1]
        expect(row.atomic_uc_id).toBe(`WBS-${String(wbs).padStart(3, '0')}`)
        expect(row.jira_issues, row.atomic_uc_id).toContain(issue.jiraKey)
        expect(row.jira_delivery_state, row.atomic_uc_id).toContain(
          `${issue.jiraKey}=${issue.status}`,
        )
      }
    }

    for (const row of rows) {
      expect(row.jira_issues, row.atomic_uc_id).not.toContain('GAP-')
      expect(row.jira_delivery_state, row.atomic_uc_id).not.toContain(
        'confirm live status',
      )
      for (const key of row.jira_issues.match(/MB-[0-9]+/g) ?? []) {
        expect(row.jira_delivery_state, row.atomic_uc_id).toContain(`${key}=`)
      }
    }

    for (const row of rows.filter(
      (candidate) => candidate.implementation_closure_state === 'GAP',
    )) {
      const keys = row.jira_issues.match(/MB-[0-9]+/g) ?? []
      expect(keys.length, row.atomic_uc_id).toBeGreaterThan(0)
      expect(
        keys.some((key) => reconciledByKey.has(key)),
        row.atomic_uc_id,
      ).toBe(true)
      expect(row.evidence_classification, row.atomic_uc_id).toBe('none')
      expect(row.stale_na_correction_or_blocker, row.atomic_uc_id).not.toBe('')
    }
  })
})
