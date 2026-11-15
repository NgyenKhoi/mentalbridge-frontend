import { describe, expect, it } from 'vitest'
import { extractCredentialFields } from './credential-file-evidence'

describe('credential field extraction', () => {
  it('uses labels in the recognized text and preserves leading zeros', () => {
    expect(
      extractCredentialFields(
        'GIẤY PHÉP HÀNH NGHỀ KHÁM BỆNH, CHỮA BỆNH\n' +
          'Họ và tên:\nNgười dùng kiểm thử\n' +
          'Ngày sinh: 10/11/1998\nSố giấy phép: 000812/TEST\n' +
          'Cơ quan cấp: Đơn vị kiểm thử\nNgày cấp: 10/11/2024',
      ),
    ).toEqual({
      title: 'GIẤY PHÉP HÀNH NGHỀ KHÁM BỆNH, CHỮA BỆNH',
      credentialType: 'LICENSE',
      holder: 'Người dùng kiểm thử',
      documentNumber: '000812/TEST',
      issuer: 'Đơn vị kiểm thử',
      issueDate: '10/11/2024',
      issueYear: '2024',
    })
  })

  it('leaves absent fields empty when text contains only an unrelated date and ID', () => {
    expect(
      extractCredentialFields('Ngày sinh: 10/11/1998\nSố CCCD: 000000000000'),
    ).toMatchObject({
      credentialType: undefined,
      documentNumber: '',
      issueYear: '',
      title: '',
    })
  })
})
