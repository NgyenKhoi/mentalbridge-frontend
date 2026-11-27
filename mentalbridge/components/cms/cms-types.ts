import type { ResourceCategory } from '@/lib/api/admin-resources'

export type CmsBlockType =
  | 'hero'
  | 'breathing'
  | 'video'
  | 'checklist'
  | 'quote'
  | 'safety'
  | 'audio'
  | 'mood_slider'
  | 'evidence'

export type CmsBlockCategory =
  'all' | 'content' | 'interactive' | 'media' | 'safety'

export type BlockLibraryCardDef = {
  id: CmsBlockType
  number: number
  title: string
  group: CmsBlockCategory
  badge: string
  badgeTone?: 'neutral' | 'success' | 'warning' | 'danger' | 'purple'
  description: string
  subText?: string
  isRequired?: boolean
}

export const BLOCK_LIBRARY_ITEMS: BlockLibraryCardDef[] = [
  {
    id: 'hero',
    number: 1,
    title: 'Khối 1: Hero & Thông tin tổng quan',
    group: 'content',
    badge: 'Cơ bản',
    badgeTone: 'neutral',
    description:
      'Giúp hiển thị tiêu đề, thẻ tóm tắt dịu dàng, thời lượng thực hành và ảnh bìa để người bệnh định hình bài tập.',
    subText: 'Hiển thị mặc định đầu bài',
  },
  {
    id: 'breathing',
    number: 2,
    title: 'Khối 2: Công cụ tương tác nhịp thở',
    group: 'interactive',
    badge: 'Tương tác',
    badgeTone: 'success',
    description:
      'Mô phỏng nhịp hít/giữ/thở nhịp Coherence Breathing, tự động đếm vòng giúp xoa dịu hệ thần kinh giao cảm.',
    subText: 'Hỗ trợ tính chu kỳ y tế chuẩn',
  },
  {
    id: 'video',
    number: 3,
    title: 'Khối 3: Video hướng dẫn & Mốc thời gian',
    group: 'media',
    badge: 'Đa phương tiện',
    badgeTone: 'purple',
    description:
      'Nhúng video chuẩn y khoa, chia phân đoạn từng bước kèm mốc giây cụ thể để người bệnh dễ dàng làm theo.',
    subText: 'Hỗ trợ HLS / MP4',
  },
  {
    id: 'checklist',
    number: 4,
    title: 'Khối 4: Danh sách bước thực hành (Checklist)',
    group: 'interactive',
    badge: 'Hành động',
    badgeTone: 'success',
    description:
      'Chia nhỏ thao tác thành từng bước vi mô rõ ràng, tránh quá tải nhận thức cho thân chủ khi lo âu.',
    subText: 'Chuẩn 2 ô nhập tên & mô tả',
  },
  {
    id: 'audio',
    number: 5,
    title: 'Khối 5: Âm thanh trị liệu kèm theo',
    group: 'media',
    badge: 'Thư giãn',
    badgeTone: 'purple',
    description:
      'Tích hợp audio sóng não 432Hz, tiếng mưa rừng giúp tăng độ sâu khi thư giãn và giải tỏa áp lực thần kinh.',
    subText: 'Trình phát nền êm dịu',
  },
  {
    id: 'mood_slider',
    number: 6,
    title: 'Khối 6: Thước đo cảm xúc trước/sau (Mood Slider)',
    group: 'interactive',
    badge: 'Đo lường',
    badgeTone: 'success',
    description:
      'Ghi nhận mức độ căng thẳng/nhẹ nhõm trước và sau khi thực hành, cung cấp dữ liệu tiến trình điều trị.',
    subText: 'Thang đo VAS 10 điểm',
  },
  {
    id: 'quote',
    number: 7,
    title: 'Khối 7: Lời khuyên chánh niệm & Trích dẫn',
    group: 'content',
    badge: 'Tùy chọn',
    badgeTone: 'neutral',
    description:
      'Thông điệp tích cực nuôi dưỡng tinh thần cho thân chủ trong khi tập, nâng đỡ tâm lý nhẹ nhàng.',
    subText: 'Trích dẫn & Tác giả',
  },
  {
    id: 'safety',
    number: 8,
    title: 'Khối 8: Lưu ý an toàn',
    group: 'safety',
    badge: '🔒 Bắt buộc',
    badgeTone: 'danger',
    description: 'Hiển thị lưu ý an toàn dành riêng cho tài nguyên đang soạn.',
    isRequired: true,
  },
  {
    id: 'evidence',
    number: 9,
    title: 'Khối 9: Nguồn tham khảo',
    group: 'safety',
    badge: 'Minh bạch',
    badgeTone: 'neutral',
    description: 'Hiển thị tên đơn vị và liên kết nguồn của tài nguyên.',
  },
]

export type PresetTemplateDef = {
  id: string
  name: string
  badge: string
  description: string
  blocks: CmsBlockType[]
}

export const PRESET_TEMPLATES: PresetTemplateDef[] = [
  {
    id: 'breathing_preset',
    name: 'Gói 1: Bài tập thở chánh niệm (Mindful Breathing)',
    badge: 'Khuyến nghị lâm sàng',
    description:
      'Tự động lắp Khối 1 (Hero) + Khối 2 (Nhịp thở) + Khối 4 (Checklist 3 bước) + Khối 8 (An toàn y tế). Tối ưu điều hòa nhịp tim và giảm lo âu cấp.',
    blocks: ['hero', 'breathing', 'checklist', 'safety'],
  },
  {
    id: 'video_preset',
    name: 'Gói 2: Video hướng dẫn vận động vi mô (Micro-movement)',
    badge: 'Phân đoạn mốc thời gian',
    description:
      'Tự động lắp Khối 1 (Hero) + Khối 3 (Video timeline) + Khối 4 (Checklist) + Khối 8 (An toàn) + Khối 9 (Nguồn NHS). Phù hợp bài tập vận động, giãn cơ.',
    blocks: ['hero', 'video', 'checklist', 'safety', 'evidence'],
  },
  {
    id: 'reading_preset',
    name: 'Gói 3: Bài đọc vỗ về & Thư giãn (Calm Reading & Sound)',
    badge: 'Nuôi dưỡng cảm xúc',
    description:
      'Tự động lắp Khối 1 (Hero) + Khối 5 (Audio sóng não) + Khối 7 (Trích dẫn) + Khối 8 (An toàn). Phù hợp thư giãn buổi tối, hỗ trợ giấc ngủ ngon.',
    blocks: ['hero', 'audio', 'quote', 'safety'],
  },
]

export type MilestoneItem = {
  id: string
  time: string
  label: string
}

export type ChecklistStepItem = {
  id: string
  name: string
  description: string
}

export type CmsEditorState = {
  // Metadata & hero
  title: string
  shortSummary: string
  category: ResourceCategory
  practiceLevel: 'EASY' | 'MODERATE' | 'CHALLENGING' | ''
  durationSeconds: number
  tags: string[]
  coverUrl: string
  altText: string

  // Breathing params
  inhaleSeconds: number
  holdSeconds: number
  exhaleSeconds: number
  breathingStyle: 'lotus' | 'digital'
  previewCycle: boolean

  // Video params
  videoUrl: string
  videoMilestones: MilestoneItem[]

  // Checklist
  checklistSteps: ChecklistStepItem[]

  // Quote
  quoteText: string
  quoteAuthor: string

  // Safety (central config)
  safetyNotesText: string

  // Audio
  audioTitle: string
  audioFrequency: string
  audioDefaultVolume: number

  // Mood slider
  moodScaleMin: string
  moodScaleMax: string

  // Evidence
  sourceOrg: string
  sourceDocTitle: string
  sourceUrl: string
  sourceRetrievedDate: string
  sourceReviewPeriod: string
  sourceSha256: string
  sourceVerified: boolean

  // Workflow state
  status: 'DRAFT' | 'CLINICAL_REVIEW' | 'MEDICAL_APPROVED' | 'PUBLISHED'
  activeBlocks: CmsBlockType[]
}
