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
]

export const mockServer = setupServer(...defaultHandlers)
