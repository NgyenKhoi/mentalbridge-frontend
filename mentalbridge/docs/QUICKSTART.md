# 🚀 Quick Start Guide

## Chạy dự án ngay lập tức

### 1. Mở terminal và cd vào thư mục dự án:
```bash
cd mentalbridge
```

### 2. Chạy development server:
```bash
npm run dev
```

### 3. Mở trình duyệt:
Truy cập [http://localhost:3000](http://localhost:3000)

**Xong!** 🎉

---

## Các lệnh khác

### Build production:
```bash
npm run build
```

### Chạy production server:
```bash
npm start
```

### Lint code:
```bash
npm run lint
```

---

## Kiểm tra các tính năng

Sau khi mở [http://localhost:3000](http://localhost:3000), hãy test:

### ✅ Header
- Scroll trang xuống → Header có nền blur

### ✅ Hero
- Di chuột trong vùng Hero → Glow theo cursor, cards và vòng tròn nghiêng nhẹ
- Chờ 4 giây → Label "Hít vào..." đổi sang "Thở ra..."

### ✅ Showcase
- Phone mockup tự động đổi slide mỗi 3.6 giây
- 3 slides: AI chat → Journal → Chart

### ✅ Journey
- Scroll đến section Journey
- Thanh amber fill từng bước
- Dots highlight khi vào view

### ✅ Scroll Reveal
- Scroll từ đầu đến cuối trang
- Các phần tử fade in khi vào viewport

### ✅ Responsive
- Resize cửa sổ xuống < 980px → Layout đổi sang tablet
- Resize xuống < 640px → Layout mobile

---

## Deploy lên Vercel

### Cách 1: GitHub + Vercel (recommended)
1. Push code lên GitHub
2. Import repository vào Vercel
3. Deploy tự động

### Cách 2: Vercel CLI
```bash
npm install -g vercel
vercel
```

---

## Troubleshooting

### Port 3000 đã được sử dụng?
```bash
# Chạy trên port khác
npm run dev -- -p 3001
```

### Build bị lỗi?
```bash
# Xóa cache và build lại
rm -rf .next
npm run build
```

### Font không load?
- Kiểm tra internet connection (fonts load từ Google)
- Font được cache sau lần đầu

---

## File structure nhanh

```
mentalbridge/
├── app/
│   ├── layout.tsx      ← Root layout + fonts
│   ├── page.tsx        ← Main page
│   └── globals.css     ← Tất cả CSS
├── components/         ← 10 components
├── README.md          ← Docs đầy đủ
└── package.json
```

---

## Cần giúp đỡ?

- 📖 Xem [README.md](./README.md) cho docs đầy đủ
- 📝 Xem [MIGRATION_NOTES.md](./MIGRATION_NOTES.md) cho chi tiết kỹ thuật
- 📊 Xem [SUMMARY.md](./SUMMARY.md) cho tổng quan

---

**Happy coding!** 🎨✨
