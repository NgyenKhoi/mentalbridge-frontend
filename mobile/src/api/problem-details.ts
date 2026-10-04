import { z } from 'zod'

const violationSchema = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string().optional(),
})

const problemDetailsSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int().min(400).max(599),
    code: z.string(),
    correlationId: z.string(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    violations: z.array(violationSchema).optional(),
  })
  .loose()

export type ProblemDetails = z.infer<typeof problemDetailsSchema>

export function parseProblemDetails(value: unknown): ProblemDetails | null {
  const result = problemDetailsSchema.safeParse(value)
  return result.success ? result.data : null
}
