import type { PublicResourceSummary } from '../api/browser-resources'

type ResourceArtwork = Readonly<{
  src: string
  alt: string
  position?: string
}>

const artworks = {
  breathing: {
    src: '/images/resource-breathing.webp',
    alt: 'Ngồi thở chậm với tay đặt trên ngực và bụng',
    position: '50% 42%',
  },
  mindfulness: {
    src: '/images/resource-mindfulness.webp',
    alt: 'Quan sát chiếc lá trong một khoảng nghỉ bên cửa sổ',
    position: '50% 40%',
  },
  stretch: {
    src: '/images/resource-stretch.webp',
    alt: 'Vươn tay và giãn nhẹ cơ thể bên cửa sổ',
    position: '50% 42%',
  },
  problem: {
    src: '/images/resource-problem-solving.webp',
    alt: 'Chia một vấn đề thành những bước nhỏ trên trang giấy',
    position: '50% 45%',
  },
  relaxation: {
    src: '/images/resource-pmr.webp',
    alt: 'Nằm nghỉ và thả lỏng cơ thể trong căn phòng yên tĩnh',
    position: '50% 52%',
  },
  sleep: {
    src: '/images/resource-sleep.webp',
    alt: 'Chuẩn bị giờ nghỉ với một cuốn sách và ánh đèn dịu bên giường',
    position: '50% 45%',
  },
  emotions: {
    src: '/images/resource-understanding-emotions.webp',
    alt: 'Dành một khoảng lặng bên cửa sổ để lắng nghe cảm xúc của mình',
    position: '50% 40%',
  },
  steps: {
    src: '/images/resource-small-steps.webp',
    alt: 'Bắt đầu bằng việc nhỏ: nhẹ nhàng chăm sóc một chậu cây',
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
  [/trầm cảm|lo âu|cảm xúc|căng thẳng/, artworks.emotions],
  [/hoạt động nhỏ|bước nhỏ|vận động|đi bộ/, artworks.steps],
] as const

const categoryArtworks = {
  ARTICLE: artworks.problem,
  VIDEO: artworks.relaxation,
  BREATHING: artworks.breathing,
  MEDITATION: artworks.mindfulness,
  JOURNALING: artworks.problem,
  COMMUNITY: artworks.steps,
} satisfies Record<PublicResourceSummary['category'], ResourceArtwork>

export function resourceArtwork(
  resource: Pick<PublicResourceSummary, 'title' | 'category'>,
): ResourceArtwork {
  const title = resource.title.toLocaleLowerCase('vi-VN')
  return (
    titleArtworks.find(([pattern]) => pattern.test(title))?.[1] ??
    categoryArtworks[resource.category]
  )
}
