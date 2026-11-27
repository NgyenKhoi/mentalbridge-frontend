import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const script = resolve(
  __dirname,
  '../../scripts/validate-staging-milestone.mjs',
)
const sha = '0123456789abcdef0123456789abcdef01234567'

function validate(env: Record<string, string>) {
  return spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: '',
      GITHUB_REF: '',
      GITHUB_SHA: sha,
      GITHUB_BASE_REF: '',
      GITHUB_HEAD_REF: '',
      APPROVED_FRONTEND_SHA: '',
      ...env,
    },
  })
}

describe('staging milestone promotion policy', () => {
  it.each(['refs/heads/dev', 'refs/heads/staging'])(
    'allows an explicitly approved manual milestone from %s',
    (ref) => {
      expect(
        validate({
          GITHUB_EVENT_NAME: 'workflow_dispatch',
          GITHUB_REF: ref,
          APPROVED_FRONTEND_SHA: sha,
        }).status,
      ).toBe(0)
    },
  )

  it('rejects a manual milestone from an arbitrary feature ref', () => {
    const result = validate({
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_REF: 'refs/heads/feature/unapproved',
      APPROVED_FRONTEND_SHA: sha,
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('only from dev or staging')
  })

  it('rejects a manual milestone when approval names another revision', () => {
    const result = validate({
      GITHUB_EVENT_NAME: 'workflow_dispatch',
      GITHUB_REF: 'refs/heads/dev',
      APPROVED_FRONTEND_SHA: 'abcdef0123456789abcdef0123456789abcdef01',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('does not match')
  })

  it('allows only dev-to-staging promotion pull requests', () => {
    expect(
      validate({
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_BASE_REF: 'staging',
        GITHUB_HEAD_REF: 'dev',
      }).status,
    ).toBe(0)
    expect(
      validate({
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_BASE_REF: 'staging',
        GITHUB_HEAD_REF: 'feature/unapproved',
      }).status,
    ).toBe(1)
  })

  it('allows staging pushes and rejects every other push ref', () => {
    expect(
      validate({
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REF: 'refs/heads/staging',
      }).status,
    ).toBe(0)
    expect(
      validate({
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REF: 'refs/heads/dev',
      }).status,
    ).toBe(1)
  })
})
