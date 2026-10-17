import type {
  Appointment,
  AppointmentChatEligibility,
} from '@/lib/consultation/consultation-validation'
import type { ChatMessage } from '../api/chat-browser-client'

export type MessagesPreviewConversation = {
  reference: string
  appointment: Appointment
  eligibility: AppointmentChatEligibility
  messages: ChatMessage[]
  clientName: string
  profile: {
    age: number
    location: string
    reason: string
    gad7: number
    phq9: number
    note: string
  }
}

const SPECIALIST_ID = '90000000-0000-4000-8000-000000000001'
const USERS = [
  '80000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000002',
  '80000000-0000-4000-8000-000000000003',
  '80000000-0000-4000-8000-000000000004',
]
const IDS = [
  '70000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000002',
  '70000000-0000-4000-8000-000000000003',
  '70000000-0000-4000-8000-000000000004',
]

function inVietnam(now: Date, dayOffset: number, hour: number, minute = 0) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value)
  return new Date(
    Date.UTC(
      value('year'),
      value('month') - 1,
      value('day') + dayOffset,
      hour - 7,
      minute,
    ),
  ).toISOString()
}

function makeAppointment(
  index: number,
  status: Appointment['status'],
  start: string,
  end: string,
): Appointment {
  const finished = status === 'COMPLETED'
  return {
    id: IDS[index],
    slotId: `60000000-0000-4000-8000-00000000000${index + 1}`,
    specialistAccountId: SPECIALIST_ID,
    specialistDisplayName: 'ThS. BS. Nguyễn Thị Minh Anh',
    status,
    modality: 'IN_APP_CHAT',
    scheduledStartAt: start,
    scheduledEndAt: end,
    timezone: 'Asia/Ho_Chi_Minh',
    requestedAt: inVietnam(new Date(start), -2, 9),
    decisionDeadlineAt: inVietnam(new Date(start), -1, 9),
    heldCreditId: `50000000-0000-4000-8000-00000000000${index + 1}`,
    replacesAppointmentId: null,
    replacedByAppointmentId: null,
    decidedAt: inVietnam(new Date(start), -1, 8),
    decisionReason: 'SPECIALIST_ACCEPTED',
    cancelledAt: null,
    cancellationReason: null,
    cancellationActor: null,
    cancellationCreditOutcome: null,
    sessionOutcome: finished ? 'COMPLETED' : null,
    sessionOutcomeReason: null,
    sessionPolicyVersion: finished ? 'chat-session-completion-v1' : null,
    sessionEndedAt: finished ? end : null,
    sessionSettledAt: finished ? end : null,
    completionFactId: finished
      ? `40000000-0000-4000-8000-00000000000${index + 1}`
      : null,
    creditState: finished ? 'CONSUMED' : 'HELD',
    history: [],
    version: 1,
  }
}

function makeEligibility(
  appointment: Appointment,
  userId: string,
  phase: AppointmentChatEligibility['phase'],
  serverTime: string,
): AppointmentChatEligibility {
  const active = phase === 'ACTIVE'
  return {
    conversationId: appointment.id,
    appointmentId: appointment.id,
    userAccountId: userId,
    specialistAccountId: SPECIALIST_ID,
    phase,
    reasonCode: 'DESIGN_PREVIEW',
    subscribeAllowed: active || phase === 'WAITING',
    sendAllowed: active,
    historyAllowed: true,
    checkInAllowed: active,
    participantCheckedIn: active || phase === 'COMPLETED',
    sessionOutcome: phase === 'COMPLETED' ? 'COMPLETED' : null,
    creditState: phase === 'COMPLETED' ? 'CONSUMED' : 'HELD',
    scheduledStartAt: appointment.scheduledStartAt,
    scheduledEndAt: appointment.scheduledEndAt,
    serverTime,
  }
}

function message(
  index: number,
  appointment: Appointment,
  senderId: string,
  content: string,
  sentAt: string,
): ChatMessage {
  const id = `30000000-0000-4000-8000-0000000000${String(index).padStart(2, '0')}`
  return {
    messageId: id,
    conversationId: appointment.id,
    senderId,
    clientMessageId: id,
    type: 'TEXT',
    content,
    sentAt,
    schemaVersion: 1,
  }
}

export function getMessagesPreview(now = new Date()) {
  const first = makeAppointment(
    0,
    'IN_PROGRESS',
    inVietnam(now, 0, 19, 30),
    inVietnam(now, 0, 20, 30),
  )
  const second = makeAppointment(
    1,
    'CONFIRMED',
    inVietnam(now, 0, 21),
    inVietnam(now, 0, 22),
  )
  const third = makeAppointment(
    2,
    'CONFIRMED',
    inVietnam(now, 1, 10),
    inVietnam(now, 1, 11),
  )
  const fourth = makeAppointment(
    3,
    'COMPLETED',
    inVietnam(now, -1, 14),
    inVietnam(now, -1, 15),
  )
  const generatedAt = inVietnam(now, 0, 19, 45)

  const conversations: MessagesPreviewConversation[] = [
    {
      reference: 'MB-8821',
      appointment: first,
      eligibility: makeEligibility(first, USERS[0], 'ACTIVE', generatedAt),
      clientName: 'Trần Văn An',
      profile: {
        age: 29,
        location: 'Hà Nội',
        reason:
          'Áp lực thăng tiến và dự án mới gây mất ngủ liên tục. Khách hàng muốn tìm cách quản lý căng thẳng và cải thiện giấc ngủ.',
        gad7: 11,
        phq9: 6,
        note: 'Ghi nhận ban đầu: biểu hiện lo âu liên quan công việc. Cần trao đổi thêm về giấc ngủ và mức độ ảnh hưởng đến sinh hoạt.',
      },
      messages: [
        message(
          1,
          first,
          SPECIALIST_ID,
          'Chào An, mình đã xem phần bạn chia sẻ về tình trạng khó ngủ và căng thẳng công việc. Hôm nay mình sẽ lắng nghe và cùng bạn tìm hướng phù hợp.',
          inVietnam(now, 0, 19, 34),
        ),
        message(
          2,
          first,
          USERS[0],
          'Cảm ơn bác sĩ. Hai tuần gần đây tôi thường tỉnh giấc giữa đêm và thấy khó tập trung vào buổi sáng.',
          inVietnam(now, 0, 19, 38),
        ),
        message(
          3,
          first,
          SPECIALIST_ID,
          'Mình hiểu. Bạn có thể kể thêm điều gì thường xuất hiện trong đầu khi tỉnh giấc không?',
          inVietnam(now, 0, 19, 41),
        ),
      ],
    },
    {
      reference: 'MB-8794',
      appointment: second,
      eligibility: makeEligibility(second, USERS[1], 'WAITING', generatedAt),
      clientName: 'Lê Hoàng Yến',
      profile: {
        age: 32,
        location: 'Đà Nẵng',
        reason:
          'Muốn trao đổi về căng thẳng kéo dài và cách duy trì nhịp sinh hoạt ổn định.',
        gad7: 7,
        phq9: 4,
        note: 'Phiên sắp tới. Chưa có ghi chú của chuyên gia cho phiên này.',
      },
      messages: [],
    },
    {
      reference: 'MB-1530',
      appointment: third,
      eligibility: makeEligibility(third, USERS[2], 'TOO_EARLY', generatedAt),
      clientName: 'Phạm Minh Đức',
      profile: {
        age: 27,
        location: 'TP. Hồ Chí Minh',
        reason:
          'Khách hàng muốn trao đổi về thói quen ngủ và áp lực công việc.',
        gad7: 5,
        phq9: 3,
        note: 'Phiên chưa bắt đầu. Tóm tắt này chỉ là dữ liệu mẫu cho giao diện.',
      },
      messages: [],
    },
    {
      reference: 'MB-8462',
      appointment: fourth,
      eligibility: makeEligibility(fourth, USERS[3], 'COMPLETED', generatedAt),
      clientName: 'Đỗ Quỳnh Chi',
      profile: {
        age: 34,
        location: 'Hải Phòng',
        reason: 'Theo dõi sau buổi tư vấn về quản lý căng thẳng.',
        gad7: 8,
        phq9: 5,
        note: 'Đã trao đổi về lịch sinh hoạt và cách nhận biết dấu hiệu căng thẳng.',
      },
      messages: [
        message(
          4,
          fourth,
          USERS[3],
          'Em đã ghi lại những tình huống khiến mình căng thẳng trong tuần này.',
          inVietnam(now, -1, 14, 16),
        ),
        message(
          5,
          fourth,
          SPECIALIST_ID,
          'Cảm ơn Chi. Mình sẽ cùng xem lại các ghi chép và chọn một bước nhỏ để thực hành tuần tới.',
          inVietnam(now, -1, 14, 20),
        ),
      ],
    },
  ]

  return { generatedAt, conversations }
}
