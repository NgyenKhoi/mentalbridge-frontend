'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const CATEGORIES = [
  'Tất cả',
  'Thở',
  'Thiền',
  'Ngủ',
  'Vận động',
  'Tư duy tích cực',
]

const RESOURCES = [
  {
    id: 1,
    title: 'Kỹ thuật thở 4-7-8',
    category: 'Thở',
    duration: '5 phút',
    description:
      'Điều hòa nhịp thở để làm dịu căng thẳng và đưa cơ thể trở về trạng thái cân bằng.',
    icon: '🌬️',
    tone: 'teal',
    level: 'Dễ bắt đầu',
  },
  {
    id: 2,
    title: 'Thiền chánh niệm buổi sáng',
    category: 'Thiền',
    duration: '10 phút',
    description:
      'Bắt đầu ngày mới với tâm trí tỉnh táo, tập trung và một nhịp điệu nhẹ nhàng hơn.',
    icon: '🧘',
    tone: 'lavender',
    level: 'Có hướng dẫn',
  },
  {
    id: 3,
    title: 'Thư giãn cơ thể trước khi ngủ',
    category: 'Ngủ',
    duration: '15 phút',
    description:
      'Thả lỏng từng nhóm cơ, giải phóng áp lực trong ngày và chuẩn bị cho giấc ngủ sâu.',
    icon: '🌙',
    tone: 'amber',
    level: 'Buổi tối',
  },
  {
    id: 4,
    title: 'Yoga cho người mới',
    category: 'Vận động',
    duration: '20 phút',
    description:
      'Chuỗi tư thế cơ bản giúp cơ thể linh hoạt hơn mà không tạo cảm giác quá sức.',
    icon: '🤸',
    tone: 'teal',
    level: 'Không cần dụng cụ',
  },
  {
    id: 5,
    title: 'Viết nhật ký biết ơn',
    category: 'Tư duy tích cực',
    duration: '5 phút',
    description:
      'Ghi lại những điều nhỏ bé có ý nghĩa để nuôi dưỡng góc nhìn tích cực mỗi ngày.',
    icon: '✍️',
    tone: 'amber',
    level: 'Tự thực hành',
  },
  {
    id: 6,
    title: 'Thiền quét cơ thể',
    category: 'Thiền',
    duration: '12 phút',
    description:
      'Kết nối với tín hiệu cơ thể và nhận diện những vùng đang giữ căng thẳng.',
    icon: '◎',
    tone: 'lavender',
    level: 'Có âm thanh',
  },
]

const RESOURCE_GUIDES: Record<number, { note: string; steps: string[] }> = {
  1: {
    note: 'Ngồi thoải mái, thả lỏng vai và giữ lưng ở tư thế tự nhiên.',
    steps: [
      'Hít vào nhẹ nhàng trong 4 giây',
      'Giữ hơi thở trong 7 giây',
      'Thở ra chậm rãi trong 8 giây',
      'Lặp lại chu kỳ thêm 3 lần',
    ],
  },
  2: {
    note: 'Chọn một nơi yên tĩnh và để điện thoại ở chế độ không làm phiền.',
    steps: [
      'Cảm nhận điểm tiếp xúc của cơ thể',
      'Đưa sự chú ý về nhịp thở',
      'Nhận biết suy nghĩ mà không phán xét',
      'Nhẹ nhàng trở lại với hiện tại',
    ],
  },
  3: {
    note: 'Nằm hoặc ngồi ở tư thế dễ chịu, nới lỏng quần áo nếu cần.',
    steps: [
      'Siết nhẹ rồi thả lỏng bàn chân',
      'Tiếp tục với chân, bụng và vai',
      'Thả lỏng hàm và vùng quanh mắt',
      'Hít sâu một nhịp trước khi kết thúc',
    ],
  },
  4: {
    note: 'Chuẩn bị một khoảng sàn bằng phẳng và di chuyển trong giới hạn thoải mái.',
    steps: [
      'Khởi động cổ tay và vai',
      'Thực hiện tư thế mèo – bò',
      'Chuyển sang em bé và chó úp mặt',
      'Kết thúc bằng 3 nhịp thở sâu',
    ],
  },
  5: {
    note: 'Không cần viết điều lớn lao; hãy bắt đầu từ một chi tiết nhỏ trong ngày.',
    steps: [
      'Ghi một điều khiến bạn dễ chịu',
      'Viết vì sao điều đó có ý nghĩa',
      'Ghi tên một người bạn trân trọng',
      'Chọn một điều muốn mang theo ngày mai',
    ],
  },
  6: {
    note: 'Nằm thoải mái và quan sát cơ thể với thái độ tò mò, không phán xét.',
    steps: [
      'Cảm nhận bàn chân và cẳng chân',
      'Di chuyển chú ý lên bụng và ngực',
      'Quan sát vai, cổ và khuôn mặt',
      'Cảm nhận toàn bộ cơ thể cùng lúc',
    ],
  },
}

export default function ResourcesPage() {
  const [selectedCategory, setSelectedCategory] = useState('Tất cả')
  const [startedResource, setStartedResource] = useState<number | null>(null)
  const [exerciseActive, setExerciseActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const filteredResources =
    selectedCategory === 'Tất cả'
      ? RESOURCES
      : RESOURCES.filter((resource) => resource.category === selectedCategory)
  const activeResource = RESOURCES.find(
    (resource) => resource.id === startedResource,
  )
  const activeGuide = startedResource ? RESOURCE_GUIDES[startedResource] : null

  const openExercise = (id: number) => {
    setStartedResource(id)
    setExerciseActive(false)
  }

  const closeExercise = () => {
    videoRef.current?.pause()
    setStartedResource(null)
    setExerciseActive(false)
  }

  const toggleExercise = () => {
    if (activeResource?.id === 1 && videoRef.current) {
      if (videoRef.current.paused) void videoRef.current.play()
      else videoRef.current.pause()
      return
    }
    setExerciseActive((active) => !active)
  }

  return (
    <main className="resources-page">
      <section className="resources-hero">
        <div className="resources-hero-copy">
          <span className="resources-eyebrow">Thư viện tự chăm sóc</span>
          <h1>
            Một khoảng nghỉ <em>vừa đủ</em> cho hôm nay
          </h1>
          <p>
            Những bài thực hành ngắn, dễ theo dõi để bạn điều hòa cảm xúc, ngủ
            tốt hơn và kết nối lại với cơ thể.
          </p>
          <div className="resources-stats" aria-label="Thông tin thư viện">
            <span>
              <b>06</b> bài thực hành
            </span>
            <span>
              <b>5–20</b> phút mỗi bài
            </span>
            <span>
              <b>100%</b> tự thực hành
            </span>
          </div>
        </div>

        <aside className="resources-featured" aria-label="Gợi ý hôm nay">
          <div className="resources-featured-icon" aria-hidden="true">
            🌿
          </div>
          <span>Gợi ý hôm nay</span>
          <h2>Thở 4-7-8</h2>
          <p>5 phút để nhịp thở chậm lại và đầu óc có thêm khoảng trống.</p>
          <button onClick={() => openExercise(1)}>
            Bắt đầu 5 phút <i aria-hidden="true">→</i>
          </button>
        </aside>
      </section>

      <nav className="resources-filters" aria-label="Lọc tài nguyên">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            className={selectedCategory === category ? 'active' : ''}
            onClick={() => setSelectedCategory(category)}
            aria-pressed={selectedCategory === category}
          >
            {category}
          </button>
        ))}
      </nav>

      <AnimatePresence mode="popLayout">
        <motion.section
          className="resources-grid"
          layout
          aria-label="Danh sách tài nguyên"
        >
          {filteredResources.map((resource, index) => (
            <motion.article
              className={`resource-card resource-${resource.tone}`}
              key={resource.id}
              layout
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{
                duration: 0.42,
                delay: index * 0.055,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <header>
                <span className="resource-number">0{resource.id}</span>
                <span className="resource-icon" aria-hidden="true">
                  {resource.icon}
                </span>
              </header>
              <div className="resource-card-copy">
                <div className="resource-meta">
                  <span>{resource.category}</span>
                  <span>
                    <i aria-hidden="true">◷</i>
                    {resource.duration}
                  </span>
                  <span>{resource.level}</span>
                </div>
                <h2>{resource.title}</h2>
                <p>{resource.description}</p>
              </div>
              <footer>
                <button onClick={() => openExercise(resource.id)}>
                  Bắt đầu bài tập
                  <span aria-hidden="true">→</span>
                </button>
              </footer>
            </motion.article>
          ))}
        </motion.section>
      </AnimatePresence>

      <AnimatePresence>
        {activeResource && activeGuide && (
          <motion.div
            className="resource-exercise-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              className="resource-exercise-backdrop"
              onClick={closeExercise}
              aria-label="Đóng bài tập"
            />
            <motion.section
              className={`resource-exercise-modal ${exerciseActive ? 'is-active' : ''}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="resource-exercise-title"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                className="resource-exercise-close"
                onClick={closeExercise}
                aria-label="Đóng"
              >
                ×
              </button>
              <div
                className={`resource-exercise-visual resource-${activeResource.tone}`}
              >
                <span className="resource-exercise-label">
                  {activeResource.id === 1
                    ? 'Video hướng dẫn'
                    : exerciseActive
                      ? 'Đang thực hành'
                      : 'Bài tập hướng dẫn'}
                </span>
                {activeResource.id === 1 ? (
                  <div className="resource-exercise-video">
                    <video
                      ref={videoRef}
                      controls
                      preload="metadata"
                      playsInline
                      onPlay={() => setExerciseActive(true)}
                      onPause={() => setExerciseActive(false)}
                      onEnded={() => setExerciseActive(false)}
                      aria-label="Video hướng dẫn kỹ thuật thở 4-7-8"
                    >
                      <source
                        src="/videos/ky-thuat-tho-4-7-8.mp4"
                        type="video/mp4"
                      />
                      Trình duyệt của bạn không hỗ trợ phát video MP4.
                    </video>
                  </div>
                ) : (
                  <>
                    <div className="resource-breath-orb">
                      <span aria-hidden="true">{activeResource.icon}</span>
                    </div>
                    <strong>
                      {exerciseActive
                        ? 'Hít vào · Thở ra'
                        : activeResource.duration}
                    </strong>
                    <small>
                      {exerciseActive
                        ? 'Giữ nhịp chậm và đều'
                        : activeResource.level}
                    </small>
                  </>
                )}
              </div>
              <div className="resource-exercise-content">
                <span className="resource-exercise-category">
                  {activeResource.category} · {activeResource.duration}
                </span>
                <h2 id="resource-exercise-title">{activeResource.title}</h2>
                <p>{activeGuide.note}</p>
                <ol>
                  {activeGuide.steps.map((step, index) => (
                    <li key={step}>
                      <span>{index + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <div className="resource-exercise-actions">
                  <button
                    className="resource-exercise-secondary"
                    onClick={closeExercise}
                  >
                    Để sau
                  </button>
                  <button
                    className="resource-exercise-primary"
                    onClick={toggleExercise}
                  >
                    {exerciseActive
                      ? 'Tạm dừng'
                      : activeResource.id === 1
                        ? 'Phát video hướng dẫn'
                        : 'Bắt đầu hướng dẫn'}{' '}
                    <span aria-hidden="true">{exerciseActive ? 'Ⅱ' : '▶'}</span>
                  </button>
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
