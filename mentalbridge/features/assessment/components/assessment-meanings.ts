import type {
  Instrument,
  ScreeningLevel,
} from '@/features/assessment/api/care-contract'

export const levelLabels: Record<ScreeningLevel, string> = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Nặng',
}

export function getLevelClass(level?: ScreeningLevel) {
  switch (level) {
    case 'MINIMAL':
      return 'level-minimal'
    case 'MILD':
      return 'level-mild'
    case 'MODERATE':
      return 'level-moderate'
    case 'MODERATELY_SEVERE':
      return 'level-moderately-severe'
    case 'SEVERE':
      return 'level-severe'
    default:
      return 'level-none'
  }
}

export function formatShortDateTime(isoString: string): string {
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const day = date.getDate()
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  return `${hours}:${minutes} · ${day}/${month}/${year}`
}

export function friendlyDuration(duration: string): string {
  if (!duration) return 'dưới 1 phút'
  const match = duration.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d{1,9})?)S)?)?$/,
  )
  if (!match) return duration
  const daysFromP = Number(match[1] ?? 0)
  const hours = Number(match[2] ?? 0)
  const minutes = Number(match[3] ?? 0)
  const totalDays = daysFromP + Math.floor(hours / 24)
  const remHours = hours % 24

  if (totalDays > 0) {
    return `${totalDays} ngày`
  }
  if (remHours > 0) {
    if (minutes > 0) {
      return `${remHours} giờ ${minutes} phút`
    }
    return `${remHours} giờ`
  }
  if (minutes > 0) {
    return `${minutes} phút`
  }
  return 'dưới 1 phút'
}

export type ScreeningMeaning = Readonly<{ text: string; limitation: string }>

export const screeningMeanings: Readonly<
  Record<Instrument, Record<ScreeningLevel, ScreeningMeaning>>
> = {
  PHQ9: {
    MINIMAL: {
      text: 'Trong 14 ngày qua, các câu trả lời PHQ-9 của bạn cho thấy ít hoặc không có dấu hiệu đáng kể liên quan đến tâm trạng, hứng thú, giấc ngủ, năng lượng hoặc sinh hoạt. Kết quả cho thấy sức khỏe tinh thần của bạn đang ở trạng thái ổn định.',
      limitation:
        'Kết quả này chỉ dựa trên câu trả lời tự khai của bạn trong 14 ngày qua. Bài sàng lọc không xác định nguyên nhân, không bao quát toàn bộ hoàn cảnh của bạn và không phải là chẩn đoán y khoa. Nếu những điều bạn đang trải qua khiến bạn lo lắng hoặc ảnh hưởng đến cuộc sống hằng ngày, bạn có thể cân nhắc trao đổi với một chuyên gia phù hợp.',
    },
    MILD: {
      text: 'Trong 14 ngày qua, các câu trả lời PHQ-9 của bạn cho thấy một số dấu hiệu nhẹ liên quan đến tâm trạng, hứng thú, giấc ngủ, năng lượng hoặc sinh hoạt. Những trải nghiệm này có thể đáng để bạn quan tâm hơn, đặc biệt nếu chúng kéo dài.',
      limitation:
        'Kết quả này chỉ dựa trên câu trả lời tự khai của bạn trong 14 ngày qua. Bài sàng lọc không xác định nguyên nhân, không bao quát toàn bộ hoàn cảnh của bạn và không phải là chẩn đoán y khoa. Nếu những điều bạn đang trải qua khiến bạn lo lắng hoặc ảnh hưởng đến cuộc sống hằng ngày, bạn có thể cân nhắc trao đổi với một chuyên gia phù hợp.',
    },
    MODERATE: {
      text: 'Trong 14 ngày qua, các câu trả lời PHQ-9 của bạn cho thấy nhiều dấu hiệu liên quan đến tâm trạng, hứng thú, giấc ngủ, năng lượng hoặc sinh hoạt ở mức trung bình. Những trải nghiệm này có thể đáng để bạn quan tâm hơn, nhất là khi chúng làm gián đoạn giấc ngủ, khả năng tập trung, công việc, học tập hoặc các mối quan hệ.',
      limitation:
        'Kết quả này chỉ dựa trên câu trả lời tự khai của bạn trong 14 ngày qua. Bài sàng lọc không xác định nguyên nhân, không bao quát toàn bộ hoàn cảnh của bạn và không phải là chẩn đoán y khoa. Nếu những điều bạn đang trải qua khiến bạn lo lắng hoặc ảnh hưởng đến cuộc sống hằng ngày, bạn có thể cân nhắc trao đổi với một chuyên gia phù hợp.',
    },
    MODERATELY_SEVERE: {
      text: 'Trong 14 ngày qua, các câu trả lời PHQ-9 của bạn cho thấy nhiều dấu hiệu liên quan đến tâm trạng, hứng thú, giấc ngủ, năng lượng hoặc sinh hoạt ở mức khá nặng. Kết quả cho thấy bạn đang ghi nhận khó khăn ở nhiều nội dung của bài sàng lọc; chủ động tìm một người có chuyên môn để trao đổi có thể giúp bạn hiểu rõ hơn điều mình đang trải qua.',
      limitation:
        'Kết quả này chỉ dựa trên câu trả lời tự khai của bạn trong 14 ngày qua. Bài sàng lọc không xác định nguyên nhân, không bao quát toàn bộ hoàn cảnh của bạn và không phải là chẩn đoán y khoa. Nếu những điều bạn đang trải qua khiến bạn lo lắng hoặc ảnh hưởng đến cuộc sống hằng ngày, bạn có thể cân nhắc trao đổi với một chuyên gia phù hợp.',
    },
    SEVERE: {
      text: 'Trong 14 ngày qua, các câu trả lời PHQ-9 của bạn cho thấy nhiều dấu hiệu nghiêm trọng liên quan đến tâm trạng, hứng thú, giấc ngủ, năng lượng hoặc sinh hoạt. Kết quả cho thấy bạn đang ghi nhận khó khăn đáng kể ở hầu hết nội dung; việc liên hệ với chuyên gia sức khỏe tinh thần có thể giúp bạn nhận được hỗ trợ kịp thời.',
      limitation:
        'Kết quả này chỉ dựa trên câu trả lời tự khai của bạn trong 14 ngày qua. Bài sàng lọc không xác định nguyên nhân, không bao quát toàn bộ hoàn cảnh của bạn và không phải là chẩn đoán y khoa. Nếu những điều bạn đang trải qua khiến bạn lo lắng hoặc ảnh hưởng đến cuộc sống hằng ngày, bạn có thể cân nhắc trao đổi với một chuyên gia phù hợp.',
    },
  },
  GAD7: {
    MINIMAL: {
      text: 'Trong 14 ngày qua, các câu trả lời GAD-7 của bạn cho thấy ít hoặc không có dấu hiệu đáng kể liên quan đến lo lắng, căng thẳng hoặc khó thư giãn. Kết quả cho thấy bạn đang ở trạng thái tương đối bình ổn về mặt lo âu.',
      limitation:
        'Kết quả này chỉ dựa trên câu trả lời tự khai của bạn trong 14 ngày qua. Bài sàng lọc không xác định nguyên nhân, không bao quát toàn bộ hoàn cảnh của bạn và không phải là chẩn đoán y khoa. Nếu những điều bạn đang trải qua khiến bạn lo lắng hoặc ảnh hưởng đến cuộc sống hằng ngày, bạn có thể cân nhắc trao đổi với một chuyên gia phù hợp.',
    },
    MILD: {
      text: 'Trong 14 ngày qua, các câu trả lời GAD-7 của bạn cho thấy một số dấu hiệu nhẹ liên quan đến lo lắng, căng thẳng hoặc khó thư giãn. Những trải nghiệm này có thể đáng để bạn lưu ý, đặc biệt nếu chúng bắt đầu ảnh hưởng đến giấc ngủ hoặc sinh hoạt hàng ngày.',
      limitation:
        'Kết quả này chỉ dựa trên câu trả lời tự khai của bạn trong 14 ngày qua. Bài sàng lọc không xác định nguyên nhân, không bao quát toàn bộ hoàn cảnh của bạn và không phải là chẩn đoán y khoa. Nếu những điều bạn đang trải qua khiến bạn lo lắng hoặc ảnh hưởng đến cuộc sống hằng ngày, bạn có thể cân nhắc trao đổi với một chuyên gia phù hợp.',
    },
    MODERATE: {
      text: 'Trong 14 ngày qua, các câu trả lời GAD-7 của bạn cho thấy nhiều dấu hiệu như lo lắng, căng thẳng hoặc khó thư giãn ở mức trung bình. Những trải nghiệm này có thể đáng để bạn quan tâm hơn, nhất là khi chúng làm gián đoạn giấc ngủ, khả năng tập trung, công việc, học tập hoặc các mối quan hệ.',
      limitation:
        'Kết quả này chỉ dựa trên câu trả lời tự khai của bạn trong 14 ngày qua. Bài sàng lọc không xác định nguyên nhân, không bao quát toàn bộ hoàn cảnh của bạn và không phải là chẩn đoán y khoa. Nếu những điều bạn đang trải qua khiến bạn lo lắng hoặc ảnh hưởng đến cuộc sống hằng ngày, bạn có thể cân nhắc trao đổi với một chuyên gia phù hợp.',
    },
    MODERATELY_SEVERE: {
      text: 'Trong 14 ngày qua, các câu trả lời GAD-7 của bạn cho thấy nhiều dấu hiệu như lo lắng, căng thẳng hoặc khó thư giãn ở mức khá nặng. Kết quả cho thấy bạn đang ghi nhận khó khăn ở nhiều nội dung; chủ động tìm một người có chuyên môn để trao đổi có thể giúp bạn hiểu rõ hơn điều mình đang trải qua.',
      limitation:
        'Kết quả này chỉ dựa trên câu trả lời tự khai của bạn trong 14 ngày qua. Bài sàng lọc không xác định nguyên nhân, không bao quát toàn bộ hoàn cảnh của bạn và không phải là chẩn đoán y khoa. Nếu những điều bạn đang trải qua khiến bạn lo lắng hoặc ảnh hưởng đến cuộc sống hằng ngày, bạn có thể cân nhắc trao đổi với một chuyên gia phù hợp.',
    },
    SEVERE: {
      text: 'Trong 14 ngày qua, các câu trả lời GAD-7 của bạn cho thấy nhiều dấu hiệu nghiêm trọng liên quan đến lo lắng, căng thẳng hoặc khó thư giãn. Kết quả cho thấy bạn đang ghi nhận khó khăn đáng kể; việc liên hệ với chuyên gia sức khỏe tinh thần có thể giúp bạn nhận được hỗ trợ kịp thời.',
      limitation:
        'Kết quả này chỉ dựa trên câu trả lời tự khai của bạn trong 14 ngày qua. Bài sàng lọc không xác định nguyên nhân, không bao quát toàn bộ hoàn cảnh của bạn và không phải là chẩn đoán y khoa. Nếu những điều bạn đang trải qua khiến bạn lo lắng hoặc ảnh hưởng đến cuộc sống hằng ngày, bạn có thể cân nhắc trao đổi với một chuyên gia phù hợp.',
    },
  },
}
