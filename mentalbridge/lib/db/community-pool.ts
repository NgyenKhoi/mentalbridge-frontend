import 'server-only'
import type { Pool as PgPool, PoolClient } from 'pg'

type NodeRequireFn = (id: string) => { Pool: new (config: unknown) => PgPool }

declare global {
  var __communityPool: PgPool | undefined
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
      process.env.COMMUNITY_DB_HOST ||
      'mentalbridge-dev.cxogac0wcrj9.ap-southeast-1.rds.amazonaws.com',
    port: Number(process.env.COMMUNITY_DB_PORT || 5432),
    user: process.env.COMMUNITY_DB_USERNAME || 'postgres',
    password: process.env.COMMUNITY_DB_PASSWORD || 'eqfleqrd1',
    database: process.env.COMMUNITY_DB_NAME || 'mentalbridge_community',
    ssl: {
      rejectUnauthorized: false,
    },
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  })
}

export function getCommunityPool(): PgPool {
  if (!global.__communityPool) {
    global.__communityPool = createPool()
  }
  return global.__communityPool
}

export const communityPool: PgPool = new Proxy({} as PgPool, {
  get(_target, prop) {
    const pool = getCommunityPool()
    const value = (pool as unknown as Record<string | symbol, unknown>)[prop]
    return typeof value === 'function' ? value.bind(pool) : value
  },
})

export type { PoolClient }
