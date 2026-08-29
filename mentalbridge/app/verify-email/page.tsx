import Link from 'next/link'

import EmailVerification from '@/features/auth/components/EmailVerification'

import '../login/auth.css'

export default async function VerifyEmailPage(
  props: PageProps<'/verify-email'>,
) {
  const { challenge } = await props.searchParams
  const verificationChallenge = typeof challenge === 'string' ? challenge : null

  return (
    <div className="auth-layout">
      <div className="auth-container">
        <div className="auth-form-side">
          <div className="auth-form-container">
            <Link href="/" className="auth-logo">
              <svg
                className="mark"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M4 26C10 14 30 14 36 26"
                  stroke="#1E4A43"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle cx="8" cy="27" r="3" fill="#E1A651" />
                <circle cx="32" cy="27" r="3" fill="#3D7A6E" />
              </svg>
              <span>MentalBridge</span>
            </Link>

            <EmailVerification challenge={verificationChallenge} />
          </div>
        </div>

        <div className="auth-visual-side">
          <div className="auth-visual-container">
            <div className="auth-breathe-stage">
              <div className="orbit orbit-1" aria-hidden="true">
                <span className="orbit-dot amber-dot" />
              </div>
              <div className="orbit orbit-2" aria-hidden="true">
                <span className="orbit-dot teal-dot" />
              </div>
              <div className="breathe-ring r1" />
              <div className="breathe-ring r2" />
              <div className="breathe-blob">
                <span className="breathe-label">An tâm...</span>
              </div>
            </div>

            <div className="auth-float-card fc-1">
              <div className="float-inner">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M9 11l2 2 4-4M20 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7l4-4h8l4 4Z" />
                </svg>
                <div>
                  <div className="fc-title">Liên kết một lần</div>
                  <div className="fc-value">Không lưu trong trình duyệt</div>
                </div>
              </div>
            </div>

            <div className="auth-float-card fc-2">
              <div className="float-inner">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M12 3 4 7v5c0 4.8 3.1 7.5 8 9 4.9-1.5 8-4.2 8-9V7l-8-4Z" />
                </svg>
                <div>
                  <div className="fc-title">Kích hoạt an toàn</div>
                  <div className="fc-value">Identity xác nhận trạng thái</div>
                </div>
              </div>
            </div>

            <div className="auth-quote">
              <blockquote>
                &ldquo;Mỗi bước an toàn giúp hành trình trở nên nhẹ nhàng
                hơn.&rdquo;
              </blockquote>
              <cite>— MentalBridge</cite>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
