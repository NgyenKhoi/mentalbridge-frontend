import type {
  components,
  operations,
  paths,
} from '@/contracts/content.generated'

type Schemas = components['schemas']

export type ContentPaths = paths
export type ContentOperations = operations
export type ResourceCategory = Schemas['ResourceCategory']
export type ResourceSummary = Schemas['ResourceSummary']
export type ResourceListResponse = Schemas['ResourceListResponse']
