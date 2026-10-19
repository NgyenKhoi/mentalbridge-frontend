import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'

// Default handlers for common endpoints
const defaultHandlers = [
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
