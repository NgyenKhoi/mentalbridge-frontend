import { z } from 'zod'

export const SAFETY_DIRECTORY_BODY_LIMIT = 32 * 1024

const nullableBoundedText = (max: number) =>
  z.union([z.string().trim().min(1).max(max), z.null()])

const coverageSchema = z
  .object({
    level: z.enum(['NATIONWIDE', 'PROVINCE', 'DISTRICT']),
    provinceCode: nullableBoundedText(32),
    provinceName: nullableBoundedText(200),
    districtCode: nullableBoundedText(32),
    districtName: nullableBoundedText(200),
  })
  .strict()
  .superRefine((coverage, context) => {
    if (coverage.level === 'NATIONWIDE') {
      if (
        [
          coverage.provinceCode,
          coverage.provinceName,
          coverage.districtCode,
          coverage.districtName,
        ].some(Boolean)
      )
        context.addIssue({
          code: 'custom',
          message: 'Nationwide coverage cannot include local fields.',
        })
      return
    }
    if (!coverage.provinceCode || !coverage.provinceName)
      context.addIssue({
        code: 'custom',
        message: 'Province fields are required.',
      })
    if (
      coverage.level === 'PROVINCE' &&
      (coverage.districtCode || coverage.districtName)
    )
      context.addIssue({
        code: 'custom',
        message: 'Province coverage cannot include district fields.',
      })
    if (
      coverage.level === 'DISTRICT' &&
      (!coverage.districtCode || !coverage.districtName)
    )
      context.addIssue({
        code: 'custom',
        message: 'District fields are required.',
      })
  })

export const safetyDirectoryEntryWriteSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: z.enum(['FACILITY', 'HOTLINE']),
    phone: z.string().trim().min(1).max(64),
    address: z.union([z.string().trim().min(1).max(500), z.null()]),
    coverage: z.array(coverageSchema).min(1).max(100),
    sourceName: z.string().trim().min(1).max(200),
    sourceReference: z.string().trim().min(1).max(2000),
    sourceRetrievedAt: z.iso.datetime({ offset: true }),
    sourceChecksum: z
      .union([z.string().regex(/^[a-f0-9]{64}$/i), z.null()])
      .optional(),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.type === 'FACILITY' && !entry.address)
      context.addIssue({
        code: 'custom',
        path: ['address'],
        message: 'Facility address is required.',
      })
  })

export function safetyDirectoryVersion(searchParams: URLSearchParams) {
  const raw = searchParams.get('version')
  if (!raw || !/^\d+$/.test(raw)) return null
  const version = Number(raw)
  return Number.isSafeInteger(version) && version >= 0 ? version : null
}
