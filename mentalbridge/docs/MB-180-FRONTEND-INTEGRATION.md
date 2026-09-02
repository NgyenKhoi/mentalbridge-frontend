# MB-180 Frontend Integration: Reviewed Resources Display

## Overview

Frontend implementation cho MB-180 backend resources provider. Hiển thị reviewed resources trên anonymous và authenticated screening result pages.

## Implementation

### 1. BFF API Route (`/api/resources`)

**File:** `app/api/resources/route.ts`

- Server-side Next.js API route
- Calls upstream Content service tại `CONTENT_SERVICE_URL` (never exposed to browser)
- Timeout: 5000ms
- Neutral fallback trên network errors
- Forwards Problem Details từ upstream

**Environment:**
```env
CONTENT_SERVICE_URL=http://localhost:8082
```

**Response Handling:**
- ✅ 200 OK: Returns `{ items: Resource[], hasMore: boolean, nextCursor?: string }`
- ⚠️ 400/4xx: Forwards Problem Details
- ⚠️ 502: Malformed response → Problem Details
- ⚠️ 504: Timeout → Problem Details  
- ✅ 5xx/Network error: Neutral fallback `{ items: [], hasMore: false }`

### 2. ResourcesList Component

**File:** `components/ResourcesList.tsx`

Client-side React component với loading states:

**States:**
- `loading`: Skeleton placeholders
- `success`: Grid hiển thị resources với animation
- `empty`: Neutral empty state
- `error`: Generic error với message
- `timeout`: Specific timeout message
- `unavailable`: Service unavailable message

**Features:**
- Category filtering
- Limit control
- External links (target="_blank")
- Hover animations
- Future feature labels (subscription, consultation) marked as "Chưa khả dụng"

### 3. Result Page Integration

**File:** `app/assessment/anonymous/page.tsx`

Integrated `ResourcesList` component vào anonymous assessment result page:

```tsx
<ResourcesList 
  category="ARTICLE"
  limit={6}
  className="assessment-resources"
/>
```

Hiển thị sau risk card và hotline, trước restart button.

**Authenticated Journey:**
Authenticated result pages (trong dashboard) có thể integrate tương tự:
```tsx
<ResourcesList category="ARTICLE" limit={6} />
```

## Testing

### Route Tests (`__tests__/api/resources.test.ts`)

✅ 6 tests passing:

1. Returns resources từ upstream service
2. Returns empty array on network error (neutral fallback)
3. Returns 504 on timeout
4. Returns 502 on malformed response
5. Forwards Problem Details từ upstream
6. Passes category/limit filters to upstream

**Run tests:**
```bash
npm test
```

### Manual Testing

**Start development servers:**

Backend (Content service):
```bash
cd mentalbridge-backend/content-notification-service
./mvnw spring-boot:run
```

Frontend:
```bash
cd mentalbridge-frontend/mentalbridge
npm run dev
```

**Test scenarios:**

1. **Normal flow:**
   - Seed resource trong PostgreSQL
   - Navigate to `/assessment/anonymous`
   - Complete assessment → see resources on result page

2. **Empty state:**
   - Empty resources table
   - Result page shows "Hiện chưa có tài liệu nào"

3. **Unavailable state:**
   - Stop Content service
   - Result page shows "Không thể kết nối đến dịch vụ"

4. **Timeout:**
   - Delay Content service response > 5s
   - Result page shows timeout message

## Quality Gate

| Check | Command | Status |
|-------|---------|--------|
| TypeScript | `npm run build` | ✅ Pass |
| Lint | `npm run lint` | ✅ Pass |
| Unit tests | `npm test` | ✅ 6/6 pass |
| Build | `npm run build` | ✅ Success |

## Accessibility

**Component compliance:**

- ✅ Semantic HTML (`<article>`, `<h3>`, `<p>`)
- ✅ External link indicators (icon)
- ✅ Keyboard navigation (standard anchor elements)
- ✅ Focus visible (browser default)
- ✅ Color contrast (checked against design system)
- ✅ Loading states announced (text content)

**Not verified (requires manual testing):**

- ⚠️ Screen reader experience
- ⚠️ Keyboard-only navigation flow
- ⚠️ ARIA labels/descriptions optimization

## DoD Status

### ✅ Completed

- ✅ Server-only Content base URL/timeout config
- ✅ Typed response parser/client (TypeScript interfaces)
- ✅ Same-origin Next.js BFF route
- ✅ Render backend-returned resources after anonymous result
- ✅ Explicit empty/unavailable/malformed/timeout states
- ✅ Unavailable future-feature labels (subscription, consultation)
- ✅ Route tests covering published, empty, unavailable, malformed, timeout scenarios
- ✅ Frontend format, lint, typecheck, tests pass
- ✅ Production build successful

### ❌ Not in scope / Future work

- ❌ Authenticated result page integration (can use same component)
- ❌ Component tests với @testing-library/react
- ❌ Playwright E2E tests cross-service
- ❌ Manual accessibility evidence với screen readers
- ❌ Responsive design review (assumed design system compliant)
- ❌ Unauthorized/access-boundary states (endpoint is public)

## Next Steps

1. **Merge PR** sau khi reviewer approve
2. **Deploy backend** Content service trước
3. **Deploy frontend** sau khi backend stable
4. **Monitor** resource fetch metrics và error rates
5. **Iterate** based on user feedback và analytics
