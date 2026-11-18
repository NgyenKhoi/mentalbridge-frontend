// Mirrors the web catalogue artwork rules and uses the original web assets.
import type { ResourceSummary } from './resource-contract'

type ResourceArtwork = Readonly<{
  src: number
  alt: string
  position?: string
}>

const artworks = {
  breathing: {
    src: require('../../assets/resource-covers/resource-breathing.webp'),
    alt: 'Ngồi thở chậm với tay đặt trên ngực và bụng',
    position: '50% 42%',
  },
  mindfulness: {
    src: require('../../assets/resource-covers/resource-mindfulness.webp'),
    alt: 'Quan sát chiếc lá trong một khoảng nghỉ bên cửa sổ',
    position: '50% 40%',
  },
  stretch: {
    src: require('../../assets/resource-covers/resource-stretch.webp'),
    alt: 'Vươn tay và giãn nhẹ cơ thể bên cửa sổ',
    position: '50% 42%',
  },
  problem: {
    src: require('../../assets/resource-covers/resource-problem-solving.webp'),
    alt: 'Chia một vấn đề thành những bước nhỏ trên trang giấy',
    position: '50% 45%',
  },
  relaxation: {
    src: require('../../assets/resource-covers/resource-pmr.webp'),
    alt: 'Nằm nghỉ và thả lỏng cơ thể trong căn phòng yên tĩnh',
    position: '50% 52%',
  },
  sleep: {
    src: require('../../assets/resource-covers/resource-sleep.webp'),
    alt: 'Chuẩn bị giờ nghỉ với một cuốn sách và ánh đèn dịu bên giường',
    position: '50% 45%',
  },
  emotions: {
    src: require('../../assets/resource-covers/resource-understanding-emotions.webp'),
    alt: 'Dành một khoảng lặng bên cửa sổ để lắng nghe cảm xúc của mình',
    position: '50% 40%',
  },
  steps: {
    src: require('../../assets/resource-covers/resource-small-steps.webp'),
    alt: 'Bắt đầu bằng việc nhỏ: nhẹ nhàng chăm sóc một chậu cây',
    position: '50% 45%',
  },
  specialist: {
    src: require('../../assets/resource-covers/resource-specialist-prep.jpg'),
    alt: 'Chuẩn bị câu hỏi và ghi chép trước buổi trao đổi với chuyên gia',
    position: '50% 45%',
  },
} as const satisfies Record<string, ResourceArtwork>

const titleArtworks = [
  [/thở|hơi thở/, artworks.breathing],
  [/nhận biết hiện tại|chánh niệm|thiền/, artworks.mindfulness],
  [/giãn cơ|đổi tư thế/, artworks.stretch],
  [/giải quyết.*vấn đề/, artworks.problem],
  [/thư giãn cơ|thả lỏng cơ/, artworks.relaxation],
  [/giấc ngủ|nhịp ngủ|ngủ|nghỉ ngơi/, artworks.sleep],
  [/trầm cảm|lo âu|lo lắng|nỗi lo|cảm xúc|căng thẳng/, artworks.emotions],
  [/hoạt động nhỏ|bước nhỏ|vận động|đi bộ/, artworks.steps],
  [/chuyên gia|bác sĩ|tư vấn|trao đổi/, artworks.specialist],
] as const

const categoryArtworks = {
  ARTICLE: artworks.problem,
  VIDEO: artworks.relaxation,
  BREATHING: artworks.breathing,
  MEDITATION: artworks.mindfulness,
  JOURNALING: artworks.problem,
  COMMUNITY: artworks.steps,
} satisfies Record<ResourceSummary['category'], ResourceArtwork>

export function resourceArtwork(
  resource: Pick<ResourceSummary, 'title' | 'category'>,
): ResourceArtwork {
  const title = resource.title.toLocaleLowerCase('vi-VN')
  return (
    titleArtworks.find(([pattern]) => pattern.test(title))?.[1] ??
    categoryArtworks[resource.category]
  )
}
