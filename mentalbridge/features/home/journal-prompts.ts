export const HOME_JOURNAL_PROMPTS = [
  'Điều nhỏ nào hôm nay khiến bạn thấy dễ chịu hơn một chút?',
  'Lúc này, bạn muốn dành vài dòng cho điều gì?',
  'Hôm nay bạn đã dành thời gian cho mình như thế nào?',
  'Có điều gì bạn muốn đặt xuống trang giấy hôm nay?',
  'Một khoảnh khắc bạn muốn nhớ lại hôm nay là gì?',
  'Bạn đang cần thêm điều gì cho ngày hôm nay?',
  'Bạn muốn nói điều gì với chính mình lúc này?',
] as const

export function homeJournalPrompt(date: Date) {
  // Local calendar days, without DST or elapsed-hour drift.
  const day = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  )
  return HOME_JOURNAL_PROMPTS[((day % 7) + 7) % 7]
}
