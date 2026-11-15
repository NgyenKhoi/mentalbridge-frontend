/**
 * credential-file-evidence.ts
 * Browser-safe credential reading: SHA-256, PDF text layer (pdfjs-dist),
 * image OCR (tesseract.js), JPEG compression-map (ELA).
 * No Node.js modules used — safe for Next.js client bundles.
 */

import type { CredentialType } from '../api/credential-validation'

export const maxCredentialFileBytes = 10 * 1024 * 1024
const maxPagesToRead = 3
const acceptedMediaTypes = ['application/pdf', 'image/jpeg', 'image/png']

export function supportedCredentialFile(file: Blob) {
  return (
    file.size > 0 &&
    file.size <= maxCredentialFileBytes &&
    acceptedMediaTypes.includes(file.type)
  )
}

export function extractCredentialFields(text: string) {
  const lines = text
    .normalize('NFC')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter(Boolean)

  function labeled(label: RegExp) {
    for (const [index, line] of lines.entries()) {
      const match = line.match(label)
      if (!match) continue
      if (match[1]?.trim()) return match[1].trim()
      const nextLine = lines[index + 1]
      if (/[:：]$/.test(line) && nextLine && !/[:：]/.test(nextLine))
        return nextLine
    }
    return ''
  }

  const title =
    lines
      .slice(0, 18)
      .find((line) =>
        /^(?:Giấy phép hành nghề|Chứng chỉ hành nghề|Bằng (?:tốt nghiệp|cử nhân|thạc sĩ|tiến sĩ)|Chứng nhận)(?:\s|$)/i.test(
          line,
        ),
      ) ?? ''

  const credentialType: CredentialType | undefined = /hành nghề/i.test(title)
    ? 'LICENSE'
    : /^bằng /i.test(title)
      ? 'DEGREE'
      : title
        ? 'CERTIFICATE'
        : undefined

  const issuer =
    labeled(/^(?:Nơi cấp|Cơ quan cấp|Đơn vị cấp|Cơ sở cấp)\s*[:：]\s*(.*)$/i) ||
    lines
      .slice(0, 8)
      .find((line) =>
        /^(?:Sở Y tế|Trường Đại học|Học viện)\s+\S/i.test(line),
      ) ||
    ''

  const date =
    labeled(/^(?:Ngày cấp|Cấp ngày)(?:\s*[:：]\s*|\s+)(.*)$/i) ||
    labeled(
      /^(?:[^\d]+,\s*)?(ngày\s+\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+\d{4})$/i,
    )

  const year = date.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? ''

  return {
    title: title.slice(0, 160),
    credentialType,
    issuer: issuer.slice(0, 160),
    issueYear: year && Number(year) <= new Date().getFullYear() ? year : '',
    issueDate: year ? date : '',
    holder: labeled(/^(?:Họ và tên|Họ tên|Cấp cho)\s*[:：]\s*(.*)$/i),
    documentNumber: labeled(
      /^(?:Số giấy phép|Số CCHN|Số GPHN|Số chứng chỉ|Số hiệu văn bằng|Số vào sổ gốc)\s*[:：]\s*(.*)$/i,
    ),
  }
}

export type CredentialReading = {
  text: string
  sources: Array<'PDF_TEXT' | 'TESSERACT_OCR'>
  pagesRead: number
  pageCount: number
  signatureFields: number | null
  fields: ReturnType<typeof extractCredentialFields>
}

// ─── SHA-256 (Web Crypto API — no Node.js) ───────────────────────────────────

export async function credentialFileSha256(file: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

// ─── Tesseract OCR (browser worker, dynamically imported) ────────────────────

async function ocrImage(
  imageOrCanvas: Blob | HTMLCanvasElement,
  signal: AbortSignal,
): Promise<string> {
  signal.throwIfAborted()

  // Dynamically import tesseract.js — the worker script is served from CDN
  // so no webpack bundling issues.
  const { createWorker } = await import('tesseract.js')

  // Use CDN paths for worker & language data to avoid bundler issues
  const worker = await createWorker('vie+eng', 1, {
    workerPath:
      'https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/worker.min.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    corePath:
      'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js',
    logger: () => undefined,
  })

  signal.addEventListener(
    'abort',
    () => {
      void worker.terminate()
    },
    { once: true },
  )

  try {
    signal.throwIfAborted()
    let imageSource: Parameters<typeof worker.recognize>[0]
    if (imageOrCanvas instanceof HTMLCanvasElement) {
      // Convert canvas to Blob for Tesseract
      const blob = await new Promise<Blob | null>((resolve) =>
        imageOrCanvas.toBlob(resolve, 'image/png'),
      )
      imageSource = blob ?? imageOrCanvas.toDataURL()
    } else {
      imageSource = URL.createObjectURL(imageOrCanvas)
    }
    const { data } = await worker.recognize(imageSource)
    if (typeof imageSource === 'string' && imageSource.startsWith('blob:')) {
      URL.revokeObjectURL(imageSource)
    }
    return data.text ?? ''
  } finally {
    await worker.terminate().catch(() => undefined)
  }
}

// ─── Main read function ───────────────────────────────────────────────────────

export async function readCredentialFile(
  file: Blob,
  signal: AbortSignal,
): Promise<CredentialReading> {
  if (!supportedCredentialFile(file))
    throw new Error('Định dạng tệp không hỗ trợ.')

  const sources = new Set<CredentialReading['sources'][number]>()
  const pages: string[] = []
  let pageCount = 1
  let signatureFields: number | null = null

  if (file.type === 'application/pdf') {
    const pdf = await import('pdfjs-dist')
    pdf.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()

    const data = await file.arrayBuffer()
    signal.throwIfAborted()

    const task = pdf.getDocument({
      data,
      isEvalSupported: false,
      enableXfa: false,
      maxImageSize: 16_000_000,
    })
    const stop = () => {
      void task.destroy().catch(() => undefined)
    }
    signal.addEventListener('abort', stop, { once: true })

    try {
      const doc = await task.promise
      pageCount = doc.numPages

      const fields = await doc.getFieldObjects()
      signatureFields = Object.values(fields ?? {})
        .flat()
        .filter((field) => 'type' in field && field.type === 'signature').length

      for (
        let index = 1;
        index <= Math.min(pageCount, maxPagesToRead);
        index++
      ) {
        signal.throwIfAborted()
        const page = await doc.getPage(index)
        const content = await page.getTextContent()
        const text = content.items
          .map((item) =>
            'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '',
          )
          .join('')
          .trim()

        if (text.replace(/\s/g, '').length >= 25) {
          sources.add('PDF_TEXT')
          pages.push(text)
        } else {
          // PDF page has no text layer → rasterise and OCR
          const native = page.getViewport({ scale: 1 })
          const viewport = page.getViewport({
            scale: Math.min(3, 2000 / Math.max(native.width, native.height)),
          })
          const canvas = window.document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          await page.render({ canvas, viewport }).promise
          const ocrText = await ocrImage(canvas, signal)
          if (ocrText.trim()) {
            sources.add('TESSERACT_OCR')
            pages.push(ocrText)
          }
        }
        page.cleanup()
      }
    } finally {
      signal.removeEventListener('abort', stop)
      await task.destroy()
    }
  } else {
    // JPEG / PNG image — OCR directly
    const ocrText = await ocrImage(file, signal)
    if (ocrText.trim()) {
      sources.add('TESSERACT_OCR')
      pages.push(ocrText)
    }
  }

  const text = pages.join('\n\n').slice(0, 30_000)
  return {
    text,
    sources: [...sources],
    pagesRead: pages.length,
    pageCount,
    signatureFields,
    fields: extractCredentialFields(text),
  }
}

// ─── JPEG Error Level Analysis (ELA) ─────────────────────────────────────────

export async function jpegCompressionMap(file: Blob) {
  if (file.type !== 'image/jpeg') return null
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width * bitmap.height > 6_000_000) return null
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0)
    const original = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const recompressed = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    )
    if (!recompressed) return null
    const compressed = await createImageBitmap(recompressed)
    try {
      ctx.drawImage(compressed, 0, 0)
      const delta = ctx.getImageData(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < delta.data.length; i += 4) {
        for (let channel = 0; channel < 3; channel++) {
          delta.data[i + channel] =
            Math.abs(original.data[i + channel] - delta.data[i + channel]) * 6
        }
      }
      ctx.putImageData(delta, 0, 0)
      return {
        url: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
      }
    } finally {
      compressed.close()
    }
  } finally {
    bitmap.close()
  }
}
