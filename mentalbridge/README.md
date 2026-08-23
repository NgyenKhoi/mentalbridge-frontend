# MentalBridge 🌉

> Nền tảng hỗ trợ sức khỏe tâm lý toàn diện — Cây cầu đến sự an yên

MentalBridge là ứng dụng web kết nối người dùng với các chuyên gia tâm lý, cung cấp công cụ tự đánh giá, nhật ký cảm xúc và tài nguyên tự chăm sóc.

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Framer Motion](https://img.shields.io/badge/Framer%20Motion-11-ff69b4)

---

## ✨ Features

### 🏠 Landing Page
- Hero section với breathing animation & parallax
- Showcase chatbot tương tác
- Feature highlights
- Journey timeline với progress bar
- Risk level indicators
- Resources & testimonials

### 🔐 Authentication
- Login/Register với visual design
- Anonymous assessment (không cần đăng nhập)
- Password reset flow (planned)

### 📊 Dashboard
- Tổng quan sức khỏe tâm lý
- Quick actions (Journal, Assessment, Specialists)
- Mood tracking với biểu đồ
- Assessment history
- Upcoming appointments

### 📝 Journal
- Ghi nhật ký cảm xúc hàng ngày
- Mood selector (5 levels với emojis)
- Timeline view với mood dots
- Tag system

### 🧠 Assessments
- PHQ-9 (Depression screening)
- GAD-7 (Anxiety screening)
- PSQI (Sleep quality)
- Lịch sử kết quả với risk-tags

### 👨‍⚕️ Specialists
- Browse chuyên gia tâm lý
- Filter theo chuyên môn
- Đặt lịch hẹn
- Rating & reviews
- Available/Busy status

### 📅 Appointments
- Quản lý lịch hẹn
- Timeline view (upcoming & past)
- Video call integration (planned)
- Reminder notifications

### 💬 Messages
- Chat với chuyên gia
- 2-column layout (conversations + chat)
- Real-time messaging (planned)
- Online status indicators

### 📚 Resources
- Bài tập thở & thiền
- Sleep hygiene tips
- Tư duy tích cực
- Filter theo category

### 📈 Analytics
- Mood trend charts
- Activity statistics (streak, assessments, sessions)
- Insights & recommendations

### 💳 Subscription
- 3 tiers: Free, Plus, Premium
- Feature comparison
- Payment integration (planned)
- FAQ section

### 👤 Profile
- User information management
- Activity stats (streak, journals, assessments)
- Account settings
- Logout

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm hoặc yarn

### Installation

```bash
# Clone repository
git clone <repo-url>
cd mentalbridge

# Install dependencies
npm install

# Run development server
npm run dev
```

Mở trình duyệt: **http://localhost:3000**

### Build Production

```bash
npm run build
npm start
```

---

## 📂 Project Structure

```
mentalbridge/
├── app/
│   ├── (dashboard)/          # Protected dashboard routes
│   │   ├── layout.tsx        # Sidebar + Topbar
│   │   ├── dashboard.css     # Dashboard styles
│   │   ├── page.tsx          # Dashboard home
│   │   ├── journal/          # Mood journal timeline
│   │   ├── assessments/      # PHQ-9, GAD-7, PSQI
│   │   ├── specialists/      # Expert directory
│   │   ├── appointments/     # Appointment management
│   │   ├── messages/         # Chat interface
│   │   ├── resources/        # Self-care content
│   │   ├── analytics/        # Charts & insights
│   │   ├── subscription/     # Pricing tiers
│   │   ├── profile/          # User settings
│   │   └── notifications/    # Notification center
│   ├── login/
│   │   ├── page.tsx
│   │   └── auth.css          # Auth page styles
│   ├── register/
│   │   └── page.tsx
│   ├── assessment/
│   │   └── anonymous/        # Standalone PHQ-9 test
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Design system (CSS variables)
│   └── page.tsx              # Landing page
├── components/
│   ├── Header.tsx            # Header với scroll state
│   ├── Hero.tsx              # Hero với parallax & breathing
│   ├── Showcase.tsx          # Phone mockup cycling
│   ├── Features.tsx          # Features grid
│   ├── Journey.tsx           # Journey với progress
│   ├── RiskLevels.tsx        # Risk cards
│   ├── Barriers.tsx          # Barriers section
│   ├── Hotline.tsx           # Hotline banner
│   ├── Cta.tsx               # CTA section
│   ├── Footer.tsx            # Footer
│   └── ScrollReveal.tsx      # IntersectionObserver
├── public/
├── DESIGN_SYSTEM.md          # Design tokens reference
├── IMPLEMENTATION_SUMMARY.md # Technical overview
├── NEXT_STEPS.md             # Development roadmap
└── package.json
```

---

## 🎨 Design System

### Colors
- **Primary**: Teal (`#20938f`, `#48aaa5`) - Calm, trust
- **Secondary**: Amber (`#ffaa00`) - Warmth, optimism
- **Accent**: Terracotta (`#d9614c`) - Energy, urgency
- **Neutral**: Lavender (`#c8b4d4`) - Gentle, supportive

### Typography
- **Display/Headings**: Fraunces (serif) 300-700
- **Body**: Be Vietnam Pro (sans-serif) 300-800

### Components
- Buttons: `.btn-primary`, `.btn-outline`, `.btn-ghost` (với shimmer effect)
- Cards: `.feature-card`, `.risk-card`, `.float-card`
- Tags: `.risk-tag` (teal/amber/terra)
- Animations: `.reveal`, `.breathing-circle`, `.shimmer`, `.chart-bar`

**Xem chi tiết**: [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md)

---

## 🎭 Tech Stack

### Core
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5.0
- **Styling**: CSS Modules + CSS Variables (không Tailwind)
- **Animations**: Framer Motion 11
- **Fonts**: Google Fonts (Fraunces, Be Vietnam Pro)
- **Icons**: Inline SVG (stroke-width 1.6)

### Planned Integrations
- **Auth**: NextAuth.js
- **Database**: Prisma + PostgreSQL
- **Real-time**: Socket.io
- **Payments**: Stripe
- **Video**: Jitsi/Twilio
- **Email**: Resend/SendGrid

---

## 📊 Routes Overview

```
✓ /                           Landing page (Hero, Features, Journey...)
✓ /login                      Login page
✓ /register                   Register page
✓ /assessment/anonymous       PHQ-9 test (no login required)

✓ /(dashboard)               Protected dashboard routes:
  ✓ /                         Dashboard home (cards, quick actions)
  ✓ /journal                  Mood journal với timeline
  ✓ /assessments              PHQ-9, GAD-7, PSQI tests
  ✓ /specialists              Browse chuyên gia
  ✓ /appointments             Lịch hẹn management
  ✓ /messages                 Chat interface (2-column)
  ✓ /resources                Self-care content
  ✓ /analytics                Charts & insights
  ✓ /subscription             Pricing tiers (Free/Plus/Premium)
  ✓ /profile                  User settings & stats
  ✓ /notifications            Notification center
```

**Total: 17 routes** ✅ Build thành công

---

## ⚡ JavaScript Behaviors

### Landing Page (React Hooks)
- **Scroll Reveal**: IntersectionObserver cho `.reveal` elements
- **Header Scroll**: Thêm class `scrolled` khi scroll > 12px
- **Journey Progress**: Animated progress bar theo scroll
- **Breathing Label**: Toggle "Hít vào..." / "Thở ra..." mỗi 4s
- **Hero Parallax**: Mouse-tracking cho glow & float cards
- **Phone Cycling**: Auto-slide showcase mỗi 3.6s

### Dashboard (Framer Motion)
- **Page Transitions**: Staggered reveals với delay
- **Card Hover**: `whileHover={{ x: 4 }}` effects
- **Chart Animations**: Height transitions với cubic-bezier
- **Modal/Form**: AnimatePresence show/hide
- **Scroll Animations**: `.reveal` với IntersectionObserver

---

## 🔧 Development

### Scripts

```bash
npm run dev      # Development server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint check
```

### Code Quality

- ✅ ESLint configured
- ✅ TypeScript strict mode
- ✅ Prettier recommended
- ✅ No build errors
- ✅ No hydration mismatches

---

## 🚦 Project Status

### ✅ Completed (100%)
- [x] Landing page với full design system
- [x] Authentication UI (Login/Register)
- [x] Dashboard layout với sidebar responsive
- [x] Tất cả 17 màn hình chính
- [x] Responsive design (mobile-ready)
- [x] Framer Motion animations
- [x] CSS design system consistency
- [x] Build production thành công

### 🔄 Next Phase (Backend Integration)
- [ ] NextAuth.js authentication
- [ ] Prisma + PostgreSQL setup
- [ ] API routes (user, journal, assessments...)
- [ ] Real-time chat (Socket.io)
- [ ] Payment integration (Stripe)
- [ ] Email notifications
- [ ] Video call feature

**Xem chi tiết**: [docs/NEXT_STEPS.md](./docs/NEXT_STEPS.md)

---

## 📝 Documentation

**Tất cả tài liệu đã được di chuyển vào folder [docs/](./docs/)**

### 📚 Tài liệu chính:
- **[docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md)** - CSS variables, colors, typography, components
- **[docs/IMPLEMENTATION_SUMMARY.md](./docs/IMPLEMENTATION_SUMMARY.md)** - Technical architecture & patterns
- **[docs/NEXT_STEPS.md](./docs/NEXT_STEPS.md)** - Roadmap, tasks, recommended libraries
- **[docs/QUICKSTART.md](./docs/QUICKSTART.md)** - Quick start guide
- **[docs/ANIMATION_SUMMARY.md](./docs/ANIMATION_SUMMARY.md)** - Animation implementations

### 🐛 Bug Fixes:
- **[docs/FILTER_FIX_SUMMARY.md](./docs/FILTER_FIX_SUMMARY.md)** - Filter buttons fix
- **[docs/FOOTER_FIX.md](./docs/FOOTER_FIX.md)** - Footer visibility fix
- **[docs/SCROLL_OVERLAY_FIX.md](./docs/SCROLL_OVERLAY_FIX.md)** - Scroll overlay fix

**Xem tất cả**: [docs/README.md](./docs/README.md)

---

## 📱 Responsive Breakpoints

```css
/* Desktop: default */
@media (max-width: 980px) { /* Tablet */ }
@media (max-width: 640px) { /* Mobile */ }
```

- Sidebar collapses < 980px
- Single column layouts < 640px
- Touch-friendly spacing trên mobile

---

## 🎯 Key Features Implementation

### 1. Design System Consistency
- 100% tái sử dụng CSS variables từ `:root`
- Không tạo màu/font mới ngoài palette
- Tất cả components follow `.feature-card` pattern

### 2. Animations
- Framer Motion cho page transitions & interactions
- CSS animations cho ambient effects (breathing, shimmer, pulse)
- Respect `prefers-reduced-motion`

### 3. Responsive
- Mobile-first approach
- Sidebar → bottom nav trên mobile (planned)
- Touch gestures support

### 4. Accessibility
- Semantic HTML
- `aria-hidden` cho decorative elements
- Focus visible states
- Color contrast WCAG AA

---

## 🛡️ Security (Planned)

- [ ] HTTPS enforcement
- [ ] CSRF protection
- [ ] XSS prevention
- [ ] Rate limiting
- [ ] Input validation (Zod)
- [ ] SQL injection protection (Prisma)

---

## 🌐 Deployment (Planned)

### Vercel (Recommended)
```bash
vercel --prod
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
CMD ["npm", "start"]
```

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Follow design system guidelines
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing`)
6. Open Pull Request

### Guidelines
- Tái sử dụng CSS classes từ `globals.css` và `dashboard.css`
- Không thêm màu/font mới
- Follow TypeScript conventions
- Add JSDoc comments cho complex logic
- Test responsive trên mobile

---

## 📄 License

[Your License Here]

---

## 📞 Support

- **Email**: support@mentalbridge.com (planned)
- **Docs**: [docs/](./docs/) - Xem tất cả tài liệu
- **Issues**: GitHub Issues

---

## 🎓 Learning Resources

- [Next.js App Router](https://nextjs.org/docs/app)
- [Framer Motion](https://www.framer.com/motion)
- [CSS Variables](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [TypeScript](https://www.typescriptlang.org/docs)

---

**Made with ❤️ for mental health awareness**

Version: 0.1.0 | Framework: Next.js 15 | Last Updated: 2026-08-13
