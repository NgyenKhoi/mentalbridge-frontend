# MentalBridge - Next Steps

## ✅ Đã hoàn thành

1. **Landing Page** - Trang chủ với design system hoàn chỉnh
2. **Authentication** - Login/Register pages
3. **Dashboard Layout** - Sidebar + Topbar responsive
4. **17 Routes** - Tất cả màn hình chính của ứng dụng
5. **Design System** - CSS variables + component patterns
6. **Animations** - Framer Motion + CSS animations

---

## 🚀 Để chạy dự án

```bash
cd mentalbridge

# Cài dependencies (nếu chưa có)
npm install

# Chạy dev server
npm run dev

# Build production
npm run build
```

Mở trình duyệt: `http://localhost:3000`

---

## 🔄 Các bước tiếp theo

### 1. Authentication & Authorization
- [ ] Tích hợp NextAuth.js hoặc Clerk
- [ ] Protected routes middleware
- [ ] Session management
- [ ] JWT token handling
- [ ] Password reset flow (`/reset-password` page)

### 2. Backend Integration
- [ ] API endpoints cho:
  - User profile CRUD
  - Journal entries
  - Assessments (PHQ-9, GAD-7, PSQI)
  - Appointments booking
  - Messages/Chat
  - Notifications
- [ ] Database schema (PostgreSQL/MongoDB)
- [ ] File upload (avatar images)

### 3. Real-time Features
- [ ] WebSocket cho chat (Socket.io)
- [ ] Live notifications
- [ ] Online status indicators
- [ ] Typing indicators

### 4. Payment Integration
- [ ] Stripe/PayPal cho subscription
- [ ] Webhook handlers
- [ ] Subscription status tracking
- [ ] Invoice generation

### 5. Data Visualization
- [ ] Chart library integration (Chart.js/Recharts)
- [ ] Real mood trend data
- [ ] Assessment history graphs
- [ ] Export reports PDF

### 6. Enhanced Features
- [ ] Reminder system (email/push notifications)
- [ ] Calendar integration
- [ ] Video call integration (Jitsi/Twilio)
- [ ] File attachments in messages
- [ ] Search functionality
- [ ] Advanced filters

### 7. Mobile Optimization
- [ ] Bottom navigation for mobile
- [ ] Touch gestures
- [ ] PWA manifest
- [ ] Push notifications
- [ ] Offline mode

### 8. Testing
- [ ] Unit tests (Jest + React Testing Library)
- [ ] E2E tests (Playwright/Cypress)
- [ ] Accessibility testing
- [ ] Performance testing

### 9. SEO & Performance
- [ ] Meta tags optimization
- [ ] Open Graph images
- [ ] Sitemap generation
- [ ] Image optimization
- [ ] Code splitting
- [ ] Lazy loading

### 10. Deployment
- [ ] Environment variables setup
- [ ] Vercel/Netlify deployment
- [ ] CI/CD pipeline
- [ ] Error tracking (Sentry)
- [ ] Analytics (Google Analytics/Mixpanel)

---

## 📁 Files cần tạo thêm

### Missing Pages
```
app/
├── reset-password/page.tsx    # Password reset
├── verify-email/page.tsx      # Email verification
├── terms/page.tsx             # Terms of Service
├── privacy/page.tsx           # Privacy Policy
└── 404.tsx                    # Custom 404
```

### API Routes (nếu dùng Next.js API)
```
app/api/
├── auth/
│   ├── login/route.ts
│   ├── register/route.ts
│   └── logout/route.ts
├── user/
│   └── [id]/route.ts
├── journal/
│   └── route.ts
├── assessments/
│   └── route.ts
└── appointments/
    └── route.ts
```

### Utility Files
```
lib/
├── api.ts              # API client
├── auth.ts             # Auth helpers
├── utils.ts            # Utilities
└── constants.ts        # Constants

types/
├── user.ts
├── journal.ts
├── assessment.ts
└── appointment.ts
```

---

## 🎨 UI Components cần extract

Để code sạch hơn, nên tách thành components:

```
components/
├── dashboard/
│   ├── Sidebar.tsx
│   ├── Topbar.tsx
│   ├── QuickActions.tsx
│   ├── MoodChart.tsx
│   └── StatsCard.tsx
├── journal/
│   ├── MoodSelector.tsx
│   ├── JournalEntry.tsx
│   └── Timeline.tsx
├── assessment/
│   ├── QuestionCard.tsx
│   ├── ProgressBar.tsx
│   └── ResultCard.tsx
├── chat/
│   ├── ConversationList.tsx
│   ├── ChatBubble.tsx
│   └── MessageInput.tsx
└── shared/
    ├── Button.tsx
    ├── Card.tsx
    ├── Modal.tsx
    └── Loader.tsx
```

---

## 🔧 Config Files cần cập nhật

### Environment Variables
```env
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
STRIPE_PUBLIC_KEY=...
STRIPE_SECRET_KEY=...
```

### TypeScript Config
```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@components/*": ["components/*"],
      "@lib/*": ["lib/*"],
      "@types/*": ["types/*"]
    }
  }
}
```

---

## 📊 Database Schema Example

```prisma
// prisma/schema.prisma

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  password      String
  avatar        String?
  phone         String?
  birthdate     DateTime?
  gender        String?
  createdAt     DateTime  @default(now())
  
  journals      Journal[]
  assessments   Assessment[]
  appointments  Appointment[]
  subscription  Subscription?
}

model Journal {
  id        String   @id @default(cuid())
  userId    String
  mood      Int      // 1-5
  content   String   @db.Text
  tags      String[]
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id])
}

model Assessment {
  id        String   @id @default(cuid())
  userId    String
  type      String   // PHQ9, GAD7, PSQI
  score     Int
  level     String   // low, medium, high
  answers   Json
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id])
}

model Appointment {
  id           String   @id @default(cuid())
  userId       String
  specialistId String
  date         DateTime
  startTime    String
  endTime      String
  type         String   // video, in-person
  status       String   // pending, confirmed, completed, cancelled
  
  user         User     @relation(fields: [userId], references: [id])
}

model Subscription {
  id        String   @id @default(cuid())
  userId    String   @unique
  plan      String   // free, plus, premium
  status    String   // active, cancelled
  startDate DateTime
  endDate   DateTime?
  
  user      User     @relation(fields: [userId], references: [id])
}
```

---

## 🎯 Priority Tasks

### High Priority (1-2 tuần)
1. ✅ Auth system (NextAuth.js)
2. ✅ User profile API
3. ✅ Journal CRUD
4. ✅ Assessment flow với real data
5. ✅ Protected routes

### Medium Priority (2-4 tuần)
1. ⏳ Chat/messaging system
2. ⏳ Appointment booking
3. ⏳ Payment integration
4. ⏳ Email notifications
5. ⏳ Analytics charts với real data

### Low Priority (1-2 tháng)
1. ⏳ Video call integration
2. ⏳ Advanced filtering
3. ⏳ Export reports
4. ⏳ PWA features
5. ⏳ Mobile app (React Native)

---

## 📚 Recommended Libraries

```json
{
  "dependencies": {
    "next-auth": "^4.24.5",           // Authentication
    "prisma": "^5.8.0",                // ORM
    "@prisma/client": "^5.8.0",
    "zod": "^3.22.4",                  // Validation
    "react-hook-form": "^7.49.3",      // Forms
    "date-fns": "^3.0.6",              // Date utils
    "recharts": "^2.10.4",             // Charts
    "socket.io-client": "^4.6.1",      // Real-time
    "@stripe/stripe-js": "^2.4.0",     // Payments
    "react-hot-toast": "^2.4.1",       // Notifications
    "zustand": "^4.5.0"                // State management
  },
  "devDependencies": {
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.2.0",
    "playwright": "^1.40.1",
    "eslint": "^8.56.0",
    "prettier": "^3.1.1"
  }
}
```

---

## 🎓 Learning Resources

- **Next.js App Router**: https://nextjs.org/docs/app
- **NextAuth.js**: https://next-auth.js.org
- **Prisma**: https://www.prisma.io/docs
- **Framer Motion**: https://www.framer.com/motion
- **Stripe Integration**: https://stripe.com/docs/payments/quickstart

---

## 📞 Support & Questions

Nếu cần hỗ trợ:
1. Check `DESIGN_SYSTEM.md` cho design tokens
2. Check `IMPLEMENTATION_SUMMARY.md` cho structure overview
3. Xem existing components để hiểu patterns
4. Follow design system consistency khi thêm features mới

---

**Happy Coding! 🚀**
