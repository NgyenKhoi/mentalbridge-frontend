import type { PublicResourceDetail } from '../api/browser-resources'

export type StructuredResourceContent = Readonly<{
  overview?: string
  whenUseful?: string
  keyIdeas: readonly string[]
  steps: readonly string[]
  cautions: readonly string[]
  nextStep?: string
}>

function nonEmptyText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined
}

export function structuredResourceContent(
  resource: PublicResourceDetail,
): StructuredResourceContent {
  const content = resource.structuredContent
  const textList = (value: unknown) =>
    Array.isArray(value)
      ? value.flatMap((item) => {
          const text = nonEmptyText(item)
          return text ? [text] : []
        })
      : []

  return {
    overview: nonEmptyText(content?.overview),
    whenUseful: nonEmptyText(content?.whenUseful),
    keyIdeas: textList(content?.keyIdeas),
    steps: textList(content?.steps),
    cautions: textList(content?.cautions),
    nextStep: nonEmptyText(content?.nextStep),
  }
}
