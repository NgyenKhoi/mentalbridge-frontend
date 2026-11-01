const fail = (message) => {
  console.error(message)
  process.exit(1)
}

const eventName = process.env.GITHUB_EVENT_NAME ?? ''
const ref = process.env.GITHUB_REF ?? ''
const sha = process.env.GITHUB_SHA ?? ''
const baseRef = process.env.GITHUB_BASE_REF ?? ''
const headRef = process.env.GITHUB_HEAD_REF ?? ''
const approvedFrontendSha = process.env.APPROVED_FRONTEND_SHA ?? ''

if (!/^[0-9a-f]{40}$/i.test(sha)) {
  fail('The milestone revision must be an immutable 40-character commit SHA.')
}

if (eventName === 'workflow_dispatch') {
  if (!['refs/heads/dev', 'refs/heads/staging'].includes(ref)) {
    fail('Manual milestones may run only from dev or staging.')
  }
  if (!/^[0-9a-f]{40}$/i.test(approvedFrontendSha)) {
    fail('Manual milestones require an approved immutable frontend SHA.')
  }
  if (approvedFrontendSha.toLowerCase() !== sha.toLowerCase()) {
    fail('The approved frontend SHA does not match the selected workflow ref.')
  }
} else if (eventName === 'pull_request') {
  if (baseRef !== 'staging' || headRef !== 'dev') {
    fail('Only an exact dev-to-staging promotion pull request is authorized.')
  }
} else if (eventName === 'push') {
  if (ref !== 'refs/heads/staging') {
    fail('Only a staging branch push is authorized for automatic milestones.')
  }
} else {
  fail(`Unsupported staging milestone event: ${eventName || 'missing'}.`)
}

console.log(`Authorized ${eventName} milestone for ${sha}.`)
