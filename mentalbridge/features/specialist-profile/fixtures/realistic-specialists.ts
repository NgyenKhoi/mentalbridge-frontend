import type {
  SpecialistApprovalStatus,
  SpecialistProfile,
} from '@/lib/consultation/consultation-validation'

export type SpecialistDocumentItem = Readonly<{
  id: string
  title: string
  issuer: string
  issueDate?: string
  expiryDate?: string
  remainingText?: string
  code: string
  statusBadge: string
  badgeTone: 'success' | 'warning' | 'info'
  type: 'CCHN' | 'DIPLOMA' | 'PRACTICE' | 'CRIMINAL_RECORD'
  verificationSha: string
  safeStatus?: string
}>

export type SpecialistTimelineEvent = Readonly<{
  id: string
  time: string
  title: string
  actor: string
  detail?: string
}>

export type RealisticSpecialistExtended = SpecialistProfile & {
  hospitalOrAffiliation?: string
  initials?: string
  specialistCode?: string
  slaRemaining?: string
  documentsList?: SpecialistDocumentItem[]
  timeline?: SpecialistTimelineEvent[]
  quotaDefault?: string
  clinicalVerdictDefault?: string
  internalNoteDefault?: string
  notificationDraftDefault?: string
}

export const REALISTIC_SPECIALISTS: RealisticSpecialistExtended[] = [
  {
    accountId: 'f4820192-83bb-4d51-8212-62778245335c',
    displayName: 'ThS. BS. Hồ Thị Hồng',
    bio: 'Bác sĩ chuyên khoa Tâm thần và Tâm lý lâm sàng với hơn 12 năm kinh nghiệm điều trị các rối loạn trầm cảm, lo âu lan tỏa, sang chấn tâm lý (PTSD) và khủng hoảng danh tính tại Bệnh viện Đại học Y Dược TP.HCM.',
    supportAreas: ['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS'],
    languages: ['vi', 'en'],
    yearsOfExperience: 12,
    timezone: 'Asia/Ho_Chi_Minh',
    approvalStatus: 'PENDING' as SpecialistApprovalStatus,
    submittedAt: '2026-11-09T02:15:00Z',
    reviewedAt: null,
    reviewedBy: null,
    decisionReasonCode: null,
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-09T02:15:00Z',
    version: 1,
    hospitalOrAffiliation: 'ĐH Y Dược TP.HCM • Khoa Tâm lý Lâm sàng',
    initials: 'HH',
    specialistCode: '#MB-482',
    slaRemaining: 'SLA còn: 1h40m',
    quotaDefault: 'Tiêu chuẩn: 15 đến 25 phiên',
    clinicalVerdictDefault: 'Phê duyệt chuẩn y khoa - 1',
    internalNoteDefault:
      'Bác sĩ có nền tảng lâm sàng tốt tại ĐH Y Dược, khuyến nghị phân bổ các ca lo âu sinh viên & người lớn.',
    notificationDraftDefault:
      'Hồ sơ đã được thẩm định đạt chuẩn năng lực lâm sàng. Xin vui lòng kiểm tra điểm thưởng và đón ca.',
    documentsList: [
      {
        id: 'doc-cchn-019283',
        title: 'Chứng chỉ hành nghề KCB #019283/BYT',
        issuer: 'Sở Y Tế TP.HCM cấp 12/04/2021',
        expiryDate: '15/04/2029',
        remainingText: 'Còn 4 năm 8 tháng',
        code: '019283/BYT',
        statusBadge: 'CSDL Quốc gia - Khớp 100%',
        badgeTone: 'success',
        type: 'CCHN',
        verificationSha: 'd9f824b7a12e84c9034fbe7193bca9810f27b1a8',
        safeStatus: 'An toàn',
      },
      {
        id: 'doc-diploma-ms8812',
        title: 'Bằng Thạc sĩ Tâm lý học lâm sàng',
        issuer: 'ĐH Y Dược TP.HCM',
        issueDate: '18/11/2019',
        code: 'MS-8812',
        statusBadge: 'Đã xác thực văn bằng gốc',
        badgeTone: 'success',
        type: 'DIPLOMA',
        verificationSha: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4',
      },
      {
        id: 'doc-practice-bvtt',
        title: 'Chứng nhận thực hành lâm sàng 18 tháng',
        issuer: 'Khoa Tâm thần - BV Tâm Thần TP.HCM',
        issueDate: '05/10/2020',
        code: 'THLS-18M-0442',
        statusBadge: 'Đạt chuẩn thực hành',
        badgeTone: 'info',
        type: 'PRACTICE',
        verificationSha: 'a71b823e5927cba8901235123984afcb6189da3b',
      },
      {
        id: 'doc-lltp-so2',
        title: 'Phiếu lý lịch tư pháp số 2',
        issuer: 'Sở Tư pháp TP.HCM cấp 01/01/2026',
        issueDate: '01/01/2026',
        remainingText: 'Còn hiệu lực',
        code: 'LLTP2-2026-99381',
        statusBadge: 'Trong sạch - Đạt chuẩn an toàn',
        badgeTone: 'success',
        type: 'CRIMINAL_RECORD',
        verificationSha: 'b45c991823abce1287410948acba10842918bbcd',
      },
    ],
    timeline: [
      {
        id: 't-1',
        time: '09:15',
        title: 'Nộp hồ sơ',
        actor: 'Chuyên gia gửi qua Portal',
        detail: 'Hồ sơ đầy đủ 4 giấy tờ hợp thức hóa',
      },
      {
        id: 't-2',
        time: '10:00',
        title: 'Mở đối soát CCHN',
        actor: 'BS. Hoàng Khang tiếp nhận',
        detail: 'Khởi tạo phiên kiểm định độc lập',
      },
      {
        id: 't-3',
        time: '10:20',
        title: 'Quét SHA-256',
        actor: 'Khớp CSDL Bộ Y tế',
        detail: 'Đối soát VNeID Mức 2 trùng khớp 100%',
      },
    ],
  },
  {
    accountId: 'f5050241-90bb-4d51-8212-62778245335c',
    displayName: 'ThS. BS. Phan Phương Thảo',
    bio: 'Bác sĩ chuyên khoa Trị liệu gia đình, trầm cảm sau sinh và sang chấn tâm lý hậu tai nạn. Tốt nghiệp Thạc sĩ Đại học Y Dược và từng có thời gian thực hành tại Bệnh viện FV.',
    supportAreas: ['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS'],
    languages: ['vi', 'en', 'fr'],
    yearsOfExperience: 8,
    timezone: 'Asia/Ho_Chi_Minh',
    approvalStatus: 'PENDING' as SpecialistApprovalStatus,
    submittedAt: '2026-11-09T03:00:00Z',
    reviewedAt: null,
    reviewedBy: null,
    decisionReasonCode: null,
    createdAt: '2026-11-03T10:00:00Z',
    updatedAt: '2026-11-09T03:00:00Z',
    version: 1,
    hospitalOrAffiliation: 'BV FV Sài Gòn • Trị liệu Gia đình',
    initials: 'PT',
    specialistCode: '#MB-505',
    slaRemaining: 'SLA còn: 3h20m',
    quotaDefault: 'Tiêu chuẩn: 15 đến 25 phiên',
    clinicalVerdictDefault: 'Phê duyệt chuẩn y khoa - 1',
    internalNoteDefault:
      'Chuyên môn sâu về hôn nhân gia đình và stress công sở. Bằng cấp và CCHN đối chiếu hợp lệ.',
    notificationDraftDefault:
      'Hồ sơ của bạn đã được tiếp nhận và chuẩn bị kích hoạt.',
    documentsList: [
      {
        id: 'doc-cchn-024190',
        title: 'Chứng chỉ hành nghề KCB #024190/BYT',
        issuer: 'Sở Y Tế TP.HCM cấp 15/08/2022',
        expiryDate: '15/08/2030',
        remainingText: 'Còn 5 năm 9 tháng',
        code: '024190/BYT',
        statusBadge: 'CSDL Quốc gia - Khớp 100%',
        badgeTone: 'success',
        type: 'CCHN',
        verificationSha: 'c8192ab4102948cebaa91823749210bcdea81920',
        safeStatus: 'An toàn',
      },
      {
        id: 'doc-diploma-pt88',
        title: 'Bằng Thạc sĩ Tâm lý học lâm sàng',
        issuer: 'ĐH Y Dược TP.HCM',
        issueDate: '20/12/2021',
        code: 'MS-9102',
        statusBadge: 'Đã xác thực văn bằng gốc',
        badgeTone: 'success',
        type: 'DIPLOMA',
        verificationSha: '81923cebfa102948123984afcb6189da3b102938',
      },
    ],
    timeline: [
      {
        id: 't-pt-1',
        time: '08:45',
        title: 'Nộp hồ sơ trực tuyến',
        actor: 'Chuyên gia gửi qua Portal',
      },
      {
        id: 't-pt-2',
        time: '11:15',
        title: 'Phân công thẩm định viên',
        actor: 'Hệ thống tự động',
      },
    ],
  },
  {
    accountId: 'f4010102-45bb-4d51-8212-62778245335c',
    displayName: 'TS. BS. Nguyễn Minh Đức',
    bio: 'Tiến sĩ Y khoa, Giảng viên Bộ môn Tâm thần ĐH Y Dược TP.HCM. Chuyên sâu về rối loạn lưỡng cực, mất ngủ kinh niên, và các liệu pháp nhận thức - hành vi (CBT) nâng cao.',
    supportAreas: ['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS'],
    languages: ['vi', 'en'],
    yearsOfExperience: 16,
    timezone: 'Asia/Ho_Chi_Minh',
    approvalStatus: 'APPROVED' as SpecialistApprovalStatus,
    submittedAt: '2026-10-10T09:00:00Z',
    reviewedAt: '2026-10-11T14:00:00Z',
    reviewedBy: 'Admin Hoàng Khang',
    decisionReasonCode: null,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-11T14:00:00Z',
    version: 2,
    hospitalOrAffiliation: 'BV Tâm Thần TP.HCM • Giảng viên ĐH Y Dược',
    initials: 'MĐ',
    specialistCode: '#MB-401',
    slaRemaining: 'Đã hoàn tất',
    quotaDefault: 'Tối đa: 30 phiên/tuần',
    clinicalVerdictDefault: 'Phê duyệt chuẩn y khoa - 1',
    internalNoteDefault: 'Chuyên gia cấp cao, bảo chứng chuyên môn xuất sắc.',
    notificationDraftDefault: 'Hồ sơ hoạt động bình thường.',
    documentsList: [
      {
        id: 'doc-cchn-010245',
        title: 'Chứng chỉ hành nghề KCB #010245/BYT',
        issuer: 'Bộ Y Tế cấp 05/01/2016',
        expiryDate: '05/01/2031',
        remainingText: 'Còn 6 năm 2 tháng',
        code: '010245/BYT',
        statusBadge: 'CSDL Quốc gia - Khớp 100%',
        badgeTone: 'success',
        type: 'CCHN',
        verificationSha: '192837465abcde9876543210fedcba0123456789',
        safeStatus: 'An toàn tuyệt đối',
      },
    ],
  },
  {
    accountId: 'f3090993-81bb-4d51-8212-62778245335c',
    displayName: 'ThS. Tâm lý Lê Bảo Trâm',
    bio: 'Thạc sĩ Tâm lý học lâm sàng trẻ em & vị thành niên. Có chứng chỉ tham vấn gia đình và chuyên môn can thiệp rối loạn lo âu xã hội ở học sinh - sinh viên.',
    supportAreas: ['ANXIETY_SYMPTOMS'],
    languages: ['vi'],
    yearsOfExperience: 6,
    timezone: 'Asia/Ho_Chi_Minh',
    approvalStatus: 'APPROVED' as SpecialistApprovalStatus,
    submittedAt: '2026-10-15T10:00:00Z',
    reviewedAt: '2026-10-16T11:00:00Z',
    reviewedBy: 'Admin Hoàng Khang',
    decisionReasonCode: null,
    createdAt: '2026-10-12T07:00:00Z',
    updatedAt: '2026-10-16T11:00:00Z',
    version: 2,
    hospitalOrAffiliation: 'Viện Tâm lý Việt - Pháp',
    initials: 'BT',
    specialistCode: '#MB-309',
    slaRemaining: 'Đã hoàn tất',
    quotaDefault: 'Tiêu chuẩn: 15 đến 25 phiên',
    clinicalVerdictDefault: 'Phê duyệt chuẩn y khoa - 1',
  },
  {
    accountId: 'f2180882-71bb-4d51-8212-62778245335c',
    displayName: 'BS. CKI Trần Hoàng Yến',
    bio: 'Bác sĩ chuyên khoa Sức khỏe tâm thần người cao tuổi, rối loạn giấc ngủ và kiệt sức nghề nghiệp (Burnout). Từng công tác tại Khoa Tâm thần BV Bạch Mai.',
    supportAreas: ['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS'],
    languages: ['vi'],
    yearsOfExperience: 9,
    timezone: 'Asia/Ho_Chi_Minh',
    approvalStatus: 'SUSPENDED' as SpecialistApprovalStatus,
    submittedAt: '2026-09-20T08:00:00Z',
    reviewedAt: '2026-11-05T09:00:00Z',
    reviewedBy: 'Admin Hoàng Khang',
    decisionReasonCode: 'QUALITY_REVIEW_REQUIRED',
    createdAt: '2026-09-15T08:00:00Z',
    updatedAt: '2026-11-05T09:00:00Z',
    version: 3,
    hospitalOrAffiliation: 'Bệnh viện Bạch Mai • Hà Nội',
    initials: 'HY',
    specialistCode: '#MB-218',
    slaRemaining: 'Đang tạm dừng',
    quotaDefault: 'Tiêu chuẩn: 15 đến 25 phiên',
  },
  {
    accountId: 'f1870771-61bb-4d51-8212-62778245335c',
    displayName: 'ThS. Nguyễn Quốc Huy',
    bio: 'Chuyên viên tham vấn kỹ năng sống và định hướng nghề nghiệp cho thanh thiếu niên.',
    supportAreas: ['ANXIETY_SYMPTOMS'],
    languages: ['vi'],
    yearsOfExperience: 3,
    timezone: 'Asia/Ho_Chi_Minh',
    approvalStatus: 'REJECTED' as SpecialistApprovalStatus,
    submittedAt: '2026-10-02T14:00:00Z',
    reviewedAt: '2026-10-03T16:00:00Z',
    reviewedBy: 'Admin Hoàng Khang',
    decisionReasonCode: 'OUTSIDE_SUPPORTED_SCOPE',
    createdAt: '2026-10-01T12:00:00Z',
    updatedAt: '2026-10-03T16:00:00Z',
    version: 2,
    hospitalOrAffiliation: 'Trung tâm Hỗ trợ Học đường',
    initials: 'QH',
    specialistCode: '#MB-187',
    slaRemaining: 'Đã từ chối',
  },
]
