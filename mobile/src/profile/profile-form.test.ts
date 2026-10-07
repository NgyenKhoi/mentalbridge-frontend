import { profileErrorsFromProblem, validateProfileForm } from './profile-form'

describe('profile form validation', () => {
  it('normalizes supported fields without deriving age from the device clock', () => {
    expect(
      validateProfileForm({
        displayName: '  Nguyễn An  ',
        dateOfBirth: '2008-02-29',
        gender: ' female ',
      }),
    ).toEqual({
      success: true,
      value: {
        displayName: 'Nguyễn An',
        dateOfBirth: '2008-02-29',
        gender: 'female',
      },
    })
  })

  it('rejects malformed local input and maps server-owned age rules', () => {
    expect(
      validateProfileForm({
        displayName: ' ',
        dateOfBirth: '2026-02-30',
        gender: 'x'.repeat(33),
      }),
    ).toMatchObject({
      success: false,
      errors: {
        displayName: expect.any(String),
        dateOfBirth: expect.any(String),
        gender: expect.any(String),
      },
    })

    expect(
      profileErrorsFromProblem({
        type: 'about:blank',
        title: 'Validation failed',
        status: 400,
        code: 'VALIDATION_FAILED',
        correlationId: '11111111-1111-4111-8111-111111111111',
        violations: [{ field: 'dateOfBirth', code: 'MINIMUM_AGE_NOT_MET' }],
      }),
    ).toEqual({ dateOfBirth: 'Bạn cần đủ 18 tuổi để tạo hồ sơ.' })
  })
})
