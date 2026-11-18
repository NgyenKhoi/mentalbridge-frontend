import { describe, expect, it } from 'vitest'
import {
  parseSafetyDirectoryAdminEntries,
  parseSafetyDirectoryAdminEntry,
} from './content-validation'
import { safetyDirectoryEntryWriteSchema } from './safety-directory-admin-input'

const entry = {
  directoryEntryId: '123e4567-e89b-42d3-a456-426614174000',
  name: 'Đường dây hỗ trợ',
  type: 'HOTLINE',
  phone: '111',
  address: null,
  coverage: [
    {
      level: 'NATIONWIDE',
      provinceCode: null,
      provinceName: null,
      districtCode: null,
      districtName: null,
    },
  ],
  sourceName: 'Cơ quan có thẩm quyền',
  sourceReference: 'https://example.test/source',
  reviewedAt: '2026-11-10T00:00:00Z',
  verifiedAt: '2026-11-10T00:00:00Z',
  recordVersion: 4,
  active: true,
  reviewState: 'CURRENT',
  reviewedBy: '123e4567-e89b-42d3-a456-426614174001',
  verifiedBy: '123e4567-e89b-42d3-a456-426614174002',
  sourceRetrievedAt: '2026-11-09T00:00:00Z',
  sourceChecksum: null,
  seedKey: null,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-10T00:00:00Z',
} as const

describe('safety directory contract validation', () => {
  it('accepts complete authoritative records and rejects partial provenance', () => {
    expect(parseSafetyDirectoryAdminEntry(entry)).toEqual(entry)
    expect(parseSafetyDirectoryAdminEntries([entry])).toEqual([entry])
    expect(
      parseSafetyDirectoryAdminEntry({ ...entry, sourceRetrievedAt: null }),
    ).toBeNull()
  })

  it('fails closed for invalid coverage and facility metadata', () => {
    const common = {
      name: 'Trung tâm hỗ trợ',
      type: 'FACILITY' as const,
      phone: '0123',
      address: null,
      sourceName: 'Nguồn',
      sourceReference: 'Hồ sơ 1',
      sourceRetrievedAt: '2026-11-10T00:00:00Z',
    }
    expect(
      safetyDirectoryEntryWriteSchema.safeParse({
        ...common,
        coverage: [
          {
            level: 'DISTRICT',
            provinceCode: '79',
            provinceName: 'TP.HCM',
            districtCode: null,
            districtName: null,
          },
        ],
      }).success,
    ).toBe(false)
    expect(
      safetyDirectoryEntryWriteSchema.safeParse({
        ...common,
        address: '1 Đường A',
        coverage: [
          {
            level: 'NATIONWIDE',
            provinceCode: null,
            provinceName: null,
            districtCode: null,
            districtName: null,
          },
        ],
      }).success,
    ).toBe(true)
  })
})
