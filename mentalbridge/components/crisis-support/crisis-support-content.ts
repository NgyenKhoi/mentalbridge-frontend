export const CRISIS_SUPPORT_CONTENT = {
  version: 'mb-crisis-support-vi-vn-v1',
  locale: 'vi-VN',
  reviewedAt: '2026-09-25',
  contacts: [
    {
      id: 'national-emergency',
      name: 'Tổng đài khẩn cấp quốc gia',
      availability: '24/7',
      displayPhone: '112',
      href: 'tel:112',
      sourceReference:
        'https://xaydungchinhsach.chinhphu.vn/tong-dai-so-112-tiep-nhan-24-7-cac-thong-tin-ve-su-co-thien-tai-tham-hoa-119250902150528929.htm',
    },
    {
      id: 'medical-emergency',
      name: 'Cấp cứu y tế',
      availability: null,
      displayPhone: '115',
      href: 'tel:115',
      sourceReference:
        'https://congbaocdn.chinhphu.vn/CongBaoCP/VanBan/2022/3/36965/40179-1-2022289-29004-vbhn-btttt.pdf',
    },
  ],
} as const
