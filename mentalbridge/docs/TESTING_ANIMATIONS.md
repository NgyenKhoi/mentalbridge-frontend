# 🧪 Testing Animation Guide

## 🚀 Getting Started

### 1. Start Development Server

```bash
cd mentalbridge
npm run dev
```

Mở browser tại: `http://localhost:3000`

---

## ✅ Test Checklist

### 🎯 Hero Section - Orbit Topics

#### Test 1: Click Animations
- [ ] Click vào topic "Lo âu"
  - Content fade out mượt mà
  - Halo xoay và phóng to nhẹ
  - Topic được chọn pulse với glow effect
  - Các topic khác dim down
  - Content mới fade in với bounce effect
  
- [ ] Click lần lượt qua 6 topics
  - Mỗi transition mất ~1 giây
  - Không bị giật lag
  - Text thay đổi đúng

#### Test 2: Hover Effects
- [ ] Hover qua từng orbit topic
  - Topic scale lên 1.08x
  - Màu chuyển sang trắng (#f1cad6)
  - Brightness tăng 15%
  - Dot trong topic phóng to 1.2x
  - Transition mượt mà (~350ms)

- [ ] Hover vào topic active
  - Dot nhấp nháy với glow effect
  - Animation pulse 2.5s infinite
  - Glow màu hồng (#efbdc9)

#### Test 3: Halo Animation
- [ ] Quan sát halo breathing
  - Outer ring scale 1 → 1.03 (6s)
  - Inner ring scale 1 → 1.03 reverse (6s)
  - Opacity fade 1 → 0.92
  - Chuyển động mượt mà

- [ ] Di chuyển chuột trong hero
  - Halo follow chuột (quickTo animation)
  - Topics di chuyển theo depth
  - Smooth parallax effect

---

### 🎴 Cards Animations

#### Test 4: Feature Cards
- [ ] Scroll down đến Features section
  - Cards fade in lần lượt
  - 3D rotation (rotationX: -5deg)
  - Scale từ 0.91 → 1
  - Stagger 85ms giữa cards

- [ ] Hover qua feature cards
  - Lift -8px + scale 1.02
  - Icon rotate -10deg + scale 1.16
  - Glow effect xuất hiện bên dưới
  - Border fade, shadow tăng
  - Duration ~450ms

#### Test 5: Barrier Cards
- [ ] Scroll đến Barriers section
  - Cards slide từ bên trái (x: -48px)
  - 3D perspective (rotationY: 6deg)
  - Scale 0.94 → 1
  - Stagger 130ms

- [ ] Hover qua barrier cards
  - Lift -5px + scale 1.02
  - Shadow depth tăng
  - Background color shift
  - Smooth transition

#### Test 6: Risk Cards
- [ ] Scroll đến Risk Levels
  - Cards rise từ dưới (y: 54px)
  - Stagger 110ms

- [ ] Hover qua từng risk card
  - **Low (Teal)**: 
    - Shadow màu teal
    - Border glow teal
  - **Mid (Amber)**:
    - Shadow màu amber
    - Border glow amber
  - **High (Terracotta)**:
    - Shadow màu terracotta
    - Border glow terracotta
  - Lift -7px + scale 1.02

---

### 🛤️ Journey Section

#### Test 7: Journey Line Animation
- [ ] Scroll slowly qua Journey section
  - Progress line fill từ trái sang phải
  - Sync perfect với scroll position
  - Smooth scrubbing (no jumps)
  - Traveler dot bounce in
  - Back.out easing for dot

#### Test 8: Journey Steps
- [ ] Scroll đến steps
  - Steps fade in với stagger
  - Scale 0.96 → 1

- [ ] Hover qua journey steps
  - Step lift -4px
  - Dot scale 1.12x
  - Glow ring 8px radius
  - Màu amber (#e1a651)

---

### 🎯 Buttons & Links

#### Test 9: Primary Buttons
- [ ] Hover "Bắt đầu sàng lọc miễn phí"
  - Lift -3px + scale 1.02
  - Shadow tăng intensity
  - Brightness +8%
  - Shimmer effect chạy qua
  - Duration ~350ms

- [ ] Click button
  - Scale down 0.98x
  - Quick feedback (150ms)
  - Bounce back

#### Test 10: Text Links
- [ ] Hover "Xem cách hoạt động →"
  - Text slide right 3px
  - Arrow slide right thêm 4px (total 7px)
  - Color shift to white
  - Bounce easing

---

### 🎪 Special Sections

#### Test 11: Hotline Banner
- [ ] Scroll đến hotline
  - Clip-path animation open
  - Lift from bottom (y: 52px)
  - Scale 0.96 → 1
  - Expo.out easing (smooth)

- [ ] Quan sát continuous animation
  - Glow pulse 2s cycle
  - Box-shadow amber color
  - Subtle breathing effect

#### Test 12: CTA Section
- [ ] Scroll đến CTA (cuối trang)
  - Elements fade in với stagger
  - Scale 0.97 → 1
  - Back.out elastic bounce
  - Stagger 130ms giữa elements

---

## 🎨 Visual Checks

### Animation Quality Checklist:
- [ ] Không có animation nào giật lag
- [ ] 60 FPS smooth trên desktop
- [ ] Transitions mượt mà, không đột ngột
- [ ] Colors blend đẹp
- [ ] Shadows realistic
- [ ] Scale/rotate không bị distortion

### Timing Checks:
- [ ] Fast actions (hover): 200-350ms ✓
- [ ] Medium reveals (cards): 400-600ms ✓
- [ ] Slow entrances (sections): 800-1100ms ✓

### Easing Checks:
- [ ] Bounce effects có overshoot ✓
- [ ] Expo easings smooth deceleration ✓
- [ ] Power easings natural motion ✓

---

## 🔧 Debug Tips

### Browser DevTools

#### 1. Check FPS:
```
Chrome DevTools → Performance → Record
Scroll and interact, then stop recording
Look for green bars (60 FPS)
Red/yellow = performance issues
```

#### 2. Check GSAP Animations:
```javascript
// In browser console:
gsap.globalTimeline.getChildren()  // See all active animations
ScrollTrigger.getAll()  // See all ScrollTriggers
```

#### 3. Slow Down Animations:
```javascript
// In browser console:
gsap.globalTimeline.timeScale(0.3)  // Slow to 30%
```

#### 4. Check Will-Change:
```
Chrome DevTools → Elements → Computed
Search for "will-change"
Should see "transform" on animated elements
```

---

## 🐛 Common Issues

### Issue 1: Animations không chạy
**Check:**
- Dev server đang chạy?
- Console có errors?
- GSAP đã import đúng?

### Issue 2: Lag/Jank
**Solutions:**
- Check CPU usage
- Close other tabs
- Try in Incognito mode
- Check will-change properties

### Issue 3: Hover không hoạt động
**Check:**
- CSS selector đúng?
- Hover media query có conflict?
- Z-index issues?

### Issue 4: Scroll animations trigger sai
**Debug:**
```javascript
ScrollTrigger.getAll().forEach(st => {
  console.log(st.trigger, st.start, st.end)
})
```

---

## 📊 Performance Metrics

### Target Metrics:
- **FPS**: 60 on desktop, 30+ on mobile
- **First animation**: < 100ms after scroll
- **Hover response**: < 50ms
- **Scroll smoothness**: No jank, steady frame rate

### Monitor in DevTools:
1. Performance tab
2. Record while scrolling
3. Check:
   - Frame rate (green bars)
   - Long tasks (should be < 50ms)
   - Layout shifts (should be minimal)

---

## ✅ Acceptance Criteria

### Animation must:
- [ ] Run at 60 FPS on desktop
- [ ] Work in Chrome, Firefox, Safari, Edge
- [ ] Respect `prefers-reduced-motion`
- [ ] Not block user interaction
- [ ] Degrade gracefully on slow devices

### Interactions must:
- [ ] Feel responsive (< 100ms)
- [ ] Provide clear feedback
- [ ] Complete smoothly
- [ ] Not interfere with each other

---

## 🎬 Demo Scenarios

### Scenario 1: New User First Visit
1. Page loads → Hero breathes
2. Click first topic → Smooth transition
3. Scroll down → Cards reveal beautifully
4. Hover cards → Delightful feedback
5. Reach CTA → Strong call to action

### Scenario 2: Mobile Experience
1. Touch interactions work
2. Hover states skip on mobile
3. Scroll animations smooth on 60Hz screen
4. No lag on mid-range phones

### Scenario 3: Accessibility Mode
1. Enable "Reduce Motion" in OS
2. Page loads without animations
3. All content visible immediately
4. Interactions still work
5. No jarring movements

---

## 📝 Test Report Template

```markdown
# Animation Test Report

**Date:** 2026-08-19
**Tester:** [Your Name]
**Browser:** Chrome 126
**Device:** Desktop / MacBook Pro

## Test Results

### Hero Animations: ✅ PASS
- Orbit topics: Working perfectly
- Halo breathing: Smooth
- Parallax: Responsive

### Card Animations: ✅ PASS
- Feature cards: Excellent
- Barrier cards: Smooth
- Risk cards: Good shadows

### Issues Found: None

### Performance: 60 FPS

### Notes:
- Everything working as expected
- Animations feel polished
- No lag detected
```

---

**Happy Testing! 🎉**
