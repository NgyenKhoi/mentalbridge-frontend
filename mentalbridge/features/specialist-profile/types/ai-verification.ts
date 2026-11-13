export type DocumentAiType = 'CCHN' | 'DIPLOMA' | 'PRACTICE' | 'CRIMINAL_RECORD'

export type BoundingBoxRegion = {
  id: string
  label: string
  text: string
  confidence: number // 0 to 100
  box: {
    top: number // percentage
    left: number // percentage
    width: number // percentage
    height: number // percentage
  }
}

export type PaddleOcrResult = {
  rawText: string
  confidenceScore: number // e.g. 99.4
  detectedLanguage: string // 'vi' | 'en'
  fields: {
    documentType: 'DEGREE' | 'LICENSE' | 'CERTIFICATE'
    documentTitle: string
    recipientName: string
    documentNumber: string
    regNumber?: string
    issuerName: string
    issueDate: string
    issueYear: number
    expiryDate?: string
    majorOrScope: string
    graduationRank?: string
    signatoryName?: string
    signatoryTitle?: string
  }
  regions: BoundingBoxRegion[]
}

export type ForensicsCheckItem = {
  name: string
  description: string
  status: 'PASS' | 'WARNING' | 'ALERT'
  score: number // 0 to 100
  detail: string
}

export type DocumentForensicsResult = {
  status: 'GENUINE' | 'SUSPICIOUS' | 'TAMPERED'
  authenticityScore: number // e.g. 99.2%
  tamperingRisk: number // e.g. 0.8%
  compressionUniformity: number // e.g. 99.5%
  fontConsistencyScore: number // e.g. 98.9%
  edgeSharpnessScore: number // e.g. 99.1%
  checks: ForensicsCheckItem[]
  verdictSummary: string
}

export type ExtendVerifyResult = {
  status: 'VERIFIED' | 'FLAGGED' | 'WARNING'
  fraudRiskScore: number // e.g. 1.1%
  securityFeatures: {
    nationalEmblemWatermark: {
      status: 'VERIFIED' | 'FAILED'
      detail: string
    }
    guillochePattern: {
      status: 'VERIFIED' | 'FAILED'
      detail: string
    }
    hologramSeal: {
      status: 'VERIFIED' | 'FAILED'
      detail: string
    }
    redStampAuthenticity: {
      status: 'VERIFIED' | 'FAILED'
      detail: string
    }
    pkiDigitalSignature: {
      status: 'VERIFIED' | 'FAILED'
      signer: string
      algorithm: string
      timestamp: string
      certStatus: string
    }
  }
  antiFraudConclusion: string
}

export type NationalCrossReferenceResult = {
  status: 'MATCHED' | 'MISMATCHED' | 'NOT_FOUND'
  registryName: string // e.g. "CSDL Văn bằng Quốc gia - Bộ GD&ĐT" | "CSDL CCHN Khám chữa bệnh - Bộ Y Tế"
  queryReferenceCode: string // e.g. "MOET-VB-2019-81203" | "BYT-CCHN-019283-HCM"
  matchPercentage: number // e.g. 100
  syncedAt: string
  officialRecord: {
    fullName: string
    documentNumber: string
    regBookNumber?: string
    issueDate: string
    issuingAuthority: string
    specialtyOrScope: string
    legalStatus: string
  }
}

export type CompleteAiVerificationReport = {
  documentId: string
  documentType: DocumentAiType
  sha256Checksum: string
  overallConfidenceScore: number
  overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  verdictRecommendation: 'APPROVE_CLINICAL' | 'REQUEST_ORIGINAL' | 'REJECT_FRAUD'
  paddleOcr: PaddleOcrResult
  forensics: DocumentForensicsResult
  extendVerify: ExtendVerifyResult
  crossReference: NationalCrossReferenceResult
  auditTrail: {
    scannedAt: string
    engineVersion: string
    operatorNote: string
  }
}
