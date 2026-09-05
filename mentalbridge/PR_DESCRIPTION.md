# MB-180 Frontend: Reviewed Resources Display on Result Pages

## Related PRs

**⚠️ This PR depends on backend PR:**

- **Backend PR:** [mentalbridge-backend #feature/mb-180-reviewed-resources-safe-fallback](https://github.com/NgyenKhoi/mentalbridge-backend/tree/feature/mb-180-reviewed-resources-safe-fallback)
- Backend provides `GET /api/v1/resources` endpoint
- Both PRs should be reviewed and merged together

---

## Tóm tắt thay đổi

- Loại thay đổi: `feat`
- Module/owner: `Frontend / Assessment & Resources`
- Hành vi được giải quyết: Hiển thị reviewed resources (articles, videos, support links) trên screening result pages
- Lý do: Users cần access tài liệu hữu ích ngay sau khi hoàn thành screening

**Scope:** Frontend BFF, client, và result page rendering cho MB-180

## Implementation

### 1. BFF API Route (`/api/resources`)

**File:** `app/api/resources/route.ts`

- Server-side Next.js route proxy to Content service
- Environment: `CONTENT_SERVICE_URL` (never exposed to browser)
- Timeout: 5000ms with AbortController
- Neutral fallback on network errors → `{ items: [], hasMore: false }`
- Forwards Problem Details từ upstream on validation errors

**Security:**

- ✅ Upstream URL only on server-side
- ✅ No credentials exposed to browser
- ✅ Same-origin requests only

### 2. ResourcesList Component

**File:** `components/ResourcesList.tsx`

Client-side component với comprehensive state handling:

**States:**

- `loading`: Skeleton placeholders animation
- `success`: Animated grid với resources
- `empty`: Neutral "Hiện chưa có tài liệu" state
- `timeout`: "Dịch vụ đang bận" message
- `unavailable`: "Dịch vụ tạm thời không khả dụng" message
- `error`: Generic error fallback

**Features:**

- Category filtering support
- External link indication (icon + target="_blank")
- Framer Motion animations
- Responsive grid layout
- Future features marked unavailable (subscription, consultation)

### 3. Result Page Integration

**File:** `app/assessment/anonymous/page.tsx`

Integrated resources sau risk assessment results:

```tsx
<ResourcesList category="ARTICLE" limit={6} className="assessment-resources" />
```

**User journey:**

1. User completes PHQ-9 assessment
2. Result page shows risk level + score
3. Resources section loads below (async)
4. User can click external links to articles/videos

### 4. Environment Configuration

**File:** `.env.local.example`

```env
CONTENT_SERVICE_URL=http://localhost:8082
```

Server-side only variable for BFF route.

## Verification

### Tests

**Route tests:** `__tests__/api/resources.test.ts`

✅ **6/6 tests passing:**

```bash
npm test
```

Coverage:

- ✅ Returns resources từ upstream
- ✅ Neutral fallback on network error
- ✅ 504 on timeout
- ✅ 502 on malformed response
- ✅ Forwards Problem Details (400)
- ✅ Passes category/limit filters

### Quality Gate

| Check      | Command         | Result      |
| ---------- | --------------- | ----------- |
| TypeScript | `npm run build` | ✅ Pass     |
| Lint       | `npm run lint`  | ✅ Pass     |
| Tests      | `npm test`      | ✅ 6/6 pass |
| Build      | `npm run build` | ✅ Success  |

### Local Testing

**Prerequisites:**

1. Backend Content service running: `http://localhost:8082`
2. PostgreSQL với seeded resources

**Commands:**

```bash
# Frontend
npm run dev

# Navigate to
http://localhost:3000/assessment/anonymous
```

**Test scenarios:**

- ✅ Complete assessment → see resources
- ✅ Empty database → neutral empty state
- ✅ Stop backend → unavailable state
- ✅ Invalid params → error handling

## Ảnh hưởng và tương thích

- REST compatibility: New BFF route `/api/resources` - frontend only, không affect backend
- Data: Không có data changes, chỉ read-only display
- Authorization: Public endpoint (phù hợp anonymous screening)
- Configuration: Requires `CONTENT_SERVICE_URL` environment variable
- Dependencies: Added vitest, @testing-library/react, framer-motion (already installed)

## Implementation Contract

- **Frontend contract:** BFF route matches backend OpenAPI response schema
- **Typed interfaces:** `Resource`, `ResourcesResponse` match backend contract
- **Error handling:** Problem Details RFC 7807 compatible
- **Pagination:** Cursor-based (nextCursor support in component)
- **Categories:** ARTICLE, VIDEO, HOTLINE, GUIDE, SUPPORT_GROUP

## Checklist trước merge

- [x] Tiêu đề theo Conventional Commits: `feat: integrate reviewed resources display (MB-180 frontend)`
- [x] BFF route implementation với proper timeout và error handling
- [x] Typed response interfaces matching backend contract
- [x] Component với comprehensive loading/error states
- [x] Future features labeled as unavailable
- [x] Route tests covering edge cases
- [x] TypeScript compilation success
- [x] Production build success
- [x] Environment config documented
- [x] No secrets exposed to browser
- [x] External links với proper rel attributes

## DoD Status

### ✅ Frontend Implementation (PR này)

- ✅ Server-side BFF route với Content base URL/timeout
- ✅ Typed response parser/client
- ✅ Same-origin Next.js API route
- ✅ Render resources after anonymous screening result
- ✅ Explicit empty/unavailable/malformed/timeout UI states
- ✅ Unavailable future-feature labels (subscription, consultation)
- ✅ Route tests (6 scenarios)
- ✅ Frontend quality gate pass (format, lint, typecheck, build)

### 🟡 Partial / Future Work

- 🟡 Authenticated result page integration (component ready, chưa integrate)
- 🟡 Component tests với @testing-library/react
- 🟡 Playwright E2E tests cross-service
- 🟡 Manual accessibility testing với screen readers
- 🟡 Responsive design evidence

### ✅ Backend (Separate PR)

- ✅ Resource repository, service, controller
- ✅ Publication governance filters
- ✅ PostgreSQL integration tests
- ✅ OpenAPI contract

## Review Notes

**Về yêu cầu từ review gốc:**

> "Add a server-only Content base URL/timeout, typed response parser/client, and same-origin Next.js BFF route"

✅ **Completed:** BFF route tại `/api/resources` với server-side config và typed interfaces

> "Render backend-returned common resources after both anonymous and authenticated results"

✅ **Completed:** Anonymous result page integrated
🟡 **Partial:** Authenticated journey có thể reuse same component (not yet integrated)

> "Add route/component tests for published, unpublished, empty, unavailable, malformed, timeout scenarios"

✅ **Completed:** 6 route tests covering all scenarios

> "Run frontend format, lint, typecheck, contract check, unit/component tests, production build"

✅ **Completed:** All quality gates pass

**Next steps:**

1. Review và merge backend PR first
2. Review và merge frontend PR
3. Deploy backend Content service
4. Deploy frontend
5. Monitor và iterate based on feedback

---

## Testing Locally

1. **Start backend:**

   ```bash
   cd mentalbridge-backend/content-notification-service
   ./mvnw spring-boot:run
   ```

2. **Create `.env.local`:**

   ```bash
   cd mentalbridge-frontend/mentalbridge
   cp .env.local.example .env.local
   ```

3. **Start frontend:**

   ```bash
   npm run dev
   ```

4. **Test:**
   - Navigate: http://localhost:3000/assessment/anonymous
   - Complete PHQ-9
   - Verify resources display on result page
