'use client';
import { motion } from 'framer-motion';

const NOTIFICATIONS = [
  {
    id: 1,
    type: 'reminder',
    title: 'Nhắc nhở: Viết nhật ký hôm nay',
    message: 'Bạn chưa ghi nhật ký cảm xúc hôm nay. Hãy dành 5 phút để ghi lại cảm xúc của bạn nhé!',
    time: '2h trước',
    read: false,
    icon: '📝',
    color: 'var(--amber)'
  },
  {
    id: 2,
    type: 'message',
    title: 'Tin nhắn mới từ TS. Nguyễn Thị Lan',
    message: 'Buổi tư vấn tiếp theo của chúng ta là thứ 5 lúc 10h nhé!',
    time: '3h trước',
    read: false,
    icon: '💬',
    color: 'var(--teal)'
  },
  {
    id: 3,
    type: 'appointment',
    title: 'Lịch hẹn sắp tới',
    message: 'Bạn có buổi tư vấn với ThS. Trần Văn Minh vào 10:00 ngày mai',
    time: '1 ngày trước',
    read: true,
    icon: '📅',
    color: 'var(--lavender)'
  },
  {
    id: 4,
    type: 'system',
    title: 'Cập nhật tính năng mới',
    message: 'Chúng tôi vừa thêm bài tập thở và thiền mới. Hãy thử ngay!',
    time: '2 ngày trước',
    read: true,
    icon: '🎉',
    color: 'var(--teal)'
  },
  {
    id: 5,
    type: 'assessment',
    title: 'Đã đến lúc làm bài đánh giá',
    message: 'Đã 2 tuần kể từ lần đánh giá cuối. Hãy làm PHQ-9 để theo dõi tiến trình.',
    time: '3 ngày trước',
    read: true,
    icon: '📊',
    color: 'var(--amber)'
  },
  {
    id: 6,
    type: 'achievement',
    title: 'Chúc mừng! Streak 7 ngày',
    message: 'Bạn đã ghi nhật ký liên tục 7 ngày. Tiếp tục duy trì nhé!',
    time: '1 tuần trước',
    read: true,
    icon: '🔥',
    color: 'var(--amber)'
  }
];

export default function NotificationsPage() {
  const unreadCount = NOTIFICATIONS.filter(n => !n.read).length;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h1 style={{ 
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.8rem, 4vw, 2.4rem)',
            marginBottom: '0.5rem'
          }}>
            Thông báo
            {unreadCount > 0 && (
              <span style={{
                marginLeft: '0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'var(--amber)',
                color: 'white',
                fontSize: '0.9rem',
                fontWeight: 600,
                fontFamily: 'var(--font-body)'
              }}>
                {unreadCount}
              </span>
            )}
          </h1>
          <p style={{ opacity: 0.7 }}>
            {unreadCount > 0 ? `Bạn có ${unreadCount} thông báo chưa đọc` : 'Không có thông báo mới'}
          </p>
        </div>

        {unreadCount > 0 && (
          <button className="btn-outline">
            Đánh dấu đã đọc tất cả
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        {NOTIFICATIONS.map((notif, index) => (
          <motion.div
            key={notif.id}
            className="feature-card"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            style={{ 
              display: 'flex',
              gap: '1.25rem',
              alignItems: 'flex-start',
              background: notif.read ? 'transparent' : 'var(--teal-pale)',
              borderColor: notif.read ? 'var(--line)' : 'var(--teal)',
              position: 'relative',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(.16,1,.3,1)'
            }}
            whileHover={{ x: 4 }}
          >
            {/* Icon */}
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: `${notif.color}15`,
              border: `2px solid ${notif.color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              flexShrink: 0
            }}>
              {notif.icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: '0.5rem',
                gap: '1rem'
              }}>
                <h3 style={{ 
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.05rem',
                  fontWeight: notif.read ? 500 : 600
                }}>
                  {notif.title}
                </h3>
                <div style={{ 
                  fontSize: '0.8rem',
                  opacity: 0.6,
                  whiteSpace: 'nowrap'
                }}>
                  {notif.time}
                </div>
              </div>

              <p style={{ 
                lineHeight: 1.6,
                opacity: notif.read ? 0.7 : 0.9,
                fontSize: '0.95rem'
              }}>
                {notif.message}
              </p>
            </div>

            {/* Unread indicator */}
            {!notif.read && (
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: notif.color,
                flexShrink: 0,
                marginTop: '0.5rem'
              }} />
            )}
          </motion.div>
        ))}
      </div>

      {/* Empty state (if no notifications) */}
      {NOTIFICATIONS.length === 0 && (
        <motion.div
          className="feature-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ 
            textAlign: 'center',
            padding: '3rem 2rem'
          }}
        >
          <div style={{ 
            fontSize: '4rem',
            marginBottom: '1rem'
          }}>
            🔔
          </div>
          <h3 style={{ 
            fontFamily: 'var(--font-display)',
            fontSize: '1.3rem',
            marginBottom: '0.5rem'
          }}>
            Không có thông báo
          </h3>
          <p style={{ opacity: 0.7 }}>
            Các thông báo mới sẽ hiển thị ở đây
          </p>
        </motion.div>
      )}
    </div>
  );
}
