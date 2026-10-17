export const followUpPopupPreview = {
  encouragement: {
    commitment: 'Vệ sinh giấc ngủ & Bài tập thở chậm 4–7–8',
    attachments: [
      { title: 'Thở chậm 4–7–8', duration: '3 phút' },
      { title: 'Thư giãn cơ PMR', duration: '7 phút' },
    ],
    templates: [
      { title: 'Động viên nhẹ nhàng & Không áp lực', tag: 'Thấu cảm', body: 'Chào Lan, bác sĩ thấy bạn chưa cập nhật nhật ký 3 ngày qua. Đừng lo lắng nếu việc duy trì có lúc bị gián đoạn, bạn có thể bắt đầu lại với chỉ bài tập thở ngắn 3 phút tối nay nhé!' },
      { title: 'Kiểm tra trở ngại thực tế', tag: 'Lắng nghe', body: 'Chào Lan, mình hiểu tuần này có thể nhiều áp lực. Có điều gì đang gây khó khăn cho việc dành thời gian nghỉ ngơi của bạn không? Cứ nhắn cho bác sĩ nếu cần điều chỉnh lộ trình nhé.' },
      { title: 'Nhắc nhớ phiên sắp tới & Bài tập chuẩn bị', tag: 'Định hướng', body: 'Chào Lan, hẹn gặp bạn ở phiên sắp tới. Trước buổi gặp, bạn thử thực hiện bài thư giãn ngắn và ghi lại cảm nhận để chúng ta cùng xem lại nhé.' },
    ],
    quick: ['Ấm áp', 'Lời khích lệ', 'Thở chậm 4–7–8', 'Thư giãn cơ PMR'],
  },
  session: {
    assessmentName: 'WHO-5 · Mức độ khỏe tinh thần',
    score: '18 / 25',
    improvement: 'Tăng 7 điểm so với lần trước',
    completion: '92%',
    previousScore: '11 / 25',
    updatedAt: '08:42 hôm nay',
    journal: 'Trong ba tuần vừa qua, việc thực hành thư giãn trước giờ ngủ giúp tôi cảm thấy dễ nghỉ ngơi hơn. Tôi muốn trao đổi cách duy trì thói quen này khi lịch làm việc thay đổi.',
    questions: [
      'Làm thế nào để duy trì thói quen tập thở khi bắt đầu quay lại công tác dài ngày?',
      'Tôi có cần duy trì nhật ký suy nghĩ mỗi ngày sau khi kết thúc đợt theo dõi không?',
    ],
    note: 'Tổng kết tiến trình, hỏi thêm về những thay đổi trong sinh hoạt và cùng khách hàng thống nhất bước tiếp theo.',
  },
  summary: {
    sessionDate: '12/10/2026',
    recordId: '#MB-CLI-7740',
    gadScore: '12/21',
    journalFrequency: '2/7 ngày',
    adherence: '33%',
    quote: 'Tôi cảm thấy não bộ không thể tắt công tắc suy nghĩ dù cơ thể đã kiệt sức.',
    subjective: 'Khách hàng chia sẻ khó vào giấc trong những ngày công việc căng thẳng. Việc ghi lại cảm nhận sau khi thức dậy giúp nhận biết rõ hơn các thời điểm cần nghỉ ngơi.',
    objective: 'Khách hàng tham gia đầy đủ phiên trao đổi và đã hoàn tất hai hoạt động được thống nhất giữa các phiên.',
    assessment: 'Tiến độ được ghi nhận từ nội dung khách hàng chia sẻ và bài tập trong bản xem trước. Cần tiếp tục trao đổi ở phiên tới.',
    plan: 'Tiếp tục ghi nhật ký ngắn, thực hành bài thở trước giờ ngủ và cùng xem lại hiệu quả trong phiên tiếp theo.',
  },
  exercises: [
    { title: 'Vệ sinh giấc ngủ: Ngắt kết nối thiết bị sau 22:30', detail: 'Đặt điện thoại ngoài tầm với của giường và chuyển sang hoạt động thư giãn.', status: 'Đã thực hiện 5/7 ngày' },
    { title: 'Thực hành thở thư giãn nhịp 4–7–8 trước khi ngủ', detail: 'Thực hiện chậm theo nhịp thở phù hợp và ghi lại cảm nhận sau bài tập.', status: 'Chưa ghi nhận hôm nay' },
    { title: 'Nhật ký suy nghĩ khi thức giấc giữa đêm', detail: 'Ghi lại suy nghĩ ngắn gọn để trao đổi trong phiên tới.', status: 'Cần xem lại cách ghi' },
  ],
} as const
