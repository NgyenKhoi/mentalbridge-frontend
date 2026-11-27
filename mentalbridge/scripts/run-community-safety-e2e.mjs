import { spawn, execFileSync } from 'node:child_process'
import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { join, resolve } from 'node:path'

const backend = process.env.MB693_BACKEND_DIR
if (!backend || !existsSync(join(backend, 'community-service/pom.xml'))) {
  throw new Error(
    'MB693_BACKEND_DIR must identify the reviewed backend checkout',
  )
}
const root = process.cwd()
const content = join(backend, 'content-notification-service')
const realtime = join(backend, 'realtime-service')
const java = process.env.MB693_JAVA ?? 'java'
const output = resolve('test-results/mb693-runtime')
const requireBackend = createRequire(join(content, 'package.json'))
const { GenericContainer, Wait } = requireBackend('testcontainers')
const { KafkaContainer } = requireBackend('@testcontainers/kafka')
const { Kafka, logLevel } = requireBackend('kafkajs')
const containers = []
const children = []
const servicesReady = []
const password = randomBytes(24).toString('base64url')
const serviceToken = randomBytes(32).toString('base64url')
const encryptionKey = randomBytes(32).toString('base64')
const userA = 'mb693-a@synthetic.invalid'
const userB = 'mb693-b@synthetic.invalid'
const key = () =>
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
const identityKeys = key()
const contentKeys = key()
const realtimeKeys = key()
const bffKeys = key()
const base = Object.fromEntries(
  Object.entries(process.env).filter(([name]) =>
    /^(PATH|Path|SystemRoot|SYSTEMROOT|WINDIR|COMSPEC|ComSpec|TEMP|TMP|USERPROFILE|HOME|APPDATA|LOCALAPPDATA|DOCKER_HOST)$/.test(
      name,
    ),
  ),
)
const delay = (ms) => new Promise((done) => setTimeout(done, ms))
const issuer = 'https://identity.mb693.synthetic.invalid'
const common = {
  ...base,
  NODE_ENV: 'test',
  SPRINGDOTENV_ENABLED: 'false',
  EUREKA_CLIENT_ENABLED: 'false',
  IDENTITY_JWT_ISSUER: issuer,
  IDENTITY_JWT_AUDIENCE: 'mb693-api',
  IDENTITY_JWT_KEY_ID: 'mb693-identity',
  IDENTITY_JWT_PUBLIC_KEY: identityKeys.publicKey,
}

function sourceSha(cwd) {
  const repository = cwd === root ? resolve(root, '..') : cwd
  return execFileSync(
    'git',
    [
      '-c',
      `safe.directory=${repository.replaceAll('\\', '/')}`,
      'rev-parse',
      'HEAD',
    ],
    { cwd, encoding: 'utf8' },
  ).trim()
}
function redact(text) {
  return text
    .replace(
      /-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g,
      '[REDACTED KEY]',
    )
    .replace(/Bearer\s+[^\s"\]]+/g, 'Bearer [REDACTED]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[REDACTED JWT]')
    .replaceAll(password, '[REDACTED]')
    .replaceAll(serviceToken, '[REDACTED]')
    .replaceAll(encryptionKey, '[REDACTED]')
}
async function port() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const value = server.address().port
  await new Promise((done) => server.close(done))
  return value
}
async function container(builder) {
  const started = await builder.start()
  containers.push(started)
  return started
}
async function postgres() {
  const pg = await container(
    new GenericContainer('postgres:17-alpine')
      .withEnvironment({
        POSTGRES_USER: 'mb693',
        POSTGRES_PASSWORD: password,
        POSTGRES_DB: 'mb693',
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forLogMessage(/database system is ready to accept connections/, 2),
      ),
  )
  const address = `${pg.getHost()}:${pg.getMappedPort(5432)}/mb693`
  return {
    jdbc: `jdbc:postgresql://${address}`,
    url: `postgresql://mb693:${password}@${address}`,
  }
}
function start(name, binary, args, env, cwd) {
  const child = spawn(binary, args, {
    cwd,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const state = { name, child, log: '' }
  child.on('error', () => {
    state.failed = true
  })
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (data) => {
      if (name === 'playwright') process.stdout.write(redact(data.toString()))
      state.log += data.toString()
      if (state.log.length > 2_000_000) {
        state.failed = true
        child.kill()
      }
    })
  children.push(state)
  return state
}
async function command(name, binary, args, env, cwd) {
  const state = start(name, binary, args, env, cwd)
  const [code] = await once(state.child, 'exit')
  if (code !== 0 || state.failed)
    throw new Error(`${name} failed; inspect redacted runtime log`)
}
async function ready(name, url, state) {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (state.failed || state.child.exitCode !== null)
      throw new Error(`${name} exited before readiness`)
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(2000) })).ok) {
        console.log(`[mb693] ${name} ready`)
        servicesReady.push(name)
        return
      }
    } catch {
      /* readiness retries are bounded */
    }
    await delay(250)
  }
  throw new Error(`${name} readiness timed out`)
}
async function stop() {
  for (const { child } of [...children].reverse()) {
    if (child.exitCode !== null) continue
    child.kill('SIGTERM')
    await Promise.race([once(child, 'exit'), delay(5000)])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
  for (const owned of [...containers].reverse()) await owned.stop()
}

let exitCode = 1
await mkdir(output, { recursive: true })
try {
  for (const artifact of [
    join(
      backend,
      'identity-service/target/identity-service-0.0.1-SNAPSHOT.jar',
    ),
    join(
      backend,
      'community-service/target/community-service-0.0.1-SNAPSHOT.jar',
    ),
    join(content, 'dist/main.js'),
    join(realtime, 'dist/main.js'),
    join(root, '.next/standalone/server.js'),
  ])
    if (!existsSync(artifact))
      throw new Error(
        'Build Identity, Community, Content, Realtime and frontend standalone before this run',
      )

  console.log(
    '[mb693] provisioning disposable databases, Kafka, Redis and MongoDB',
  )
  const identityDb = await postgres()
  const communityDb = await postgres()
  const contentDb = await postgres()
  const broker = await container(
    new KafkaContainer('confluentinc/cp-kafka:7.8.0').withKraft(),
  )
  const redis = await container(
    new GenericContainer('redis:7.4-alpine').withExposedPorts(6379),
  )
  const mongo = await container(
    new GenericContainer('mongo:7.0').withExposedPorts(27017),
  )
  const brokers = `${broker.getHost()}:${broker.getMappedPort(9093)}`
  const kafka = new Kafka({
    clientId: 'mb693-fixture',
    brokers: [brokers],
    logLevel: logLevel.NOTHING,
  })
  const admin = kafka.admin()
  await admin.connect()
  try {
    await admin.createTopics({
      topics: [
        'mentalbridge.community.chat.v1',
        'mentalbridge.community.comment-reaction.v1',
        'mentalbridge.content-notification.community-interaction-dead-letter.v1',
        'mentalbridge.community.chat.realtime-dead-letter.v1',
      ].map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 })),
    })
  } finally {
    await admin.disconnect()
  }

  const [identityPort, communityPort, contentPort, realtimePort, webPort] =
    await Promise.all([port(), port(), port(), port(), port()])
  const identityUrl = `http://127.0.0.1:${identityPort}`
  const communityUrl = `http://127.0.0.1:${communityPort}`
  const contentUrl = `http://127.0.0.1:${contentPort}`
  const realtimeUrl = `http://127.0.0.1:${realtimePort}`
  const webUrl = `http://127.0.0.1:${webPort}`
  const identity = start(
    'identity',
    java,
    ['-jar', 'target/identity-service-0.0.1-SNAPSHOT.jar'],
    {
      ...common,
      SERVER_PORT: String(identityPort),
      SERVER_ADDRESS: '127.0.0.1',
      SPRING_PROFILES_ACTIVE: 'e2e',
      SPRING_LIQUIBASE_ENABLED: 'true',
      IDENTITY_DB_URL: identityDb.jdbc,
      IDENTITY_DB_USERNAME: 'mb693',
      IDENTITY_DB_PASSWORD: password,
      IDENTITY_JWT_PRIVATE_KEY: identityKeys.privateKey,
      IDENTITY_ENCRYPTION_KEY_VERSION: 'mb693',
      IDENTITY_ENCRYPTION_KEY: encryptionKey,
      IDENTITY_COMMUNITY_CHAT_SERVICE_TOKEN: serviceToken,
      SPRING_DATA_REDIS_URL: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
      IDENTITY_E2E_SEED: 'true',
      IDENTITY_E2E_PASSWORD: password,
      IDENTITY_E2E_USER_A_EMAIL: userA,
      IDENTITY_E2E_USER_B_EMAIL: userB,
      IDENTITY_AUDIT_INGESTION_ENABLED: 'false',
      IDENTITY_PLATFORM_REPORTING_ENABLED: 'false',
      IDENTITY_BREVO_BASE_URL: 'http://127.0.0.1:1',
      IDENTITY_BREVO_API_KEY: 'mb693-disabled-provider',
      IDENTITY_BREVO_SENDER_EMAIL: 'mb693@synthetic.invalid',
      KAFKA_BOOTSTRAP_SERVERS: brokers,
    },
    join(backend, 'identity-service'),
  )
  await ready('Identity', `${identityUrl}/actuator/health`, identity)
  const community = start(
    'community',
    java,
    ['-jar', 'target/community-service-0.0.1-SNAPSHOT.jar'],
    {
      ...common,
      SERVER_PORT: String(communityPort),
      SERVER_ADDRESS: '127.0.0.1',
      COMMUNITY_DB_URL: communityDb.jdbc,
      COMMUNITY_DB_USERNAME: 'mb693',
      COMMUNITY_DB_PASSWORD: password,
      COMMUNITY_LIQUIBASE_ENABLED: 'true',
      COMMUNITY_CHAT_ENABLED: 'true',
      COMMUNITY_CHAT_IDENTITY_BASE_URL: identityUrl,
      IDENTITY_COMMUNITY_CHAT_SERVICE_TOKEN: serviceToken,
      COMMUNITY_CHAT_ENCRYPTION_KEY: encryptionKey,
      COMMUNITY_CHAT_ENCRYPTION_KEY_VERSION: 'mb693',
      COMMUNITY_CHAT_NOTIFICATION_ENABLED: 'true',
      CONTENT_COMMUNITY_NOTIFICATION_PUBLIC_KEY: contentKeys.publicKey,
      CONTENT_COMMUNITY_NOTIFICATION_KEY_ID: 'mb693-content',
      COMMUNITY_CHAT_REALTIME_ENABLED: 'true',
      REALTIME_COMMUNITY_DELEGATION_PUBLIC_KEY: realtimeKeys.publicKey,
      REALTIME_COMMUNITY_DELEGATION_KEY_ID: 'mb693-realtime',
      COMMUNITY_CHAT_RELAY_ENABLED: 'true',
      COMMUNITY_CHAT_RELAY_INTERVAL: 'PT0.5S',
      KAFKA_BOOTSTRAP_SERVERS: brokers,
      CLOUDINARY_CLOUD_NAME: 'synthetic',
      CLOUDINARY_API_KEY: 'synthetic',
      CLOUDINARY_API_SECRET: 'synthetic',
    },
    join(backend, 'community-service'),
  )
  await ready('Community', `${communityUrl}/actuator/health`, community)

  const contentEnv = {
    ...common,
    PORT: String(contentPort),
    DATABASE_URL: contentDb.url,
    LOG_LEVEL: 'info',
    KAFKA_BOOTSTRAP_SERVERS: brokers,
    COMMUNITY_SERVICE_URL: communityUrl,
    CONTENT_COMMUNITY_NOTICE_CONSUMER_ENABLED: 'true',
    CONTENT_COMMUNITY_NOTIFICATION_PRIVATE_KEY: contentKeys.privateKey,
    CONTENT_COMMUNITY_NOTIFICATION_KEY_ID: 'mb693-content',
    CONTENT_ACCOUNT_LIFECYCLE_CONSUMER_ENABLED: 'false',
  }
  await command(
    'content-migrate',
    process.execPath,
    [
      'node_modules/node-pg-migrate/bin/node-pg-migrate.js',
      'up',
      '--migrations-dir',
      'migrations',
    ],
    contentEnv,
    content,
  )
  const notices = start(
    'content',
    process.execPath,
    ['dist/main.js'],
    contentEnv,
    content,
  )
  await ready('Content', `${contentUrl}/health/live`, notices)

  const realtimeEnv = {
    ...common,
    REALTIME_PORT: String(realtimePort),
    REALTIME_HOST: '127.0.0.1',
    REALTIME_CORS_ORIGINS: webUrl,
    REALTIME_MONGODB_URI: `mongodb://${mongo.getHost()}:${mongo.getMappedPort(27017)}`,
    REALTIME_MONGODB_DATABASE: 'mb693',
    REALTIME_REDIS_URL: `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`,
    REALTIME_MESSAGE_ENCRYPTION_KEY: encryptionKey,
    REALTIME_MESSAGE_ENCRYPTION_KEY_VERSION: 'mb693',
    CONSULTATION_BASE_URL: 'http://127.0.0.1:1',
    CONSULTATION_EVIDENCE_SERVICE_TOKEN: serviceToken,
    REALTIME_COMMUNITY_ENABLED: 'true',
    REALTIME_COMMUNITY_BASE_URL: communityUrl,
    REALTIME_COMMUNITY_DELEGATION_PRIVATE_KEY: realtimeKeys.privateKey,
    REALTIME_COMMUNITY_DELEGATION_KEY_ID: 'mb693-realtime',
    REALTIME_COMMUNITY_BFF_PUBLIC_KEY: bffKeys.publicKey,
    REALTIME_COMMUNITY_BFF_KEY_ID: 'mb693-bff',
    REALTIME_COMMUNITY_KAFKA_GROUP: `mb693-${randomUUID()}`,
    KAFKA_BOOTSTRAP_SERVERS: brokers,
    LOG_LEVEL: 'info',
  }
  await command(
    'realtime-migrate',
    process.execPath,
    [
      'node_modules/migrate-mongo/bin/migrate-mongo.js',
      'up',
      '-f',
      'migrate-mongo-config.cjs',
    ],
    realtimeEnv,
    realtime,
  )
  const transport = start(
    'realtime',
    process.execPath,
    ['dist/main.js'],
    realtimeEnv,
    realtime,
  )
  await ready('Realtime', `${realtimeUrl}/health/ready`, transport)
  const web = start(
    'web',
    process.execPath,
    ['server.js'],
    {
      ...base,
      NODE_ENV: 'production',
      PORT: String(webPort),
      HOSTNAME: '127.0.0.1',
      NEXT_TELEMETRY_DISABLED: '1',
      IDENTITY_API_BASE_URL: identityUrl,
      COMMUNITY_SERVICE_URL: communityUrl,
      CONTENT_SERVICE_URL: contentUrl,
      CARE_API_BASE_URL: 'http://127.0.0.1:1',
      CONSULTATION_SERVICE_URL: 'http://127.0.0.1:1',
      JOURNAL_AI_SERVICE_URL: 'http://127.0.0.1:1',
    },
    resolve('.next/standalone'),
  )
  await ready('Web', `${webUrl}/login`, web)

  await command(
    'playwright',
    process.execPath,
    [
      'node_modules/@playwright/test/cli.js',
      'test',
      '--config',
      'playwright.community-safety.config.ts',
    ],
    {
      ...base,
      MB693_ISOLATED_RUN: 'true',
      MB693_IDENTITY_URL: identityUrl,
      MB693_COMMUNITY_URL: communityUrl,
      MB693_REALTIME_URL: realtimeUrl,
      MB693_WEB_URL: webUrl,
      MB693_USER_A: userA,
      MB693_USER_B: userB,
      MB693_PASSWORD: password,
    },
    root,
  )
  for (const { name, log } of children.filter(
    (state) => state.name !== 'playwright',
  )) {
    if (
      [
        password,
        serviceToken,
        identityKeys.privateKey,
        contentKeys.privateKey,
        'MB693_PRIVATE_CANARY',
      ].some((secret) => log.includes(secret)) ||
      /eyJ[\w-]+\.[\w-]+\.[\w-]+/.test(log)
    ) {
      throw new Error(`${name} emitted sensitive synthetic material`)
    }
  }
  exitCode = 0
} catch (error) {
  console.error(`[mb693] ${redact(error.message)}`)
} finally {
  await stop()
  for (const { name, log } of children)
    await writeFile(join(output, `${name}.log`), redact(log))
  await writeFile(
    join(output, 'result.json'),
    JSON.stringify(
      {
        frontendSha: sourceSha(root),
        backendSha: sourceSha(backend),
        exitCode,
        servicesReady,
        identity: 'real, synthetic seeded users',
        community: 'real',
        content: 'real',
        realtime: 'real owner, Node socket probe',
        unrelatedServices: 'unavailable loopback ports',
        nativeAndroid: 'not run; MB-666',
      },
      null,
      2,
    ),
  )
}
process.exitCode = exitCode
