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

export function getConsultationPool(): PgPool {
  if (!global.__consultationPool) {
    global.__consultationPool = createPool()
  }
  return global.__consultationPool
}

export const consultationPool: PgPool = new Proxy({} as PgPool, {
  get(_target, prop) {
    const pool = getConsultationPool()
    const value = (pool as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? value.bind(pool) : value
  },
})

export type { PoolClient }
