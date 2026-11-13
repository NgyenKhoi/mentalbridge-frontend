import type {
  CompleteAiVerificationReport,
  DocumentAiType,
  DocumentForensicsResult,
  ExtendVerifyResult,
  NationalCrossReferenceResult,
  PaddleOcrResult,
} from '../types/ai-verification'

export function getPaddleOcrAnalysis(
  docType: DocumentAiType = 'CCHN',
  specialistName = 'ThS. BS. Hồ Thị Hồng',
  docNumber = '019283/BYT',
): PaddleOcrResult {
  const cleanName = specialistName
    .replace(/^(ThS\.|BS\.|TS\.|CKI\.)\s*/gi, '')
    .trim()
    .toUpperCase()

  if (docType === 'DIPLOMA') {
    return {
      rawText: `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\nBỘ GIÁO DỤC VÀ ĐÀO TẠO - BỘ Y TẾ\nĐẠI HỌC Y DƯỢC TP. HỒ CHÍ MINH\nBẰNG THẠC SĨ\nHIỆU TRƯỞNG TRƯỜNG ĐẠI HỌC Y DƯỢC TP. HỒ CHÍ MINH\nCÔNG NHẬN: ${cleanName}\nSinh ngày 15 tháng 05 năm 1978\nĐã hoàn thành chương trình đào tạo Thạc sĩ\nNgành: Tâm lý học lâm sàng (Clinical Psychology)\nXếp loại tốt nghiệp: Giỏi\nSố hiệu văn bằng: ${docNumber || 'MS-8812'}/YDS-2019\nSố vào sổ cấp bằng: 812/YDS-SĐH\nTP. Hồ Chí Minh, ngày 18 tháng 11 năm 2019\nHIỆU TRƯỞNG: GS. TS. TRẦN DIỆP TUẤN`,
      confidenceScore: 99.6,
      detectedLanguage: 'vi',
      fields: {
        documentType: 'DEGREE',
        documentTitle: 'Bằng Thạc sĩ Tâm lý học lâm sàng',
        recipientName: cleanName,
        documentNumber: `${docNumber || 'MS-8812'}/YDS-2019`,
        regNumber: '812/YDS-SĐH',
        issuerName: 'Đại học Y Dược TP.HCM',
        issueDate: '18/11/2019',
        issueYear: 2019,
        majorOrScope: 'Tâm lý học lâm sàng (Clinical Psychology)',
        graduationRank: 'Giỏi',
        signatoryName: 'GS. TS. Trần Diệp Tuấn',
        signatoryTitle: 'Hiệu trưởng Đại học Y Dược TP.HCM',
      },
      regions: [
        {
          id: 'reg-title',
          label: 'TIÊU ĐỀ VĂN BẰNG',
          text: 'BẰNG THẠC SĨ',
          confidence: 99.8,
          box: { top: 22, left: 28, width: 44, height: 6 },
        },
        {
          id: 'reg-name',
          label: 'HỌ VÀ TÊN',
          text: cleanName,
          confidence: 99.7,
          box: { top: 38, left: 32, width: 36, height: 5 },
        },
        {
          id: 'reg-major',
          label: 'NGÀNH ĐÀO TẠO',
          text: 'Tâm lý học lâm sàng (Clinical Psychology)',
          confidence: 99.5,
          box: { top: 52, left: 24, width: 52, height: 5 },
        },
        {
          id: 'reg-code',
          label: 'SỐ HIỆU VĂN BẰNG',
          text: `${docNumber || 'MS-8812'}/YDS-2019`,
          confidence: 99.9,
          box: { top: 76, left: 10, width: 35, height: 5 },
        },
      ],
    }
  }

  // Default CCHN
  return {
    rawText: `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc\nBỘ Y TẾ - SỞ Y TẾ THÀNH PHỐ HỒ CHÍ MINH\nCHỨNG CHỈ HÀNH NGHỀ KHÁM BỆNH, CHỮA BỆNH\nCấp cho: ${cleanName}\nNgày sinh: 15/05/1978\nNơi sinh: TP. Hồ Chí Minh\nSố CMND/CCCD: 079178002931\nTrình độ chuyên môn: Bác sĩ Chuyên khoa Nội tổng quát / Tâm thần\nPhạm vi hoạt động chuyên môn: Khám bệnh, chữa bệnh chuyên khoa Tâm thần - Tâm lý học lâm sàng\nSố chứng chỉ: ${docNumber || '019283/BYT'}\nNơi cấp: Sở Y tế Thành phố Hồ Chí Minh\nNgày cấp: 12/04/2021\nGIÁM ĐỐC SỞ Y TẾ: TS. BS. NGUYỄN TẤN BỈNH (ĐÃ KÝ SỐ)`,
    confidenceScore: 99.8,
    detectedLanguage: 'vi',
    fields: {
      documentType: 'LICENSE',
      documentTitle: 'Chứng chỉ hành nghề khám bệnh, chữa bệnh',
      recipientName: cleanName,
      documentNumber: docNumber || '019283/BYT',
      regNumber: '1842/QĐ-SYT',
      issuerName: 'Sở Y Tế TP. Hồ Chí Minh',
      issueDate: '12/04/2021',
      issueYear: 2021,
      expiryDate: '15/04/2029',
      majorOrScope: 'Khám bệnh, chữa bệnh chuyên khoa Tâm thần - Tâm lý lâm sàng',
      signatoryName: 'TS. BS. Nguyễn Tấn Bỉnh',
      signatoryTitle: 'Giám đốc Sở Y tế TP.HCM',
    },
    regions: [
      {
        id: 'reg-nation',
        label: 'QUỐC HIỆU & TIÊU NGỮ',
        text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
        confidence: 99.9,
        box: { top: 6, left: 20, width: 60, height: 5 },
      },
      {
        id: 'reg-title',
        label: 'TIÊU ĐỀ CHỨNG CHỈ',
        text: 'CHỨNG CHỈ HÀNH NGHỀ KHÁM BỆNH, CHỮA BỆNH',
        confidence: 99.8,
        box: { top: 18, left: 15, width: 70, height: 6 },
      },
      {
        id: 'reg-name',
        label: 'NGƯỜI ĐƯỢC CẤP',
        text: cleanName,
        confidence: 99.9,
        box: { top: 32, left: 30, width: 40, height: 5 },
      },
      {
        id: 'reg-scope',
        label: 'PHẠM VI CHUYÊN MÔN',
        text: 'Khám bệnh, chữa bệnh chuyên khoa Tâm thần - Tâm lý học lâm sàng',
        confidence: 99.6,
        box: { top: 50, left: 35, width: 55, height: 6 },
      },
      {
        id: 'reg-number',
        label: 'SỐ CHỨNG CHỈ HÀNH NGHỀ',
        text: docNumber || '019283/BYT',
        confidence: 99.9,
        box: { top: 62, left: 32, width: 30, height: 5 },
      },
      {
        id: 'reg-signature',
        label: 'CHỮ KÝ SỐ & DẤU MỘC',
        text: 'SỞ Y TẾ TP. HỒ CHÍ MINH - ĐÃ XÁC THỰC CKS',
        confidence: 99.4,
        box: { top: 75, left: 58, width: 35, height: 18 },
      },
    ],
  }
}

export function getDocumentForensicsAnalysis(
  docType: DocumentAiType = 'CCHN',
): DocumentForensicsResult {
  return {
    status: 'GENUINE',
    authenticityScore: 99.2,
    tamperingRisk: 0.8,
    compressionUniformity: 99.5,
    fontConsistencyScore: 98.9,
    edgeSharpnessScore: 99.1,
    verdictSummary:
      'Ảnh quét có mức nén DCT đồng nhất 99.5%, phông chữ căn lề baseline chuẩn Nghị định 30/2020/NĐ-CP, không có dấu hiệu tẩy xóa hay chắp vá pixel.',
    checks: [
      {
        name: 'Phân tích mức nén ELA (Error Level Analysis)',
        description: 'Đánh giá ma trận nén JPEG DCT toàn trang',
        status: 'PASS',
        score: 99.5,
        detail: 'Độ đồng nhất nén DCT đạt 99.5%. Vùng văn bản và số CCHN không có biến thiên lượng tử hóa.',
      },
      {
        name: 'Quét bản sao chép vùng điểm ảnh (Copy-Move)',
        description: 'Tìm kiếm vùng lặp lại giả mạo',
        status: 'PASS',
        score: 99.8,
        detail: 'Không phát hiện cụm pixel trùng lặp trên nền phôi bảo an và con dấu mộc đỏ.',
      },
      {
        name: 'Căn chỉnh phông chữ & Khoảng cách Kerning',
        description: 'Kiểm tra độ đều ký tự chuẩn văn bản hành chính',
        status: 'PASS',
        score: 98.9,
        detail: 'Văn bản tuân thủ lưới baseline chuẩn quốc gia, không phát hiện phông chữ lạ bị chèn thêm.',
      },
      {
        name: 'Hướng chiếu sáng & Đổ bóng quang học',
        description: 'Kiểm tra độ phản xạ tự nhiên của mực',
        status: 'PASS',
        score: 99.1,
        detail: 'Mực in và mộc dấu chìm tự nhiên vào sợi giấy, phản xạ góc 45 độ chuẩn máy scan phẳng.',
      },
    ],
  }
}

export function getExtendVerifyAnalysis(
  docType: DocumentAiType = 'CCHN',
): ExtendVerifyResult {
  return {
    status: 'VERIFIED',
    fraudRiskScore: 1.1,
    antiFraudConclusion:
      'Văn bằng đạt chuẩn 5/5 lớp phòng vệ chống giả mạo quốc gia. Chữ ký số và mộc đỏ hợp lệ.',
    securityFeatures: {
      nationalEmblemWatermark: {
        status: 'VERIFIED',
        detail: 'Quốc huy in chìm sắc nét, hoa văn dạ quang phản xạ đồng đều dưới bước sóng UV.',
      },
      guillochePattern: {
        status: 'VERIFIED',
        detail: 'Hoa văn hình học vi mô Guilloche 0.05mm sắc nét, liên tục không đứt đoạn.',
      },
      hologramSeal: {
        status: 'VERIFIED',
        detail: 'Tem chống giả Hologram 3D đổi màu góc rộng theo tiêu chuẩn Cục Quản lý Khám chữa bệnh.',
      },
      redStampAuthenticity: {
        status: 'VERIFIED',
        detail: 'Mộc đỏ Sở Y tế TP.HCM tươi màu, vết mực thẩm thấu tự nhiên vào thớ giấy bảo an.',
      },
      pkiDigitalSignature: {
        status: 'VERIFIED',
        signer: 'TS. BS. Nguyễn Tấn Bỉnh (Giám đốc Sở Y tế TP.HCM)',
        algorithm: 'SHA-256 with RSA 2048-bit (Ban Cơ yếu Chính phủ)',
        timestamp: '2021-04-12T09:15:20Z (TSA Verified)',
        certStatus: 'HỢP LỆ VÀ CÒN HIỆU LỰC',
      },
    },
  }
}

export function getNationalCrossReference(
  docType: DocumentAiType = 'CCHN',
  specialistName = 'ThS. BS. Hồ Thị Hồng',
  docNumber = '019283/BYT',
): NationalCrossReferenceResult {
  const cleanName = specialistName
    .replace(/^(ThS\.|BS\.|TS\.|CKI\.)\s*/gi, '')
    .trim()

  if (docType === 'DIPLOMA') {
    return {
      status: 'MATCHED',
      registryName: 'Hệ thống Quản lý Văn bằng Quốc gia - Cục Quản lý Chất lượng (Bộ GD&ĐT)',
      queryReferenceCode: `MOET-VB-2019-${docNumber.replace(/[^0-9]/g, '') || '8812'}`,
      matchPercentage: 100,
      syncedAt: '2026-11-09T04:16:32Z',
      officialRecord: {
        fullName: cleanName,
        documentNumber: `${docNumber || 'MS-8812'}/YDS-2019`,
        regBookNumber: '812/YDS-SĐH',
        issueDate: '18/11/2019',
        issuingAuthority: 'Trường Đại học Y Dược Thành phố Hồ Chí Minh',
        specialtyOrScope: 'Tâm lý học lâm sàng (Clinical Psychology)',
        legalStatus: 'VĂN BẰNG GỐC CHÍNH QUY HỢP PHÁP TRÊN CSDL BỘ GD&ĐT',
      },
    }
  }

  return {
    status: 'MATCHED',
    registryName: 'Cơ sở Dữ liệu Quốc gia Người hành nghề KCB - Sở Y tế TP.HCM',
    queryReferenceCode: `BYT-CCHN-${docNumber || '019283/BYT'}`,
    matchPercentage: 100,
    syncedAt: '2026-11-09T04:16:32Z',
    officialRecord: {
      fullName: cleanName,
      documentNumber: docNumber || '019283/BYT',
      regBookNumber: '1842/QĐ-SYT',
      issueDate: '12/04/2021',
      issuingAuthority: 'Sở Y tế Thành phố Hồ Chí Minh',
      specialtyOrScope: 'Khám bệnh, chữa bệnh chuyên khoa Tâm thần - Tâm lý lâm sàng',
      legalStatus: 'ĐANG HOẠT ĐỘNG - ĐƯỢC PHÉP HÀNH NGHỀ TOÀN QUỐC',
    },
  }
}

export function generateCompleteVerificationReport(
  docType: DocumentAiType = 'CCHN',
  specialistName = 'ThS. BS. Hồ Thị Hồng',
  docNumber = '019283/BYT',
  sha256 = 'd9f824b7a12e84c9034fbe7193bca9810f27b1a8',
): CompleteAiVerificationReport {
  return {
    documentId: `doc-${docType.toLowerCase()}-${docNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
    documentType: docType,
    sha256Checksum: sha256,
    overallConfidenceScore: 99.7,
    overallRiskLevel: 'LOW',
    verdictRecommendation: 'APPROVE_CLINICAL',
    paddleOcr: getPaddleOcrAnalysis(docType, specialistName, docNumber),
    forensics: getDocumentForensicsAnalysis(docType),
    extendVerify: getExtendVerifyAnalysis(docType),
    crossReference: getNationalCrossReference(docType, specialistName, docNumber),
    auditTrail: {
      scannedAt: new Date().toISOString(),
      engineVersion: 'MentalBridge AI Pipeline v2.4 (PaddleOCR + Forensics)',
      operatorNote: 'Tài liệu đã được đối soát 5 lớp: OCR, ELA, Phôi bảo mật, CSDL Quốc gia và Băm SHA-256.',
    },
  }
}
