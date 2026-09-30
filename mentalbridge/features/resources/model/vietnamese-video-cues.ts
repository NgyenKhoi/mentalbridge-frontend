export type VietnameseVideoCue = Readonly<{
  startSeconds: number
  endSeconds: number
  text: string
}>

const cuesByVideoId: Readonly<Record<string, readonly VietnameseVideoCue[]>> = {
  wfDTp2GogaQ: [
    {
      startSeconds: 0,
      endSeconds: 18,
      text: 'Chọn một tư thế thoải mái và cho phép cơ thể chậm lại.',
    },
    {
      startSeconds: 18,
      endSeconds: 40,
      text: 'Đưa sự chú ý về hơi thở, không cần cố thay đổi nó ngay.',
    },
    {
      startSeconds: 40,
      endSeconds: 64,
      text: 'Hít vào nhẹ nhàng và nhận biết không khí đang đi vào cơ thể.',
    },
    {
      startSeconds: 64,
      endSeconds: 88,
      text: 'Thở ra chậm hơn một chút, thả lỏng vai và khuôn mặt.',
    },
    {
      startSeconds: 88,
      endSeconds: 114,
      text: 'Khi tâm trí đi xa, chỉ cần nhận ra rồi dịu dàng quay lại hơi thở.',
    },
    {
      startSeconds: 114,
      endSeconds: 142,
      text: 'Tiếp tục theo nhịp dễ chịu của bạn và dừng lại nếu thấy không khỏe.',
    },
  ],
  tfkhkFwCtxs: [
    {
      startSeconds: 0,
      endSeconds: 16,
      text: 'Một suy nghĩ khó chịu không phải lúc nào cũng phản ánh toàn bộ sự thật.',
    },
    {
      startSeconds: 16,
      endSeconds: 36,
      text: 'Dừng lại và gọi tên suy nghĩ đang khiến bạn thấy nặng nề.',
    },
    {
      startSeconds: 36,
      endSeconds: 58,
      text: 'Xem điều gì ủng hộ suy nghĩ đó và điều gì cho thấy bức tranh còn thiếu.',
    },
    {
      startSeconds: 58,
      endSeconds: 80,
      text: 'Thử diễn đạt lại theo cách cân bằng, thực tế và tử tế hơn với mình.',
    },
    {
      startSeconds: 80,
      endSeconds: 102,
      text: 'Luyện tập từng lần nhỏ để việc nhìn lại suy nghĩ trở nên tự nhiên hơn.',
    },
  ],
  '9GURt2pvdAg': [
    {
      startSeconds: 0,
      endSeconds: 42,
      text: 'Tìm một tư thế được nâng đỡ tốt; bỏ qua vùng đang đau hoặc chấn thương.',
    },
    {
      startSeconds: 42,
      endSeconds: 92,
      text: 'Thở chậm và để ý sự khác nhau giữa cảm giác căng và thả lỏng.',
    },
    {
      startSeconds: 92,
      endSeconds: 160,
      text: 'Làm căng nhẹ bàn tay và cánh tay, sau đó thả ra hoàn toàn.',
    },
    {
      startSeconds: 160,
      endSeconds: 230,
      text: 'Chuyển sự chú ý lên vai và khuôn mặt; không cần gồng quá mạnh.',
    },
    {
      startSeconds: 230,
      endSeconds: 310,
      text: 'Nhận biết vùng ngực và bụng, rồi để cơ thể mềm lại khi thở ra.',
    },
    {
      startSeconds: 310,
      endSeconds: 400,
      text: 'Tiếp tục với chân và bàn chân theo mức độ an toàn, dễ chịu với bạn.',
    },
    {
      startSeconds: 400,
      endSeconds: 485,
      text: 'Quan sát toàn bộ cơ thể và những vùng đang cảm thấy thư giãn hơn.',
    },
    {
      startSeconds: 485,
      endSeconds: 536,
      text: 'Từ từ đưa sự chú ý trở lại căn phòng trước khi kết thúc bài tập.',
    },
  ],
}

export function vietnameseVideoCues(
  value: string | null | undefined,
): readonly VietnameseVideoCue[] {
  if (!value) return []
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, '')
    const videoId =
      host === 'youtu.be'
        ? url.pathname.split('/').filter(Boolean)[0]
        : url.pathname.startsWith('/embed/')
          ? url.pathname.split('/')[2]
          : url.searchParams.get('v')
    return videoId ? (cuesByVideoId[videoId] ?? []) : []
  } catch {
    return []
  }
}
