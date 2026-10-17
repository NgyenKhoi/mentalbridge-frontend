'use client'

import { useId, useState, type ReactNode } from 'react'
import Link from 'next/link'

export default function CommunitySensitiveContent({
  warned,
  children,
}: Readonly<{ warned: boolean; children: ReactNode }>) {
  const [revealed, setRevealed] = useState(false)
  const contentId = useId()

  if (!warned) return children

  return (
    <section className="community-sensitive-content">
      {!revealed && (
        <div className="community-sensitive-warning" role="note">
          <span className="community-sensitive-icon" aria-hidden="true">
            ◇
          </span>
          <div>
            <strong>Nội dung nhạy cảm</strong>
            <p>
              Người đăng hoặc đội ngũ kiểm duyệt đã thêm cảnh báo vì bài viết có
              thể chứa chi tiết khiến bạn không thoải mái.
            </p>
            <div className="community-sensitive-actions">
              <button
                type="button"
                aria-expanded="false"
                aria-controls={contentId}
                onClick={() => setRevealed(true)}
              >
                Xem nội dung
              </button>
              <Link href="/safety-directory">Cần hỗ trợ ngay</Link>
            </div>
          </div>
        </div>
      )}
      <div
        id={contentId}
        className="community-sensitive-revealed"
        hidden={!revealed}
      >
        {revealed && (
          <>
            <div className="community-sensitive-revealed-heading">
              <span>Nội dung nhạy cảm đang được hiển thị</span>
              <button
                type="button"
                aria-expanded="true"
                aria-controls={contentId}
                onClick={() => setRevealed(false)}
              >
                Ẩn lại nội dung
              </button>
            </div>
            {children}
          </>
        )}
      </div>
    </section>
  )
}
