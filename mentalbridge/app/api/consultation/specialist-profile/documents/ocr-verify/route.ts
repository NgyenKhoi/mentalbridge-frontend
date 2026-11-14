import { NextResponse, type NextRequest } from 'next/server'
import {
  generateCompleteVerificationReport,
  getDocumentForensicsAnalysis,
  getExtendVerifyAnalysis,
  getNationalCrossReference,
  getPaddleOcrAnalysis,
} from '@/features/specialist-profile/services/ai-verification-engine'
import type { DocumentAiType } from '@/features/specialist-profile/types/ai-verification'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const documentType: DocumentAiType =
      body.documentType === 'DIPLOMA' ? 'DIPLOMA' : 'CCHN'
    const specialistName: string = body.specialistName || 'ThS. BS. Hồ Thị Hồng'
    const documentNumber: string =
      body.documentNumber ||
      (documentType === 'DIPLOMA' ? 'MS-8812' : '019283/BYT')
    const sha256: string =
      body.sha256 || 'd9f824b7a12e84c9034fbe7193bca9810f27b1a8'

    const report = generateCompleteVerificationReport(
      documentType,
      specialistName,
      documentNumber,
      sha256,
    )

    return NextResponse.json({
      success: true,
      data: report,
      metadata: {
        ocrEngine: 'PaddleOCR PP-OCRv6 (Vi-En Dual Core)',
        forensicsEngine:
          'Discrete Cosine Transform (DCT) Error Level Analysis 90%',
        extendVerifyVersion: 'v2.4 - Anti-Counterfeit 5 Layers',
        officialRegistries: [
          'Cơ sở dữ liệu Người hành nghề KCB - Sở Y tế TP.HCM',
          'Hệ thống Quản lý Văn bằng Quốc gia - Bộ GD&ĐT',
        ],
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Lỗi xử lý xác minh tài liệu.',
      },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const type = (searchParams.get('type') || 'CCHN') as DocumentAiType
  const name = searchParams.get('name') || 'ThS. BS. Hồ Thị Hồng'
  const code = searchParams.get('code') || '019283/BYT'

  const ocr = getPaddleOcrAnalysis(type, name, code)
  const forensics = getDocumentForensicsAnalysis(type)
  const extend = getExtendVerifyAnalysis(type)
  const cross = getNationalCrossReference(type, name, code)

  return NextResponse.json({
    success: true,
    data: {
      ocr,
      forensics,
      extendVerify: extend,
      crossReference: cross,
    },
  })
}
