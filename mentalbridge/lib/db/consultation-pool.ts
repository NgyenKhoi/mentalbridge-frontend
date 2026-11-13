import 'server-only'
import type { Pool as PgPool, PoolClient } from 'pg'

type NodeRequireFn = (id: string) => { Pool: new (config: unknown) => PgPool }

declare global {
  var __consultationPool: PgPool | undefined
  var __non_webpack_require__: NodeRequireFn | undefined
}

function getPgPoolClass() {
  const nodeRequire =
    typeof __non_webpack_require__ !== 'undefined'
      ? __non_webpack_require__
      : (eval('require') as NodeRequireFn)
  const pg = nodeRequire('pg')
  return pg.Pool
}

function createPool(): PgPool {
  const PoolClass = getPgPoolClass()
  return new PoolClass({
    host:
      process.env.CONSULTATION_DB_HOST ||
      'mentalbridge-dev.cxogac0wcrj9.ap-southeast-1.rds.amazonaws.com',
    port: Number(process.env.CONSULTATION_DB_PORT || 5432),
    user: process.env.CONSULTATION_DB_USERNAME || 'postgres',
    password: process.env.CONSULTATION_DB_PASSWORD || 'eqfleqrd1',
    database: process.env.CONSULTATION_DB_NAME || 'mentalbridge_consultation',
    ssl: {
      rejectUnauthorized: false,
    },
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  })
}

export const consultationPool: PgPool =
  global.__consultationPool ?? createPool()

global.__consultationPool = consultationPool

export type { PoolClient }
