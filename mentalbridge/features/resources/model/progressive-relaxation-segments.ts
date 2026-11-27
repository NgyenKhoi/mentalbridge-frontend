export type RelaxationCaption = Readonly<{
  start: number
  end: number
  text: string
}>

export type RelaxationSegment = Readonly<{
  id: string
  start: number
  end: number
  title: string
  zoneLabel: string
  captions: readonly RelaxationCaption[]
}>

export const progressiveRelaxationSegments: readonly [
  RelaxationSegment,
  ...RelaxationSegment[],
] = [
  {
    id: 'hands-arms',
    start: 0,
    end: 105,
    title: 'Bàn tay & Cánh tay',
    zoneLabel: 'Vùng 1: Bàn tay & Cánh tay',
    captions: [
      {
        start: 0,
        end: 20,
        text: 'Chào bạn, hãy ngồi hoặc nằm thoải mái, đặt hai bàn tay lên đùi.',
      },
      {
        start: 20,
        end: 40,
        text: 'Hít vào chậm bằng mũi trong 4 giây, thở ra nhẹ nhàng trong 6 giây.',
      },
      {
        start: 40,
        end: 70,
        text: 'Nắm chặt hai bàn tay như đang bóp một quả cam... rồi thả ra.',
      },
      {
        start: 70,
        end: 105,
        text: 'Cảm nhận hơi ấm lan từ đầu ngón tay lên cánh tay.',
      },
    ],
  },
  {
    id: 'shoulders-neck',
    start: 105,
    end: 210,
    title: 'Vai & Cổ',
    zoneLabel: 'Vùng 2: Vai & Cổ',
    captions: [
      {
        start: 105,
        end: 140,
        text: 'Nhấc hai vai lên sát tai, giữ lại... rồi thả xuống thật nhẹ.',
      },
      {
        start: 140,
        end: 180,
        text: 'Nghiêng đầu thật nhẹ, chỉ đến mức bạn cảm thấy dễ chịu.',
      },
      {
        start: 180,
        end: 210,
        text: 'Thả lỏng toàn bộ bờ vai, cảm nhận sức nặng dễ chịu của cơ thể.',
      },
    ],
  },
  {
    id: 'face',
    start: 210,
    end: 315,
    title: 'Khuôn mặt',
    zoneLabel: 'Vùng 3: Khuôn mặt',
    captions: [
      {
        start: 210,
        end: 240,
        text: 'Nhướn hai lông mày lên cao, cảm nhận làn da trán căng ra... rồi thả lỏng.',
      },
      {
        start: 240,
        end: 270,
        text: 'Nhắm mắt thật chặt... rồi để mi mắt nặng và mềm lại.',
      },
      {
        start: 270,
        end: 315,
        text: 'Để hàm của bạn thả lỏng, răng không chạm nhau, gương mặt dịu lại.',
      },
    ],
  },
  {
    id: 'chest-abdomen',
    start: 315,
    end: 420,
    title: 'Bụng & Ngực',
    zoneLabel: 'Vùng 4: Bụng & Ngực',
    captions: [
      {
        start: 315,
        end: 350,
        text: 'Hít vào để lồng ngực nở ra... rồi thở ra từ từ, ngực nhẹ dần.',
      },
      {
        start: 350,
        end: 390,
        text: 'Thu nhẹ vùng bụng vào... rồi để bụng mềm và đầy đặn trở lại.',
      },
      {
        start: 390,
        end: 420,
        text: 'Cảm nhận từng nhịp thở nâng lên rồi hạ xuống, thật êm.',
      },
    ],
  },
  {
    id: 'legs-feet',
    start: 420,
    end: 536,
    title: 'Chân & Bàn chân',
    zoneLabel: 'Vùng 5: Chân & Bàn chân',
    captions: [
      {
        start: 420,
        end: 455,
        text: 'Siết nhẹ hai đùi... rồi buông lỏng, để chân nặng và ấm.',
      },
      {
        start: 455,
        end: 485,
        text: 'Kéo mũi chân về phía bạn một cách nhẹ nhàng... rồi thả.',
      },
      {
        start: 485,
        end: 510,
        text: 'Co các ngón chân lại... rồi duỗi ra, cảm nhận cả bàn chân mềm ra.',
      },
      {
        start: 510,
        end: 536,
        text: 'Cảm nhận toàn thân thư giãn. Khi sẵn sàng, hãy hít sâu và mở mắt nhẹ nhàng.',
      },
    ],
  },
]

export const progressiveRelaxationDuration =
  progressiveRelaxationSegments.at(-1)?.end ?? 536
