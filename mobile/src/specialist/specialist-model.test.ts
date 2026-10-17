import {
  availabilitySignature,
  localSlotToUtc,
  profileState,
  validateSpecialistProfileForm,
} from './specialist-model'
import { makeSpecialistProfile } from './specialist-test-fixtures'

describe('SPECIALIST mobile model', () => {
  it.each([
    [null, 'NEW'],
    [makeSpecialistProfile(), 'DRAFT'],
    [
      makeSpecialistProfile({ submittedAt: '2026-10-02T00:00:00.000Z' }),
      'PENDING_REVIEW',
    ],
    [makeSpecialistProfile({ approvalStatus: 'APPROVED' }), 'APPROVED'],
    [makeSpecialistProfile({ approvalStatus: 'REJECTED' }), 'REJECTED'],
    [makeSpecialistProfile({ approvalStatus: 'SUSPENDED' }), 'SUSPENDED'],
  ] as const)('maps the authoritative profile to %s', (profile, expected) => {
    expect(profileState(profile)).toBe(expected)
  })

  it('validates only the supported professional profile fields', () => {
    const valid = validateSpecialistProfileForm({
      displayName: 'Chuyên gia An',
      bio: 'Đồng hành an toàn.',
      supportAreas: ['ANXIETY_SYMPTOMS'],
      languages: ['vi', 'en'],
      yearsOfExperience: '5',
      timezone: 'Asia/Ho_Chi_Minh',
    })
    expect(valid).toEqual({
      success: true,
      value: {
        displayName: 'Chuyên gia An',
        bio: 'Đồng hành an toàn.',
        supportAreas: ['ANXIETY_SYMPTOMS'],
        languages: ['vi', 'en'],
        yearsOfExperience: 5,
        timezone: 'Asia/Ho_Chi_Minh',
      },
    })

    const invalid = validateSpecialistProfileForm({
      displayName: '',
      bio: '',
      supportAreas: [],
      languages: [],
      yearsOfExperience: '81',
      timezone: 'not-a-timezone',
    })
    expect(invalid.success).toBe(false)
    if (!invalid.success) {
      expect(Object.keys(invalid.errors).sort()).toEqual([
        'bio',
        'displayName',
        'languages',
        'supportAreas',
        'timezone',
        'yearsOfExperience',
      ])
    }
  })

  it('converts local time to an exact 60-minute UTC slot', () => {
    const range = localSlotToUtc('2030-10-15', '09:00', 'Asia/Ho_Chi_Minh')
    expect(range).toEqual({
      startAt: '2030-10-15T02:00:00.000Z',
      endAt: '2030-10-15T03:00:00.000Z',
    })
    expect(
      availabilitySignature({
        ...range,
        timezone: 'Asia/Ho_Chi_Minh',
        modality: 'IN_APP_CHAT',
      }),
    ).toBe(
      availabilitySignature({
        ...range,
        timezone: 'Asia/Ho_Chi_Minh',
        modality: 'IN_APP_CHAT',
      }),
    )
  })
})
