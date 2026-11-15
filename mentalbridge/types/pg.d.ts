/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'pg' {
  export type QueryResultRow = any

  export interface QueryResult<R = any> {
    rows: R[]
    rowCount: number | null
    command: string
    oid: number
    fields: any[]
  }

  export interface PoolConfig {
    host?: string
    port?: number
    user?: string
    password?: string
    database?: string
    ssl?: boolean | { rejectUnauthorized?: boolean }
    max?: number
    idleTimeoutMillis?: number
    connectionTimeoutMillis?: number
  }

  export class PoolClient {
    query<R = any>(queryText: string, values?: any[]): Promise<QueryResult<R>>
    release(err?: Error | boolean): void
  }

  export class Pool {
    constructor(config?: PoolConfig)
    connect(): Promise<PoolClient>
    query<R = any>(queryText: string, values?: any[]): Promise<QueryResult<R>>
    end(): Promise<void>
  }
}
