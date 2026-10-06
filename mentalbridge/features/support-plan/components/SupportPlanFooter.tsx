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
      aria-label="Bảo mật và thông tin pháp lý"
    >
      <div className="support-plan-footer-inner">
        <div className="support-plan-footer-privacy">
          <div className="support-plan-footer-lock-icon" aria-hidden="true">
            <SupportPlanIcon name="lock" size={18} />
          </div>
          <p>
            Dữ liệu được bảo mật y tế HIPAA &amp; riêng tư hoàn toàn. Chuyên gia
            điều trị chỉ theo dõi các trạng thái hoạt động bạn chủ động chọn
            chia sẻ.
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
