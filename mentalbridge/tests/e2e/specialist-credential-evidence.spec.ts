import { expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { CredentialDocument } from '@/features/specialist-profile/api/credential-validation'
import { approvedProfile } from '../fixtures/profile-amendment'
import { test } from './test-fixtures'

function samplePdf() {
  const text =
    'BT /F1 14 Tf 20 150 Td (Credential test from the original file) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((object, index) => {
    const offset = pdf.length
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
    return String(offset).padStart(10, '0')
  })
  const xref = pdf.length
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .map((offset) => `${offset} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(pdf)
}

test('admin reads the submitted PDF and shows its exact hash without approving it', async ({
  page,
}) => {
  const publicPdf = process.env.MB_CREDENTIAL_PUBLIC_PDF
  const pdf = publicPdf ? await readFile(publicPdf) : samplePdf()
  const original = 'https://credential-file.example.test/original.pdf'
  const profile = { ...approvedProfile, approvalStatus: 'PENDING' }
  const credential: CredentialDocument = {
    id: 'a94e3ba5-449a-4356-9ed3-ac18f33a86a4',
    specialistAccountId: profile.accountId,
    title: 'Giấy phép đang chờ đối chiếu',
    issuer: 'Đơn vị cấp trong hồ sơ kiểm thử',
    issueYear: 2024,
    credentialType: 'LICENSE',
    fileName: 'original.pdf',
    mediaType: 'application/pdf',
    fileBytes: pdf.length,
    verificationStatus: 'PENDING',
    badgeVisible: false,
    reviewedAt: null,
    createdAt: '2026-10-01T03:00:00Z',
    version: 1,
  }
  let reviews = 0
  await page.route('**/api/admin/specialist-profiles?**', (route) =>
    route.fulfill({ json: { items: [profile], count: 1 } }),
  )
  await page.route('**/api/admin/specialist-profiles/**/documents', (route) =>
    route.fulfill({ json: [credential] }),
  )
  await page.route(
    '**/api/admin/specialist-profiles/documents/pending',
    (route) => route.fulfill({ json: [] }),
  )
  await page.route(
    '**/api/admin/specialist-profiles/documents/**/file',
    (route) => route.fulfill({ json: { url: original } }),
  )
  await page.route(
    '**/api/admin/specialist-profiles/documents/**/verify',
    (route) => {
      reviews++
      return route.abort()
    },
  )
  await page.route(original, (route) =>
    route.fulfill({
      body: pdf,
      contentType: 'application/pdf',
      headers: { 'Access-Control-Allow-Origin': '*' },
    }),
  )

  await page.goto('/login')
  await page.getByLabel('Email').fill('admin-resource-e2e@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard$/)
  await page.goto('/admin/specialists')
  await page.getByRole('button', { name: 'Xem tệp', exact: true }).click()
  const review = page.getByRole('dialog', { name: credential.title })
  await review.getByRole('button', { name: 'Phân tích tệp gốc' }).click()
  await expect(
    review.getByText(createHash('sha256').update(pdf).digest('hex')),
  ).toBeVisible()
  await expect(review.getByText(/Văn bản trong PDF/)).toBeVisible({
    timeout: 30_000,
  })
  await expect(review.getByText('Đang chờ xác minh')).toBeVisible()
  await expect(review.getByText(/Khớp 100%/)).toHaveCount(0)
  expect(reviews).toBe(0)
})

if (process.env.MB_CREDENTIAL_OCR_SMOKE === '1') {
  test('specialist reads Vietnamese text from a JPEG with PaddleOCR', async ({
    page,
  }) => {
    await page.route('**/api/consultation/specialist-profile', (route) =>
      route.fulfill({ json: approvedProfile, headers: { etag: '"2"' } }),
    )
    await page.route(
      '**/api/consultation/specialist-profile/documents',
      (route) => route.fulfill({ json: [] }),
    )
    await page.route(
      '**/api/consultation/specialist-profile/amendments/current',
      (route) => route.fulfill({ json: { approvedProfile, amendment: null } }),
    )
    await page.goto('/login')
    await page.getByLabel('Email').fill('specialist@example.com')
    await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page).toHaveURL(/\/specialist\/dashboard$/)
    await page.goto('/specialist/profile')
    await page.getByRole('button', { name: 'Xem giấy tờ', exact: true }).click()
    await page
      .getByRole('button', { name: 'Thêm giấy tờ', exact: true })
      .click()
    const upload = page.getByRole('dialog', { name: 'Thêm giấy tờ' })
    const base64 = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 1050
      canvas.height = 340
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas unavailable')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#000'
      context.font = 'bold 44px Arial'
      context.fillText('GIẤY PHÉP HÀNH NGHỀ', 40, 85)
      context.font = '36px Arial'
      context.fillText('Nơi cấp: Đơn vị kiểm thử', 40, 155)
      context.fillText('Ngày cấp: 10/11/2024', 40, 215)
      return canvas.toDataURL('image/jpeg', 0.95).split(',')[1]
    })
    await upload.locator('input[type=file]').setInputFiles({
      name: 'image.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from(base64, 'base64'),
    })
    await upload
      .getByRole('button', { name: 'Điền thông tin từ tệp' })
      .click({ timeout: 90_000 })
    await expect(upload.getByLabel('Tên giấy tờ')).toHaveValue(
      /giấy phép hành nghề/i,
    )
    await expect(upload.getByLabel('Năm cấp')).toHaveValue('2024')
    await expect(
      upload.getByText(/chờ xác minh sau khi tải lên/i),
    ).toBeVisible()
  })
}
