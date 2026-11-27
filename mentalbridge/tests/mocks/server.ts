import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Default handlers for common endpoints
const emptyCompanionState = {
  focus: null,
  chapters: [],
  commitments: [],
  ui: { guide: null, seen: [] },
  revision: 0,
}
const defaultHandlers = [
  // Mầm's guide and moments read and write the companion state; by default nothing is stored yet.
  http.get('/api/companion-state', () =>
    HttpResponse.json(emptyCompanionState),
  ),
  http.patch('/api/companion-state', () =>
    HttpResponse.json(emptyCompanionState),
  ),
  // A lời hẹn is only made where a test says so; by default the call fails like an unreachable service.
  http.post('/api/companion-state/commitments', () =>
    HttpResponse.json(
      { code: 'SERVICE_UNAVAILABLE', status: 503 },
      { status: 503 },
    ),
  ),
  // Shells and settings ask for the account avatar; by default there is no community profile yet.
  http.get('/api/community/profile', () =>
    HttpResponse.json(
      { code: 'COMMUNITY_PROFILE_NOT_FOUND', status: 404 },
      { status: 404 },
    ),
  ),
  http.get('/api/community/avatars', () => HttpResponse.json({ items: [] })),
  // A result card asks Care whether it shows the latest screening; by default it never is.
  http.get('/api/care/guided-journey', () =>
    HttpResponse.json({
      stage: 'ASSESSMENT_REQUIRED',
      episodeId: null,
      latestScreening: null,
    }),
  ),
  // Mock /api/resources endpoint to prevent unhandled requests in component tests
  http.get('/api/resources', () => {
    // Return empty resources by default
    return HttpResponse.json({
      items: [],
      hasMore: false,
    })
  }),
  // Mock /api/admin/operations/dashboard endpoint to prevent unhandled requests in component tests
  http.get('/api/admin/operations/dashboard', () => {
    return HttpResponse.json({
      asOf: '2026-10-05T12:00:00.000Z',
      identity: {
        status: 'AVAILABLE',
        source: 'IDENTITY',
        asOf: '2026-10-05T12:00:00.000Z',
        data: {
          totalAccounts: 50,
          activeAccounts: 45,
          pendingVerificationAccounts: 3,
          disabledAccounts: 2,
          deletionPendingAccounts: 0,
          byRole: { users: 40, specialists: 8, admins: 2 },
        },
      },
      consultation: {
        status: 'AVAILABLE',
        source: 'CONSULTATION',
        asOf: '2026-10-05T12:00:00.000Z',
        data: {
          specialists: {
            total: 8,
            pendingReview: 2,
            active: 5,
            rejected: 1,
            suspended: 0,
          },
          appointments: {
            total: 25,
            requested: 3,
            confirmed: 10,
            inProgress: 1,
            sessionEnded: 2,
            completed: 7,
            cancelled: 1,
            rejected: 1,
            expired: 0,
          },
        },
      },
      contentNotification: {
        status: 'AVAILABLE',
        source: 'CONTENT_NOTIFICATION',
        asOf: '2026-10-05T12:00:00.000Z',
        data: {
          inApp: {
            total: 100,
            delivered: 90,
            pending: 5,
            failed: 3,
            cancelled: 2,
            unread: 30,
            read: 60,
          },
          emailReminders: {
            total: 20,
            pending: 4,
            processing: 1,
            delivered: 14,
            failed: 1,
            suppressed: 0,
            invalidated: 0,
          },
        },
      },
      community: {
        status: 'AVAILABLE',
        source: 'COMMUNITY',
        asOf: '2026-10-05T12:00:00.000Z',
        data: { openModerationCasesCount: 2 },
      },
      unintegrated: {
        uptime: {
          status: 'UNAVAILABLE',
          reason: 'Chưa tích hợp authoritative telemetry SLA monitoring.',
        },
        privacyScore: {
          status: 'UNAVAILABLE',
          reason: 'Chưa tích hợp authoritative compliance audit engine.',
        },
        paymentsRevenue: {
          status: 'UNAVAILABLE',
          reason: 'Dịch vụ thanh toán và doanh thu chưa được tích hợp.',
        },
      },
    })
  }),
]

export const mockServer = setupServer(...defaultHandlers)
