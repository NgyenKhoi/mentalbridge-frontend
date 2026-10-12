import { appendFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const base = 'http://127.0.0.1:8084/api/v1/community'
if (process.env.PROVIDER_EVIDENCE !== 'protected-controlled-real-contract')
  throw new Error('This setup is restricted to disposable controlled services.')
const password = process.env.MAESTRO_MB_USER_PASSWORD
if (!password || !process.env.GITHUB_ENV)
  throw new Error('Protected fixture inputs are required.')
const login = await fetch('http://127.0.0.1:8080/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'e2e-user-b@synthetic.invalid', password }),
})
if (!login.ok) throw new Error(`Dedicated peer login failed: ${login.status}`)
const session = await login.json()
if (typeof session.accessToken !== 'string')
  throw new Error('Dedicated peer login contract failed.')
const headers = {
  Authorization: `Bearer ${session.accessToken}`,
  'Content-Type': 'application/json',
}
const profile = await fetch(`${base}/profile`, {
  method: 'PUT',
  headers,
  body: JSON.stringify({
    displayName: 'MB628 synthetic peer',
    avatarPreset: 'LEAF',
  }),
})
if (profile.status !== 201)
  throw new Error(`Dedicated peer profile creation failed: ${profile.status}`)
const post = await fetch(`${base}/posts`, {
  method: 'POST',
  headers: { ...headers, 'Idempotency-Key': randomUUID() },
  body: JSON.stringify({
    content: 'MB628 synthetic peer story.',
    topics: ['MY_STORY'],
    mediaIds: [],
    authorMode: 'PROFILE',
    resourceId: null,
    sensitiveContentWarning: null,
  }),
})
if (post.status !== 201)
  throw new Error(`Dedicated peer post creation failed: ${post.status}`)
const data = await post.json()
if (typeof data.postId !== 'string' || !/^[0-9a-f-]{36}$/.test(data.postId))
  throw new Error('Dedicated peer public post contract failed.')
appendFileSync(
  process.env.GITHUB_ENV,
  `MAESTRO_MB_COMMUNITY_PEER_POST_ID=${data.postId}\n`,
)
console.log(
  'Dedicated synthetic peer provisioned through public Community commands; credentials and bodies omitted.',
)
