import type { AxiosInstance } from 'axios'

import {
  accountDetailSchema,
  accountSummarySchema,
  registrationResponseSchema,
  tokenPairSchema,
  type AccountDetail,
  type LoginRequest,
  type PasswordChangeRequest,
  type PasswordResetRequest,
  type RegistrationRequest,
  type RegistrationResponse,
  type TokenPair,
} from './identity-contract'

export interface IdentityApi {
  login(request: LoginRequest): Promise<TokenPair>
  refresh(refreshToken: string, idempotencyKey: string): Promise<TokenPair>
  getCurrentAccount(): Promise<AccountDetail>
  logout(refreshToken: string): Promise<void>
  registerUser(
    request: RegistrationRequest,
    idempotencyKey: string,
  ): Promise<RegistrationResponse>
  verifyEmail(challenge: string): Promise<void>
  requestEmailVerification(email: string): Promise<void>
  requestPasswordRecovery(email: string): Promise<void>
  resetPassword(request: PasswordResetRequest): Promise<void>
  changePassword(request: PasswordChangeRequest): Promise<void>
}

export function createIdentityApi(client: AxiosInstance): IdentityApi {
  return {
    async login(request) {
      const response = await client.post('/api/v1/auth/login', request)
      return tokenPairSchema.parse(response.data)
    },
    async refresh(refreshToken, idempotencyKey) {
      const response = await client.post(
        '/api/v1/auth/refresh',
        { refreshToken },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      )
      return tokenPairSchema.parse(response.data)
    },
    async getCurrentAccount() {
      const response = await client.get('/api/v1/account')
      return accountDetailSchema.parse(response.data)
    },
    async logout(refreshToken) {
      await client.post('/api/v1/auth/logout', { refreshToken })
    },
    async registerUser(request, idempotencyKey) {
      const response = await client.post(
        '/api/v1/auth/registrations',
        request,
        {
          headers: { 'Idempotency-Key': idempotencyKey },
        },
      )
      return registrationResponseSchema.parse(response.data)
    },
    async verifyEmail(challenge) {
      const response = await client.post('/api/v1/auth/email-verifications', {
        challenge,
      })
      accountSummarySchema.parse(response.data)
    },
    async requestEmailVerification(email) {
      await client.post('/api/v1/auth/email-verification-requests', { email })
    },
    async requestPasswordRecovery(email) {
      await client.post('/api/v1/auth/password-recovery-requests', { email })
    },
    async resetPassword(request) {
      await client.post('/api/v1/auth/password-resets', request)
    },
    async changePassword(request) {
      await client.put('/api/v1/account/password', request)
    },
  }
}
