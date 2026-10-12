import SupportPlanIcon from './SupportPlanIcon'
import { formatSupportPlanUpdatedAt } from './support-plan-format'

interface SupportPlanFooterProps {
  updatedAt?: string
}

export default function SupportPlanFooter({
  updatedAt,
}: SupportPlanFooterProps) {
  const formattedDate = formatSupportPlanUpdatedAt(updatedAt)

  return (
    <footer
      className="support-plan-footer"
      aria-label="Thông tin kế hoạch hỗ trợ"
    >
      <div className="support-plan-footer-inner">
        <div className="support-plan-footer-privacy">
          <div className="support-plan-footer-lock-icon" aria-hidden="true">
            <SupportPlanIcon name="info" size={18} />
          </div>
          <p>
            Bạn quyết định trạng thái hoạt động nào được phép dùng trong bản tóm
            tắt. Ghi chú riêng không được chia sẻ từ màn hình này.
          </p>
        </div>

        <div className="support-plan-footer-timestamp">
          <SupportPlanIcon name="history" size={16} />
          <time dateTime={updatedAt} suppressHydrationWarning>
            {formattedDate
              ? `Cập nhật lần cuối: ${formattedDate}`
              : 'Cập nhật lần cuối'}
          </time>
        </div>
      </div>
    </footer>
  )
}
