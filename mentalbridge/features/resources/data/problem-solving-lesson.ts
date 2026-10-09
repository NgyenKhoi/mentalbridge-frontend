/**
 * ==============================================================================
 * CẤU HÌNH BÀI HỌC "GIẢI QUYẾT MỘT VẤN ĐỀ THEO TỪNG BƯỚC" (CBT PROBLEM SOLVING)
 * ==============================================================================
 *
 * ĐÂY LÀ FILE CẤU HÌNH DUY NHẤT chứa toàn bộ dữ liệu video, danh sách các bước lộ trình,
 * mốc thời gian, lời khuyên chuyên gia CBT và câu hỏi thực hành.
 *
 * ------------------------------------------------------------------------------
 * HƯỚNG DẪN DÀNH CHO BẠN KHI CẬP NHẬT VIDEO THẬT:
 * ------------------------------------------------------------------------------
 * 1. Đặt đường dẫn video thật vào thuộc tính `videoSrc` bên dưới.
 *    - Ví dụ video cục bộ: '/videos/problem-solving-cbt.mp4'
 *    - Hoặc link trực tuyến: 'https://cdn.mentalbridge.vn/videos/problem-solving.mp4'
 *
 * 2. Cách trích xuất mốc thời gian (start - end) tự động nếu bạn chưa có mốc:
 *    a) Sử dụng FFmpeg để phát hiện các phân cảnh (scene detection):
 *       ffmpeg -i video.mp4 -filter:v "select='gt(scene,0.4)',showinfo" -f null -
 *
 *    b) Sử dụng OpenAI Whisper để tự động nhận dạng giọng nói & xuất phụ đề tiếng Việt kèm timestamp:
 *       whisper video.mp4 --model small --language vi --output_format srt
 *       Sau đó mở file .srt để xem chính xác giây bắt đầu và kết thúc của mỗi bước.
 *
 * 3. Cập nhật lại mảng `steps` bên dưới cho khớp với số bước và thời gian trong video thật.
 * ==============================================================================
 */

export type LessonStepTip = Readonly<{
  heading: string
  lead: string
  bullets: readonly string[]
}>

export type LessonStepPracticePrompt = Readonly<{
  stepLabel: string
  question: string
  placeholder: string
}>

export type LessonStep = Readonly<{
  id: string
  stepNumber: number // 1, 2, 3...
  title: string
  summary: string
  start: number // giây bắt đầu (tính từ 0)
  end: number   // giây kết thúc (mốc mở: start <= t < end)
  tip: LessonStepTip
  practicePrompt?: LessonStepPracticePrompt
}>

export type ProblemSolvingLessonConfig = Readonly<{
  resourceId: string
  title: string
  summary: string
  categoryLabel: string
  difficultyLabel: string
  frameworkTag: string
  // Đường dẫn video: bạn hãy thay đổi giá trị này khi có video thật
  videoSrc: string
  // Poster dự phòng cho video
  videoPoster: string
  // Tài liệu PDF đính kèm để tải về
  worksheetPdf: {
    title: string
    subtitle: string
    fileName: string
    fileSizeLabel: string
    href: string
  }
  // Danh sách các bước trong lộ trình video
  steps: readonly LessonStep[]
}>

export const problemSolvingLessonConfig: ProblemSolvingLessonConfig = {
  resourceId: '00000000-0000-4000-8000-000000000209',
  title: 'Giải quyết một vấn đề theo từng bước',
  summary:
    'Sắp xếp và phân tách vấn đề thành từng bước nhỏ có thể hành động để giảm cảm giác quá tải và lấy lại quyền kiểm soát.',
  categoryLabel: 'Video hướng dẫn',
  difficultyLabel: 'Nhẹ nhàng',
  frameworkTag: 'Kỹ năng tư duy CBT',

  /**
   * Video chính thức của bài học:
   * Được kết xuất từ Remotion Studio với chuẩn âm thanh & đồ họa CBT MentalBridge
   */
  videoSrc: '/videos/giai-quyet-van-de-cbt.mp4',

  /**
   * Poster hiển thị trước khi phát video (khung hình chính thức của bài học CBT)
   */
  videoPoster: '/images/problem-solving-cbt-poster.png',

  worksheetPdf: {
    title: 'Biểu mẫu 5 bước (PDF)',
    subtitle: 'In ra hoặc ghi chép tay (A4 · 240 KB)',
    fileName: 'MentalBridge-Problem-Solving-5-Steps-Worksheet.pdf',
    fileSizeLabel: 'A4 · 240 KB',
    href: '#download-pdf',
  },

  /**
   * LỘ TRÌNH 5 BƯỚC ĐỒNG BỘ CHÍNH XÁC VỚI VIDEO THỰC TẾ:
   * Video dài 100 giây (01:40), phân đoạn từng bước rõ ràng:
   * - Bước 1: 00:00 -> 00:30 (30 giây)
   * - Bước 2: 00:30 -> 00:45 (15 giây)
   * - Bước 3: 00:45 -> 01:00 (15 giây)
   * - Bước 4: 01:00 -> 01:15 (15 giây)
   * - Bước 5: 01:15 -> 01:40 (25 giây, bao gồm phần đúc kết)
   */
  steps: [
    {
      id: 'step-1-name-the-problem',
      stepNumber: 1,
      title: 'Gọi tên vấn đề',
      summary: 'Định nghĩa sự việc khách quan, tách biệt với lo âu.',
      start: 0,     // 00:00
      end: 30,      // 00:30
      tip: {
        heading: 'Gợi ý từ chuyên gia trị liệu CBT',
        lead: 'Khi lo âu dâng cao, não bộ có xu hướng nhìn mọi vấn đề như một khối đá khổng lồ không thể di dời. Kỹ năng chia nhỏ (micro-chunking) giúp hạ thấp hormone căng thẳng và kích hoạt lại vỏ não trước trán.',
        bullets: [
          'Chỉ tập trung vào một sự việc cụ thể có thật, không phóng đại.',
          'Viết ra câu hỏi rõ ràng: "Điều gì đang thực sự cản trở mình ngay lúc này?"',
          'Tách biệt cảm xúc lo âu ra khỏi sự kiện thực tế.',
        ],
      },
      practicePrompt: {
        stepLabel: 'Ứng dụng ngay Bước 1 vào thực tế',
        question: 'Vấn đề cụ thể nào đang làm bạn bận tâm nhất hôm nay? Hãy tóm gọn trong 1 câu:',
        placeholder: 'Ví dụ: Mình đang trì hoãn gửi email báo cáo tuần vì sợ số liệu chưa hoàn hảo...',
      },
    },
    {
      id: 'step-2-brainstorm-options',
      stepNumber: 2,
      title: 'Liệt kê phương án',
      summary: 'Mở rộng góc nhìn bằng phương pháp động não (brainstorming).',
      start: 30,    // 00:30
      end: 45,     // 00:45
      tip: {
        heading: 'Gợi ý từ chuyên gia trị liệu CBT',
        lead: 'Giai đoạn này nhằm kích thích tính sáng tạo và phá vỡ lối mòn tư duy "chỉ có một cách duy nhất hoặc không có lối thoát".',
        bullets: [
          'Không phán xét bất kỳ phương án nào ở Bước 2, kể cả ý tưởng kỳ quặc.',
          'Liệt kê ít nhất 3 đến 5 hướng tiếp cận khác nhau.',
          'Hỏi bản thân: "Nếu người bạn thân gặp tình huống này, mình sẽ gợi ý gì cho họ?"',
        ],
      },
      practicePrompt: {
        stepLabel: 'Ứng dụng ngay Bước 2 vào thực tế',
        question: 'Hãy ghi ra ít nhất 3 cách bạn có thể xử lý việc này (chưa cần chọn vội):',
        placeholder: 'Cách 1: Nhờ đồng nghiệp xem qua trước...\nCách 2: Gửi bản nháp sớm để xin góp ý...\nCách 3: Hoàn thành phần quan trọng nhất trước...',
      },
    },
    {
      id: 'step-3-pros-and-cons',
      stepNumber: 3,
      title: 'Đánh giá ưu & nhược',
      summary: 'Xem xét tính khả thi & nguồn lực sẵn có của từng phương án.',
      start: 45,    // 00:45
      end: 60,     // 01:00
      tip: {
        heading: 'Gợi ý từ chuyên gia trị liệu CBT',
        lead: 'Đánh giá dựa trên thực tế và nguồn lực trong tầm tay, không dựa trên kỳ vọng cầu toàn.',
        bullets: [
          'Ưu tiên phương án kiểm soát được hoàn toàn bởi bản thân bạn.',
          'Cân nhắc năng lượng và thời gian thực tế bạn đang có trong ngày.',
          'Tránh bẫy "phương án hoàn hảo" — chọn phương án "đủ tốt" để tiến lên.',
        ],
      },
      practicePrompt: {
        stepLabel: 'Ứng dụng ngay Bước 3 vào thực tế',
        question: 'Phương án nào ít rủi ro và nằm trong khả năng kiểm soát của bạn nhất?',
        placeholder: 'Ví dụ: Phương án 2 khả thi nhất vì mình chỉ cần 15 phút để hoàn thành...',
      },
    },
    {
      id: 'step-4-choose-one-action',
      stepNumber: 4,
      title: 'Chọn 1 hành động',
      summary: 'Chọn bước đi dễ bắt đầu nhất trong vòng 5–15 phút tới.',
      start: 60,    // 01:00
      end: 75,     // 01:15
      tip: {
        heading: 'Gợi ý từ chuyên gia trị liệu CBT',
        lead: 'Hành động nhỏ tạo ra động lực lớn. Một hành động siêu nhỏ (micro-action) hoàn thành sẽ kích hoạt dopamine tự nhiên, giúp bạn tiếp tục.',
        bullets: [
          'Hạ thấp rào cản hành động xuống mức "không thể thất bại".',
          'Xác định rõ: Ai làm, làm gì, ở đâu và vào lúc nào.',
          'Nếu cảm thấy ngần ngại, hãy rút ngắn thời gian làm thử xuống còn 5 phút.',
        ],
      },
      practicePrompt: {
        stepLabel: 'Ứng dụng ngay Bước 4 vào thực tế cuộc sống',
        question: 'Hành động nhỏ trong 5–15 phút tới mà bạn có thể làm được là gì?',
        placeholder: 'Ví dụ: Gửi một tin nhắn ngắn thông báo lùi lịch hẹn 1 ngày; hoặc viết ra 3 gạch đầu dòng cần làm trước 12:00...',
      },
    },
    {
      id: 'step-5-review-and-acknowledge',
      stepNumber: 5,
      title: 'Xem lại & ghi nhận',
      summary: 'Tự khen ngợi nỗ lực và điều chỉnh nếu cần thiết.',
      start: 75,    // 01:15
      end: 100,    // 01:40 (kết thúc video)
      tip: {
        heading: 'Gợi ý từ chuyên gia trị liệu CBT',
        lead: 'Não bộ cần được củng cố tích cực sau mỗi nỗ lực, dù kết quả có hoàn hảo hay chỉ mới là bước thử nghiệm đầu tiên.',
        bullets: [
          'Công nhận rằng bạn đã can đảm đối diện thay vì né tránh.',
          'Nếu phương án chưa hiệu quả, quay lại Bước 2 và chọn phương án tiếp theo.',
          'Luyện tập xem mỗi lần thử nghiệm là một bài học bổ ích, không phải thất bại.',
        ],
      },
      practicePrompt: {
        stepLabel: 'Ứng dụng ngay Bước 5 vào thực tế',
        question: 'Bạn muốn gửi lời khen ngợi hay động viên nào cho chính mình hôm nay?',
        placeholder: 'Ví dụ: Mình tự hào vì đã bắt tay vào làm một bước nhỏ thay vì ngồi lo lắng cả buổi...',
      },
    },
  ],
}
