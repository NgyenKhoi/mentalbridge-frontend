'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

import type { CredentialDocument } from '../api/credential-validation'
import {
  credentialFileSha256,
  jpegCompressionMap,
  maxCredentialFileBytes,
  readCredentialFile,
  supportedCredentialFile,
  type CredentialReading,
} from '../services/credential-file-evidence'
import styles from './AdminCredentialReviewSection.module.css'

export default function CredentialEvidencePanel({
  credential,
  url,
}: {
  credential: CredentialDocument
  url: string
}) {
  const analysis = useRef<AbortController | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [reading, setReading] = useState<CredentialReading | null>(null)
  const [sha256, setSha256] = useState('')
  const [compression, setCompression] =
    useState<Awaited<ReturnType<typeof jpegCompressionMap>>>(null)

  useEffect(() => () => analysis.current?.abort(), [])

  async function analyze() {
    const request = new AbortController()
    analysis.current = request
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(90_000),
    ])
    setRunning(true)
    setError('')
    setReading(null)
    setSha256('')
    setCompression(null)

    try {
      const response = await fetch(url, {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        signal,
      })
      const bytes = Number(response.headers.get('Content-Length'))
      if (!response.ok || bytes > maxCredentialFileBytes) throw new Error()
      const blob = (await response.blob()).slice(
        0,
        undefined,
        credential.mediaType,
      )
      if (!supportedCredentialFile(blob)) throw new Error()
      const digest = await credentialFileSha256(blob)
      signal.throwIfAborted()
      setSha256(digest)

      if (credential.mediaType === 'image/jpeg') {
        const map = await jpegCompressionMap(blob).catch(() => null)
        signal.throwIfAborted()
        setCompression(map)
      }
      const result = await readCredentialFile(blob, signal)
      signal.throwIfAborted()
      setReading(result)
    } catch {
      if (!request.signal.aborted) {
        setError('Không thể hoàn tất phân tích. Mở lại tệp gốc rồi thử lại.')
      }
    } finally {
      if (!request.signal.aborted) setRunning(false)
    }
  }

  const sourceLabel = (source: CredentialReading['sources'][number]) => {
    if (source === 'PDF_TEXT') return 'Văn bản trong PDF'
    if (source === 'TESSERACT_OCR') return 'OCR (Tesseract)'
    return source
  }

  return (
    <aside className={styles.evidence} aria-label="Bằng chứng thẩm định">
      <h3>Bằng chứng thẩm định</h3>
      <button type="button" disabled={running} onClick={() => void analyze()}>
        {running ? 'Đang phân tích tệp…' : 'Phân tích tệp gốc'}
      </button>
      {error && <p role="alert">{error}</p>}

      <details open>
        <summary>1. Đọc thông tin</summary>
        {reading ? (
          <>
            <p>
              {reading.sources.map(sourceLabel).join(' + ')}{' '}
              · {reading.pagesRead}/{reading.pageCount} trang
            </p>
            {reading.fields.holder && (
              <p>Người được cấp · {reading.fields.holder}</p>
            )}
            {reading.fields.documentNumber && (
              <p>Số giấy tờ · {reading.fields.documentNumber}</p>
            )}
            {reading.fields.issuer && <p>Nơi cấp · {reading.fields.issuer}</p>}
            {reading.fields.issueDate && (
              <p>Ngày cấp · {reading.fields.issueDate}</p>
            )}
            <details>
              <summary>Xem chữ đọc được</summary>
              <pre>{reading.text || 'Không đọc được chữ trên tệp.'}</pre>
            </details>
          </>
        ) : (
          <p>{running ? 'Đang đọc nội dung.' : 'Chưa đọc nội dung tệp.'}</p>
        )}
      </details>

      <details>
        <summary>2. Kiểm tra ảnh (ELA)</summary>
        {compression ? (
          <>
            <p>
              Bản đồ sai khác sau khi nén lại JPEG ở chất lượng 90%. Dùng để
              khoanh vùng kiểm tra bằng mắt.
            </p>
            <Image
              alt="Bản đồ sai khác khi nén lại ảnh JPEG"
              src={compression.url}
              width={compression.width}
              height={compression.height}
              unoptimized
            />
          </>
        ) : (
          <p>Phân tích sai khác nén áp dụng cho ảnh JPEG tối đa 6 megapixel.</p>
        )}
      </details>

      <details>
        <summary>3. Phôi và chữ ký</summary>
        <p>Kiểm tra phôi, dấu và tem trên bản gốc.</p>
        {reading?.signatureFields !== null &&
          reading?.signatureFields !== undefined && (
            <p>
              Phát hiện {reading.signatureFields} trường chữ ký trong PDF. Tính
              hợp lệ của chữ ký cần được kiểm tra riêng.
            </p>
          )}
      </details>

      <details>
        <summary>4. Nguồn đối chiếu</summary>
        <p>
          Đối chiếu người được cấp, số giấy tờ và tình trạng với cơ quan cấp.
        </p>
        {credential.credentialType === 'LICENSE' ? (
          <ul>
            <li>
              <a
                href="https://tracuu.medinet.org.vn/"
                target="_blank"
                rel="noreferrer"
              >
                Tra cứu Sở Y tế TP.HCM
              </a>
            </li>
            <li>
              <a
                href="https://yteso.nghean.gov.vn/thongtin-canhan"
                target="_blank"
                rel="noreferrer"
              >
                Tra cứu Sở Y tế Nghệ An
              </a>
            </li>
            <li>
              <a
                href="https://suckhoethudo.vn/"
                target="_blank"
                rel="noreferrer"
              >
                Tra cứu Sở Y tế Hà Nội
              </a>
            </li>
          </ul>
        ) : (
          <p>Tra cứu sổ gốc tại trường hoặc đơn vị cấp ghi trên giấy tờ.</p>
        )}
      </details>

      <details open>
        <summary>5. Tệp và quyết định</summary>
        {sha256 && (
          <p>
            SHA-256 của tệp đang mở <code>{sha256}</code>
          </p>
        )}
        {credential.reviewedAt && (
          <p>
            Ngày xử lý ·{' '}
            {new Date(credential.reviewedAt).toLocaleString('vi-VN')}
          </p>
        )}
      </details>
    </aside>
  )
}
