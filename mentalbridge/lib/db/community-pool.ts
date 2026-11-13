import 'server-only'
import type { Pool as PgPool, PoolClient } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var __communityPool: PgPool | undefined
  // eslint-disable-next-line no-var
  var __non_webpack_require__: any
}

function getPgPoolClass() {
  const nodeRequire =
    typeof __non_webpack_require__ !== 'undefined'
      ? __non_webpack_require__
      : eval('require')
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

export const communityPool: PgPool =
  global.__communityPool ?? createPool()

global.__communityPool = communityPool

export type { PoolClient }
