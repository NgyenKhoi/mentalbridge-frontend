'use client'

import { useState } from 'react'

import type {
  SafetyDirectoryResponse,
  SafetyDirectoryTrigger,
} from '@/features/assessment/api/care-contract'
import { browserApiClient } from '@/lib/api/browser-client'

import './safety-directory-flow.css'

const provinces = [
  ['01', 'Hà Nội'],
  ['48', 'Đà Nẵng'],
  ['79', 'Hồ Chí Minh'],
] as const

export default function SafetyDirectoryFlow({
  trigger,
}: {
  trigger: SafetyDirectoryTrigger
}) {
  const [provinceCode, setProvinceCode] = useState('')
  const [districtCode, setDistrictCode] = useState('')
  const [manualLocation, setManualLocation] = useState('')
  const [result, setResult] = useState<SafetyDirectoryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [copyState, setCopyState] = useState<{
    phone: string
    status: 'copied' | 'failed'
  } | null>(null)

  async function lookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(false)
    setResult(null)
    try {
      const response = await browserApiClient.post<SafetyDirectoryResponse>(
        '/care/safety-directory',
        manualLocation.trim()
          ? { trigger, manualLocation: manualLocation.trim() }
          : {
              trigger,
              provinceCode,
              ...(districtCode.trim()
                ? { districtCode: districtCode.trim() }
                : {}),
            },
      )
      setResult(response.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  async function copyPhone(phone: string) {
    try {
      await navigator.clipboard.writeText(phone)
      setCopyState({ phone, status: 'copied' })
    } catch {
      setCopyState({ phone, status: 'failed' })
    }
    window.setTimeout(() => setCopyState(null), 1800)
  }

  return (
    <main className="safety-directory-page">
      <header className="safety-directory-hero">
        <span className="safety-directory-eyebrow">Hỗ trợ theo khu vực</span>
        <h1>Cơ sở trong khu vực đã chọn</h1>
        <p>
          Chọn khu vực thủ công để xem các cơ sở hoặc đường dây đã được rà soát.
          MentalBridge không xác định vị trí nền, không tự động gọi và không
          liên hệ bên thứ ba.
        </p>
        {trigger === 'POSITIVE_ITEM_9' && (
          <p className="safety-directory-trigger" role="status">
            Mục an toàn PHQ-9 đã mở luồng hỗ trợ này. Kết quả đó không xác định
            ý định, kế hoạch hay mức độ khẩn cấp.
          </p>
        )}
      </header>

      <form className="safety-directory-form" onSubmit={lookup}>
        <fieldset>
          <legend>Chọn tỉnh/thành và quận/huyện</legend>
          <label>
            Tỉnh/thành phố
            <select
              value={provinceCode}
              onChange={(event) => {
                setProvinceCode(event.target.value)
                setManualLocation('')
              }}
              disabled={manualLocation.length > 0}
            >
              <option value="">Chọn tỉnh/thành phố</option>
              {provinces.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mã quận/huyện (không bắt buộc)
            <input
              value={districtCode}
              onChange={(event) => setDistrictCode(event.target.value)}
              maxLength={32}
              disabled={!provinceCode || manualLocation.length > 0}
              placeholder="Ví dụ: 001"
            />
          </label>
        </fieldset>
        <div className="safety-directory-or" aria-hidden="true">
          hoặc
        </div>
        <label>
          Nhập tên khu vực
          <input
            value={manualLocation}
            onChange={(event) => {
              setManualLocation(event.target.value)
              if (event.target.value) {
                setProvinceCode('')
                setDistrictCode('')
              }
            }}
            maxLength={120}
            placeholder="Ví dụ: Hà Nội"
          />
        </label>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={loading || (!provinceCode && !manualLocation.trim())}
        >
          {loading ? 'Đang tra cứu…' : 'Tra cứu khu vực'}
        </button>
      </form>

      <section aria-live="polite" aria-busy={loading}>
        {error && (
          <div className="safety-directory-state" role="alert">
            <h2>Tra cứu tạm thời chưa khả dụng</h2>
            <p>
              Không thể kết nối Care lúc này. Nếu bạn cảm thấy không an toàn,
              hãy chủ động tìm hỗ trợ trực tiếp phù hợp tại khu vực của bạn.
            </p>
          </div>
        )}
        {result?.state === 'RESULTS' && (
          <div className="safety-directory-results">
            <h2>{result.areaWording}</h2>
            <p className="safety-directory-guidance">{result.safetyGuidance}</p>
            <div className="safety-directory-list">
              {result.entries.map((entry) => (
                <article key={entry.directoryEntryId}>
                  <span className="safety-directory-type">
                    {entry.type === 'FACILITY' ? 'Cơ sở' : 'Đường dây'}
                  </span>
                  <h3>{entry.name}</h3>
                  {entry.address && <p>{entry.address}</p>}
                  <p className="safety-directory-phone">{entry.phone}</p>
                  <div className="safety-directory-actions">
                    <a href={`tel:${entry.phone}`}>Gọi số này</a>
                    <button
                      type="button"
                      onClick={() => void copyPhone(entry.phone)}
                    >
                      {copyState?.phone === entry.phone &&
                      copyState.status === 'copied'
                        ? 'Đã sao chép'
                        : 'Sao chép số'}
                    </button>
                  </div>
                  {copyState?.phone === entry.phone &&
                    copyState.status === 'failed' && (
                      <p role="alert">
                        Không thể sao chép. Hãy chọn số ở trên.
                      </p>
                    )}
                </article>
              ))}
            </div>
            <p className="safety-directory-limit">{result.limitation}</p>
          </div>
        )}
        {result && result.state !== 'RESULTS' && (
          <div className="safety-directory-state">
            <h2>
              {result.state === 'INVALID_AREA'
                ? 'Chưa xác định được khu vực'
                : result.state === 'EMPTY'
                  ? 'Chưa có cơ sở trong khu vực'
                  : 'Tra cứu tạm thời chưa khả dụng'}
            </h2>
            <p>{result.safetyGuidance}</p>
            <p>{result.limitation}</p>
          </div>
        )}
      </section>
    </main>
  )
}
