# 🚀 Quick Test Guide - Animation Changes

## ✅ Server đang chạy

**URL:** http://localhost:3000

---

## 🔄 Nếu không thấy thay đổi

### Bước 1: Hard Refresh
```
Windows: Ctrl + Shift + R
hoặc: Ctrl + F5
```

### Bước 2: Clear Cache
```
1. Mở DevTools (F12)
2. Right-click nút Refresh
3. Chọn "Empty Cache and Hard Reload"
```

### Bước 3: Restart Server
```bash
# Stop server: Ctrl + C trong terminal
# Hoặc chạy lệnh:
npm run dev
```

---

## 🎯 Những gì đã thay đổi

### 1. Hero Orbit Topics ⭐⭐⭐

#### Trước:
- Click topic → Content đổi đột ngột
- Không có animation đặc biệt
- Hover đơn giản

#### Sau:
- ✨ Multi-stage animation khi click:
  1. Content fade out với stagger
  2. Halo xoay và phóng to
  3. Topics pulse down
  4. Topic được chọn pop lên với glow
  5. Content fade in với bounce

- ✨ Hover improvements:
  - Scale 1.08x với bounce
  - Brightness +15%
  - Dot phóng to
  - Smooth transitions

- ✨ Active state:
  - Dot nhấp nháy pulse infinite
  - Glow effect

### 2. Halo (Vòng tròn giữa) 🌟

- ✨ Breathing animation liên tục
  - Outer ring thở 6s
  - Inner ring thở 6s (reverse)
  - Opacity fade

### 3. Cards 📇

#### Feature Cards:
- ✨ 3D rotation entrance (rotationX: -5deg)
- ✨ Hover: lift + rotate icon + glow underneath

#### Barrier Cards:
- ✨ Slide from left với 3D perspective
- ✨ Hover: lift + scale + shadow

#### Risk Cards:
- ✨ Colored shadows theo risk level
- ✨ Border glow khi hover

### 4. Journey Section 🛤️

- ✨ Progress line fill theo scroll
- ✨ Traveler dot bounce in
- ✨ Steps hover với glow ring

### 5. Buttons 🔘

- ✨ Bounce effect
- ✨ Shimmer sweep animation
- ✨ Scale on hover
- ✨ Active state press down

---

## 🧪 Test Steps

### Test 1: Hero Orbit Topics
```
1. Mở http://localhost:3000
2. Click vào "Lo âu" 
3. Quan sát animation sequence (~ 1 giây)
4. Click các topics khác
5. Hover qua từng topic
6. Xem dot có nhấp nháy không
```

**Mong đợi:**
- Smooth transition giữa topics
- Glow effect khi chọn
- Content fade out → fade in
- Halo xoay nhẹ

### Test 2: Scroll Animations
```
1. Scroll chậm xuống trang
2. Quan sát cards fade in
3. Features section
4. Barriers section
5. Journey section - xem line fill
6. Risk cards với colored shadows
```

**Mong đợi:**
- Cards xuất hiện từng cái với stagger
- Journey line fill theo scroll
- Smooth reveals

### Test 3: Hover Effects
```
1. Hover qua feature cards
   → Icon rotate + glow underneath
2. Hover qua barrier cards
   → Lift + scale
3. Hover qua risk cards
   → Colored shadow theo level
4. Hover qua buttons
   → Bounce + shimmer
```

**Mong đợi:**
- Mọi hover mượt mà
- Icons rotate đẹp
- Shadows xuất hiện

---

## 🔍 Debug Checklist

### Nếu không thấy animations:

- [ ] Server đang chạy? (http://localhost:3000)
- [ ] Đã hard refresh? (Ctrl + Shift + R)
- [ ] Đã clear cache?
- [ ] Console có errors?
  - F12 → Console tab
  - Xem có lỗi đỏ không
- [ ] Check FPS
  - F12 → Performance tab
  - Record → scroll → stop
  - Should see 60 FPS

### Check trong DevTools Console:

```javascript
// Check GSAP loaded
typeof gsap

// Check ScrollTrigger
ScrollTrigger.getAll()

// Check Lenis
typeof Lenis
```

---

## 📊 Performance Check

### Mở DevTools Performance:
```
1. F12 → Performance tab
2. Click Record (●)
3. Scroll qua trang
4. Click topics
5. Stop recording
6. Check FPS (should be 60)
```

---

## 🎨 Visual Checklist

| Element | Animation | Working? |
|---------|-----------|----------|
| Orbit Topics Click | Multi-stage | ☐ |
| Orbit Topics Hover | Scale + glow | ☐ |
| Halo | Breathing | ☐ |
| Feature Cards | 3D entrance | ☐ |
| Feature Icons | Rotate | ☐ |
| Barrier Cards | Slide left | ☐ |
| Risk Cards | Colored shadows | ☐ |
| Journey Line | Scroll fill | ☐ |
| Buttons | Bounce + shimmer | ☐ |

---

## 🆘 Troubleshooting

### Issue: "Không thấy gì thay đổi cả"

**Solution 1: Clear Everything**
```bash
# Stop server (Ctrl+C)
cd mentalbridge
Remove-Item -Recurse -Force .next
npm run dev
```

**Solution 2: Check File Changes**
```bash
# Verify files were modified
git status
git diff components/Hero.tsx
git diff app/globals.css
```

### Issue: "Animations giật lag"

**Causes:**
- Too many tabs open
- CPU heavy processes
- Old browser version

**Solutions:**
- Close other tabs
- Update browser
- Check CPU usage

### Issue: "Console có lỗi GSAP"

**Fix:**
```bash
# Reinstall GSAP
npm install gsap@^3.15.0
npm install lenis@^1.3.26
```

---

## 📸 Screenshots to Compare

### Before:
- Topics đổi đột ngột
- Không có hover effects
- Cards xuất hiện cứng

### After:
- Smooth transitions
- Beautiful hover effects  
- Elegant reveals

---

## ✅ Success Indicators

### You'll know it's working when:

1. **Click topic** → See 5-stage animation:
   - Fade out
   - Halo spin
   - Topic glow
   - Fade in

2. **Hover topic** → Bounces up + glows

3. **Scroll page** → Cards reveal smoothly

4. **Hover cards** → Icons rotate + lift up

5. **Journey section** → Line fills as you scroll

6. **Hover buttons** → Shimmer effect sweeps

---

## 🎯 Expected Results

### Timeline:
- Topic click → 1 second total animation
- Card reveal → 0.8 seconds
- Button hover → 0.35 seconds
- Smooth 60 FPS

### Visual Quality:
- No jank or stutter
- Smooth easing curves
- Beautiful glow effects
- Professional feel

---

## 📞 Need Help?

### Check these files:
1. `components/Hero.tsx` - Orbit animation logic
2. `components/ScrollReveal.tsx` - Scroll animations
3. `app/globals.css` - Animation styles

### Verify GSAP working:
```javascript
// In browser console:
console.log(typeof gsap) // Should be "object"
console.log(ScrollTrigger.getAll().length) // Should be > 0
```

---

**Status:** ✅ Ready to Test  
**Server:** http://localhost:3000  
**Next Step:** Hard refresh và test!
