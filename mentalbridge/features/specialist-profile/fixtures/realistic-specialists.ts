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
  isUrgentSla?: boolean
  hasPendingAmendment?: boolean
  documentsList?: SpecialistDocumentItem[]
  timeline?: SpecialistTimelineEvent[]
  quotaDefault?: string
  clinicalVerdictDefault?: string
  internalNoteDefault?: string
  notificationDraftDefault?: string
}

export type RealisticAmendmentItem = Readonly<{
  id: string
  accountId: string
  displayName: string
  specialistCode: string
  hospitalOrAffiliation: string
  initials: string
  submittedAt: string
  slaRemaining: string
  isUrgentSla?: boolean
  approvedProfile: {
    displayName: string
    bio: string
    supportAreas: ('DEPRESSIVE_SYMPTOMS' | 'ANXIETY_SYMPTOMS')[]
    languages: string[]
    yearsOfExperience: number
    timezone: string
    hospitalOrAffiliation: string
  }
  proposedProfile: {
    displayName: string
    bio: string
    supportAreas: ('DEPRESSIVE_SYMPTOMS' | 'ANXIETY_SYMPTOMS')[]
    languages: string[]
    yearsOfExperience: number
    timezone: string
    hospitalOrAffiliation: string
  }
}>

export const REALISTIC_SPECIALISTS: RealisticSpecialistExtended[] = [
  // ================= PENDING PROFILES =================
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
    isUrgentSla: true,
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
        issueDate: '15/08/2017',
        code: 'TH-0812',
        statusBadge: 'Đạt chuẩn thực hành',
        badgeTone: 'success',
        type: 'PRACTICE',
        verificationSha: 'f1a2b3c4d5e67890123456789abcdef012345678',
      },
      {
        id: 'doc-criminal-record-2',
        title: 'Phiếu lý lịch tư pháp số 2',
        issuer: 'Sở Tư pháp TP.HCM cấp',
        issueDate: '01/10/2026',
        code: 'LLTP-2026-0819',
        statusBadge: 'Trong sạch (Không tiền án)',
        badgeTone: 'info',
        type: 'CRIMINAL_RECORD',
        verificationSha: 'aa11bb22cc33dd44ee55ff660011223344556677',
      },
    ],
    timeline: [
      {
        id: 't-hh-1',
        time: '04:15',
        title: 'Khởi tạo hồ sơ chuyên gia',
        actor: 'Chuyên gia nộp hồ sơ qua Portal',
        detail:
          'Đã tải lên 4 tài liệu gốc scan CKS & khai báo thông tin lâm sàng.',
      },
      {
        id: 't-hh-2',
        time: '04:16',
        title: 'AI Pipeline tự động thẩm định',
        actor: 'MentalBridge AI Engine (v2.4)',
        detail:
          'PaddleOCR đọc chính xác 100% CCHN. CSDL Quốc gia Sở Y tế phản hồi khớp dữ liệu người hành nghề.',
      },
      {
        id: 't-hh-3',
        time: '04:20',
        title: 'Ghi nhật ký phân bổ thẩm định',
        actor: 'Hệ thống Quản trị',
        detail:
          'Hồ sơ được chỉ định cho BS. Hoàng Khang (Hội đồng Thẩm định Lâm sàng).',
      },
    ],
  },
  {
    accountId: 'f5050241-90bb-4d51-8212-62778245335c',
    displayName: 'ThS. BS. Phan Phương Thảo',
    bio: 'Bác sĩ trị liệu nhận thức hành vi (CBT) và tâm lý gia đình. Từng công tác tại BV FV Sài Gòn, chuyên sâu về khủng hoảng tuổi vị thành niên và trầm cảm sau sinh.',
    supportAreas: ['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS'],
    languages: ['vi', 'en'],
    yearsOfExperience: 8,
    timezone: 'Asia/Ho_Chi_Minh',
    approvalStatus: 'PENDING' as SpecialistApprovalStatus,
    submittedAt: '2026-11-09T03:00:00Z',
    reviewedAt: null,
    reviewedBy: null,
    decisionReasonCode: null,
    createdAt: '2026-11-02T09:00:00Z',
    updatedAt: '2026-11-09T03:00:00Z',
    version: 1,
    hospitalOrAffiliation: 'BV FV Sài Gòn • Trị liệu Tâm lý Gia đình',
    initials: 'PT',
    specialistCode: '#MB-505',
    slaRemaining: 'SLA còn: 3h20m',
    isUrgentSla: false,
    quotaDefault: 'Tiêu chuẩn: 12 đến 20 phiên',
    clinicalVerdictDefault: 'Phê duyệt chuẩn y khoa - 1',
    internalNoteDefault:
      'Hồ sơ đầy đủ, CCHN kiểm tra hợp lệ trên cổng CSDL Sở Y tế TP.HCM.',
    notificationDraftDefault:
      'Hồ sơ đã được phê duyệt. Chào mừng chuyên gia tham gia MentalBridge.',
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
        time: '04:55',
        title: 'Nộp hồ sơ Portal',
        actor: 'Chuyên gia nộp hồ sơ',
      },
    ],
  },
  {
    accountId: 'f6190318-92bb-4d51-8212-62778245335c',
    displayName: 'BS. CKI Vũ Trọng Nghĩa',
    bio: 'Bác sĩ chuyên khoa 1 Tâm thần, BV Tâm Thần TW2. Có kinh nghiệm sâu trong can thiệp khủng hoảng, mất ngủ kinh niên, và các rối loạn ám ảnh cưỡng chế (OCD).',
    supportAreas: ['ANXIETY_SYMPTOMS'],
    languages: ['vi'],
    yearsOfExperience: 10,
    timezone: 'Asia/Ho_Chi_Minh',
    approvalStatus: 'PENDING' as SpecialistApprovalStatus,
    submittedAt: '2026-11-09T03:30:00Z',
    reviewedAt: null,
    reviewedBy: null,
    decisionReasonCode: null,
    createdAt: '2026-11-03T10:00:00Z',
    updatedAt: '2026-11-09T03:30:00Z',
    version: 1,
    hospitalOrAffiliation: 'BV Tâm Thần TW2 • Điều trị Rối loạn Giấc ngủ',
    initials: 'VN',
    specialistCode: '#MB-619',
    slaRemaining: 'SLA còn: 5h15m',
    isUrgentSla: false,
    documentsList: [
      {
        id: 'doc-cchn-619',
        title: 'Chứng chỉ hành nghề KCB #031892/BYT',
        issuer: 'Bộ Y Tế cấp 22/03/2019',
        expiryDate: '22/03/2029',
        remainingText: 'Còn 4 năm 7 tháng',
        code: '031892/BYT',
        statusBadge: 'CSDL Quốc gia - Khớp 100%',
        badgeTone: 'success',
        type: 'CCHN',
        verificationSha: '8192039485abcde1234567890fedcba987654321',
      },
    ],
    timeline: [
      {
        id: 't-vn-1',
        time: '05:20',
        title: 'Nộp hồ sơ Portal',
        actor: 'Chuyên gia gửi qua Portal',
      },
    ],
  },
  {
    accountId: 'f7340889-11bb-4d51-8212-62778245335c',
    displayName: 'ThS. Tâm lý Đặng Mai Chi',
    bio: 'Thạc sĩ Tâm lý học lâm sàng, Viện Sức khỏe Tâm thần Bạch Mai. Chuyên sâu về tham vấn tâm lý cá nhân, hỗ trợ rối loạn cảm xúc và sang chấn tâm lý ở người trẻ.',
    supportAreas: ['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS'],
    languages: ['vi', 'en'],
    yearsOfExperience: 7,
    timezone: 'Asia/Ho_Chi_Minh',
    approvalStatus: 'PENDING' as SpecialistApprovalStatus,
    submittedAt: '2026-11-09T04:10:00Z',
    reviewedAt: null,
    reviewedBy: null,
    decisionReasonCode: null,
    createdAt: '2026-11-04T11:00:00Z',
    updatedAt: '2026-11-09T04:10:00Z',
    version: 1,
    hospitalOrAffiliation:
      'Viện Sức khỏe Tâm thần • Tham vấn Trẻ vị thành niên',
    initials: 'MC',
    specialistCode: '#MB-734',
    slaRemaining: 'SLA còn: 8h30m',
    isUrgentSla: false,
    documentsList: [
      {
        id: 'doc-diploma-734',
        title: 'Bằng Thạc sĩ Tâm lý học Lâm sàng',
        issuer: 'ĐH Khoa học Xã hội & Nhân văn',
        issueDate: '15/11/2020',
        code: 'MS-73411',
        statusBadge: 'Đã xác thực văn bằng gốc',
        badgeTone: 'success',
        type: 'DIPLOMA',
        verificationSha: '9988776655aabbccddeeff001122334455667788',
      },
    ],
    timeline: [
      {
        id: 't-mc-1',
        time: '06:00',
        title: 'Hồ sơ khởi tạo',
        actor: 'Chuyên gia gửi qua Portal',
      },
    ],
  },

  // ================= APPROVED PROFILES =================
  {
    accountId: 'f4010102-45bb-4d51-8212-62778245335c',
    displayName: 'TS. BS. Nguyễn Minh Đức',
    bio: 'Tiến sĩ Y khoa, Giảng viên Bộ môn Tâm thần ĐH Y Dược TP.HCM. Chuyên sâu về rối loạn lưỡng cực, mất ngủ kinh niên, và các liệu pháp nhận thức - hành vi (CBT) nâng cao.',
    supportAreas: ['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS'],
    languages: ['vi', 'en'],
    yearsOfExperience: 16,
    timezone: 'Asia/Ho_Chi_Minh',
    approvalStatus: 'APPROVED' as SpecialistApprovalStatus,
    submittedAt: '2026-10-10T08:00:00Z',
    reviewedAt: '2026-10-12T09:30:00Z',
    reviewedBy: 'BS. Hoàng Khang',
    decisionReasonCode: null,
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-12T09:30:00Z',
    version: 2,
    hospitalOrAffiliation: 'BV Tâm Thần TP.HCM • Giảng viên ĐH Y Dược',
    initials: 'MĐ',
    specialistCode: '#MB-401',
    hasPendingAmendment: true,
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
    reviewedAt: '2026-10-16T14:20:00Z',
    reviewedBy: 'BS. Hoàng Khang',
    decisionReasonCode: null,
    createdAt: '2026-10-10T10:00:00Z',
    updatedAt: '2026-10-16T14:20:00Z',
    version: 2,
    hospitalOrAffiliation: 'Viện Tâm lý Việt - Pháp • Can thiệp Học đường',
    initials: 'BT',
    specialistCode: '#MB-309',
    hasPendingAmendment: true,
    documentsList: [
      {
        id: 'doc-cchn-099381',
        title: 'Chứng chỉ hành nghề KCB #099381/BYT',
        issuer: 'Sở Y Tế Hà Nội cấp 10/10/2020',
        expiryDate: '10/10/2030',
        remainingText: 'Còn 5 năm 11 tháng',
        code: '099381/BYT',
        statusBadge: 'CSDL Quốc gia - Khớp 100%',
        badgeTone: 'success',
        type: 'CCHN',
        verificationSha: 'abcdef1234567890fedcba987654321012345678',
      },
    ],
  },
  {
    accountId: 'f8120456-78bb-4d51-8212-62778245335c',
    displayName: 'BS. CKI Trần Đình Nam',
    bio: 'Chuyên khoa 1 Tâm thần học, BV Quân Y 175. Chuyên gia về điều trị stress sau sang chấn tâm lý (PTSD), rối loạn giải thể nhân cách, và rối loạn giấc ngủ nặng.',
    supportAreas: ['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS'],
    languages: ['vi', 'en'],
    yearsOfExperience: 14,
    timezone: 'Asia/Ho_Chi_Minh',
    approvalStatus: 'APPROVED' as SpecialistApprovalStatus,
    submittedAt: '2026-09-20T08:00:00Z',
    reviewedAt: '2026-09-21T11:00:00Z',
    reviewedBy: 'BS. Hoàng Khang',
    decisionReasonCode: null,
    createdAt: '2026-09-15T08:00:00Z',
    updatedAt: '2026-09-21T11:00:00Z',
    version: 1,
    hospitalOrAffiliation: 'BV Quân Y 175 • Khoa Tâm thần & Can thiệp Stress',
    initials: 'ĐN',
    specialistCode: '#MB-812',
    documentsList: [],
  },
  {
    accountId: 'f9230567-89bb-4d51-8212-62778245335c',
    displayName: 'ThS. BS. Nguyễn Thị Thảo Vân',
    bio: 'Bác sĩ nội trú chuyên ngành Tâm thần, Bệnh viện Bạch Mai. Từng tu nghiệp tại Viện Não Paris (ICM), chuyên môn cao về can thiệp sớm các cơn hoảng loạn (Panic Attack).',
    supportAreas: ['ANXIETY_SYMPTOMS'],
    languages: ['vi', 'fr', 'en'],
    yearsOfExperience: 9,
    timezone: 'Asia/Ho_Chi_Minh',
    approvalStatus: 'APPROVED' as SpecialistApprovalStatus,
    submittedAt: '2026-09-25T14:00:00Z',
    reviewedAt: '2026-09-26T16:45:00Z',
    reviewedBy: 'BS. Hoàng Khang',
    decisionReasonCode: null,
    createdAt: '2026-09-20T14:00:00Z',
    updatedAt: '2026-09-26T16:45:00Z',
    version: 1,
    hospitalOrAffiliation: 'Bệnh viện Bạch Mai • Viện Sức khỏe Tâm thần',
    initials: 'TV',
    specialistCode: '#MB-923',
    documentsList: [],
  },
]

export const REALISTIC_AMENDMENTS: RealisticAmendmentItem[] = [
  {
    id: 'amend-md-401',
    accountId: 'f4010102-45bb-4d51-8212-62778245335c',
    displayName: 'TS. BS. Nguyễn Minh Đức',
    specialistCode: '#MB-401',
    hospitalOrAffiliation: 'BV Tâm Thần TP.HCM • Giảng viên ĐH Y Dược',
    initials: 'MĐ',
    submittedAt: '2026-11-09T08:30:00Z',
    slaRemaining: 'SLA còn: 4h15m',
    isUrgentSla: false,
    approvedProfile: {
      displayName: 'TS. BS. Nguyễn Minh Đức',
      bio: 'Tiến sĩ Y khoa, Giảng viên Bộ môn Tâm thần ĐH Y Dược TP.HCM. Chuyên sâu về rối loạn lưỡng cực, mất ngủ kinh niên, và các liệu pháp nhận thức - hành vi (CBT) nâng cao.',
      supportAreas: ['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS'],
      languages: ['vi', 'en'],
      yearsOfExperience: 16,
      timezone: 'Asia/Ho_Chi_Minh',
      hospitalOrAffiliation: 'BV Tâm Thần TP.HCM • Giảng viên ĐH Y Dược',
    },
    proposedProfile: {
      displayName: 'TS. BS. Nguyễn Minh Đức',
      bio: 'Tiến sĩ Y khoa, Giảng viên Bộ môn Tâm thần ĐH Y Dược TP.HCM. Chuyên sâu về rối loạn lưỡng cực, mất ngủ kinh niên, liệu pháp nhận thức - hành vi (CBT) nâng cao và Tham vấn chuyên sâu kiệt sức lãnh đạo (Executive Burnout) tại Phòng khám Quốc tế CarePlus.',
      supportAreas: ['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS'],
      languages: ['vi', 'en', 'fr'],
      yearsOfExperience: 17,
      timezone: 'Asia/Ho_Chi_Minh',
      hospitalOrAffiliation: 'BV Tâm Thần TP.HCM • PKQT CarePlus',
    },
  },
  {
    id: 'amend-bt-309',
    accountId: 'f3090993-81bb-4d51-8212-62778245335c',
    displayName: 'ThS. Tâm lý Lê Bảo Trâm',
    specialistCode: '#MB-309',
    hospitalOrAffiliation: 'Viện Tâm lý Việt - Pháp',
    initials: 'BT',
    submittedAt: '2026-11-09T09:15:00Z',
    slaRemaining: 'SLA còn: 1h50m',
    isUrgentSla: true,
    approvedProfile: {
      displayName: 'ThS. Tâm lý Lê Bảo Trâm',
      bio: 'Thạc sĩ Tâm lý học lâm sàng trẻ em & vị thành niên. Có chứng chỉ tham vấn gia đình và chuyên môn can thiệp rối loạn lo âu xã hội ở học sinh - sinh viên.',
      supportAreas: ['ANXIETY_SYMPTOMS'],
      languages: ['vi'],
      yearsOfExperience: 6,
      timezone: 'Asia/Ho_Chi_Minh',
      hospitalOrAffiliation: 'Viện Tâm lý Việt - Pháp • Can thiệp Học đường',
    },
    proposedProfile: {
      displayName: 'ThS. Tâm lý Lê Bảo Trâm',
      bio: 'Thạc sĩ Tâm lý học lâm sàng trẻ em & vị thành niên. Đã hoàn thành khóa đào tạo Trị liệu Chấp nhận & Cam kết (ACT) tại Hiệp hội Tâm lý học Hoa Kỳ (APA). Mở rộng can thiệp rối loạn hoảng sợ và trầm cảm tuổi học đường.',
      supportAreas: ['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS'],
      languages: ['vi', 'en'],
      yearsOfExperience: 7,
      timezone: 'Asia/Ho_Chi_Minh',
      hospitalOrAffiliation: 'Viện Tâm lý Việt - Pháp & Trường Quốc tế BVIS',
    },
  },
]
