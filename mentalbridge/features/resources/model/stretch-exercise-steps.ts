export type StretchExerciseStep = Readonly<{
  id: string
  title: string
  description: string
  start: number
  end: number
}>

export const stretchExerciseSteps: readonly StretchExerciseStep[] = [
  {
    id: 'warm-up-shoulders-sides',
    title: 'Khởi động vai - sườn',
    description:
      'Mở nhẹ hai vai và vươn dài hai bên sườn. Giữ nhịp thở tự nhiên, chỉ nghiêng trong tầm dễ chịu.',
    start: 0,
    end: 69,
  },
  {
    id: 'side-bend',
    title: 'Nghiêng thân',
    description:
      'Đan tay vươn lên rồi nghiêng người sang từng bên. Cảm nhận phần eo và vai được kéo giãn nhẹ nhàng.',
    start: 69,
    end: 121,
  },
  {
    id: 'wide-leg-fold',
    title: 'Gập người tấn rộng',
    description:
      'Đứng hai chân rộng và hạ thân từ từ. Có thể chống tay lên đùi nếu cúi sâu khiến bạn không thoải mái.',
    start: 121,
    end: 177,
  },
  {
    id: 'extended-side-angle',
    title: 'Góc nghiêng mở',
    description:
      'Bước một chân ra trước, chống tay vững rồi mở ngực và tay còn lại lên cao. Không cần cố vươn quá tầm.',
    start: 177,
    end: 234,
  },
  {
    id: 'revolved-triangle',
    title: 'Tam giác xoắn',
    description:
      'Từ tư thế đứng vững, xoay thân nhẹ để mở ngực. Chuyển động chậm và giữ cổ ở vị trí dễ chịu.',
    start: 234,
    end: 289,
  },
  {
    id: 'deep-lunge',
    title: 'Chùng chân sâu',
    description:
      'Bước chân lên và hạ hông theo sức của mình. Có thể để gối sau chạm sàn hoặc bỏ qua nếu đầu gối khó chịu.',
    start: 289,
    end: 343,
  },
  {
    id: 'knee-lift-balance',
    title: 'Nâng gối - thăng bằng',
    description:
      'Nâng một gối lên và tìm điểm tựa mắt phía trước. Hãy bám vào ghế hoặc tường nếu cần thêm sự vững vàng.',
    start: 343,
    end: 394,
  },
  {
    id: 'tree-pose',
    title: 'Tư thế cây',
    description:
      'Đặt bàn chân vào phía trong chân trụ và giữ thăng bằng. Có thể để mũi chân chạm sàn hoặc vịn nhẹ vào tường.',
    start: 394,
    end: 459,
  },
]
