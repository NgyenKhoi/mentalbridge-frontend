import type { FC } from 'react'

import styles from './AccountStatusCard.module.css'

export interface AccountStatusCardProps {
  profileSaved: boolean
  screeningEnabled: boolean
}

export const AccountStatusCard: FC<AccountStatusCardProps> = ({
  profileSaved,
  screeningEnabled,
}) => {
  return (
    <section
      className={`${styles.card} account-status-card`}
      aria-labelledby="account-status-heading"
      style={{
        background: '#152720',
        color: '#ffffff',
      }}
    >
      <h2
        id="account-status-heading"
        className={`${styles.heading} account-status-heading`}
        style={{ color: '#ffffff' }}
      >
        Trạng thái tài khoản
      </h2>

      <ul className={styles.list}>
        {/* Row 1: Profile Status */}
        <li className={`${styles.row} account-status-row`}>
          <div
            className={`${styles.iconBox} account-status-icon-box`}
            aria-hidden="true"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
          >
            <svg
              className={`${styles.icon} account-status-icon`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#7ecfa9"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: '#7ecfa9' }}
            >
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>

          <div className={`${styles.content} account-status-content`}>
            <span
              className={`${styles.title} account-status-title`}
              style={{ color: '#ffffff' }}
            >
              Hồ sơ cá nhân
            </span>
            <span
              className={`${styles.description} account-status-desc`}
              style={{ color: '#a3c2b3' }}
            >
              {profileSaved ? 'Thông tin đã sẵn sàng' : 'Chưa hoàn tất thông tin'}
            </span>
          </div>

          <div
            className={`${styles.badge} ${
              profileSaved ? styles.badgeOk : styles.badgeWarn
            } account-status-badge ${profileSaved ? 'ok' : 'warn'}`}
            style={{
              color: profileSaved ? '#60c997' : '#f5b041',
              backgroundColor: profileSaved
                ? 'rgba(43, 107, 79, 0.45)'
                : 'rgba(138, 90, 18, 0.45)',
            }}
          >
            <span className={`${styles.dot} account-status-dot`} aria-hidden="true" />
            <span>{profileSaved ? 'Đã lưu' : 'Chưa lưu'}</span>
          </div>
        </li>

        {/* Row 2: Screening Data Processing Status */}
        <li className={`${styles.row} account-status-row`}>
          <div
            className={`${styles.iconBox} account-status-icon-box`}
            aria-hidden="true"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
          >
            <svg
              className={`${styles.icon} account-status-icon`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#7ecfa9"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: '#7ecfa9' }}
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>

          <div className={`${styles.content} account-status-content`}>
            <span
              className={`${styles.title} account-status-title`}
              style={{ color: '#ffffff' }}
            >
              Xử lý dữ liệu sàng lọc
            </span>
            <span
              className={`${styles.description} account-status-desc`}
              style={{ color: '#a3c2b3' }}
            >
              {screeningEnabled
                ? 'Cho phép lưu lịch sử đánh giá'
                : 'Không lưu kết quả vào tài khoản'}
            </span>
          </div>

          <div
            className={`${styles.badge} ${
              screeningEnabled ? styles.badgeOk : styles.badgeOff
            } account-status-badge ${screeningEnabled ? 'ok' : 'off'}`}
            style={{
              color: screeningEnabled ? '#60c997' : '#b0bfb7',
              backgroundColor: screeningEnabled
                ? 'rgba(43, 107, 79, 0.45)'
                : 'rgba(102, 113, 108, 0.35)',
            }}
          >
            <span className={`${styles.dot} account-status-dot`} aria-hidden="true" />
            <span>{screeningEnabled ? 'Đang bật' : 'Đã tắt'}</span>
          </div>
        </li>
      </ul>
    </section>
  )
}

export default AccountStatusCard
