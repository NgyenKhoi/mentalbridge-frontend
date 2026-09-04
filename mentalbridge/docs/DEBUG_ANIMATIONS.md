# 🐛 Debug Animation Issues

## Vấn đề: "Không thấy animations khi click orbit topics"

---

## ✅ Bước 1: Kiểm tra Browser Console

### Mở DevTools Console:

```
1. Bấm F12
2. Click tab "Console"
3. Chạy các lệnh sau:
```

### Test 1: Check GSAP loaded

```javascript
typeof gsap
// Expected: "object"
// If "undefined": GSAP không load
```

### Test 2: Check ScrollTrigger

```javascript
typeof ScrollTrigger
// Expected: "object"
```

### Test 3: Check Lenis

```javascript
typeof Lenis
// Expected: "function"
```

### Test 4: Kiểm tra orbit topics có class đúng không

```javascript
document.querySelectorAll('.orbit-topic').length
// Expected: 6 (vì có 6 topics)
```

### Test 5: Check có lỗi gì không

```javascript
// Xem trong Console tab có text màu đỏ không
// Nếu có, copy và gửi cho tôi
```

---

## ✅ Bước 2: Force Clear Cache

### Method 1: Chrome DevTools

```
1. F12 mở DevTools
2. Right-click vào nút Refresh (⟳)
3. Chọn "Empty Cache and Hard Reload"
```

### Method 2: Clear Browsing Data

```
1. Ctrl + Shift + Delete
2. Chọn "Cached images and files"
3. Time range: "All time"
4. Click "Clear data"
```

### Method 3: Incognito Mode

```
Ctrl + Shift + N
Mở http://localhost:3000
Test trong incognito
```

---

## ✅ Bước 3: Rebuild Project

### Stop Server:

```
Trong terminal đang chạy npm run dev:
Ctrl + C
```

### Clear Next.js cache:

```powershell
cd mentalbridge
Remove-Item -Recurse -Force .next
```

### Restart:

```powershell
npm run dev
```

---

## ✅ Bước 4: Manual Test trong Console

### Test Animation Manually:

```javascript
// Mở Console (F12)
// Paste và chạy từng đoạn:

// 1. Get elements
const topic = document.querySelector('.orbit-topic-1')
const halo = document.querySelector('.hero-orbit-halo')
const content = document.querySelector('.hero-orbit-content')

console.log('Topic:', topic)
console.log('Halo:', halo)
console.log('Content:', content)

// 2. Test GSAP animation manual
gsap.to(topic, {
  scale: 1.5,
  duration: 0.5,
  onComplete: () => console.log('Animation done!'),
})

// Nếu topic phóng to → GSAP đang hoạt động
// Nếu không có gì xảy ra → GSAP không load hoặc có lỗi
```

---

## ✅ Bước 5: Kiểm tra Network Tab

### Check files loaded:

```
1. F12 → Network tab
2. Refresh page (Ctrl+R)
3. Filter: "gsap"
4. Xem có file nào chứa "gsap" load không
```

**Expected:**

- Nên thấy các files GSAP được load
- Status: 200 OK

---

## ✅ Bước 6: Check Source Code

### View trong DevTools:

```
1. F12 → Sources tab
2. webpack:// → components → Hero.tsx
3. Tìm function selectTopic
4. Xem có code gsap.timeline không
```

**Expected:** Nên thấy code:

```typescript
const timeline = gsap.timeline({
  onStart: () => {
    setActiveTopic(index)
  },
  ...
})
```

---

## 🔍 Common Issues & Solutions

### Issue 1: "typeof gsap returns 'undefined'"

**Cause:** GSAP không được import đúng

**Solution:**

```javascript
// Trong Console, force import:
import('https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js').then(() =>
  console.log('GSAP loaded manually'),
)

// Sau đó test lại
typeof gsap
```

### Issue 2: "orbit-topic không có class orbit-topic-1"

**Cause:** JSX không render đúng

**Solution:** Check trong Console:

```javascript
document.querySelector('.orbit-topic')?.className
// Nên thấy: "orbit-topic orbit-topic-1" hoặc tương tự
```

### Issue 3: "Click vào topic không có gì xảy ra"

**Debug:**

```javascript
// Add event listener manual
document.querySelector('.orbit-topic-1').addEventListener('click', (e) => {
  console.log('Clicked!', e.target)
})

// Click vào topic
// Nếu không log ra "Clicked!" → Event listener không hoạt động
```

### Issue 4: "Console có lỗi: Cannot read property of undefined"

**Cause:** Element không tồn tại khi code chạy

**Solution:** Check timing:

```javascript
// Wait for DOM ready
setTimeout(() => {
  console.log('Topics:', document.querySelectorAll('.orbit-topic').length)
}, 2000)
```

---

## 🧪 Complete Test Script

### Copy và paste vào Console:

```javascript
// === ANIMATION DEBUG SCRIPT ===
console.log('=== Starting Animation Debug ===')

// 1. Check GSAP
console.log('1. GSAP loaded?', typeof gsap !== 'undefined' ? '✅ YES' : '❌ NO')
if (typeof gsap === 'undefined') {
  console.error('GSAP not loaded! Check network tab for errors.')
}

// 2. Check elements
const topics = document.querySelectorAll('.orbit-topic')
const halo = document.querySelector('.hero-orbit-halo')
const content = document.querySelector('.hero-orbit-content')

console.log('2. Elements found:')
console.log('   Topics:', topics.length, topics.length === 6 ? '✅' : '❌')
console.log('   Halo:', halo ? '✅' : '❌')
console.log('   Content:', content ? '✅' : '❌')

// 3. Check classes
if (topics.length > 0) {
  console.log('3. First topic classes:', topics[0].className)
}

// 4. Test animation
if (typeof gsap !== 'undefined' && topics.length > 0) {
  console.log('4. Testing animation...')
  gsap.to(topics[0], {
    scale: 1.3,
    duration: 0.5,
    yoyo: true,
    repeat: 1,
    onComplete: () => console.log('   ✅ Animation test successful!'),
  })
} else {
  console.log('4. ❌ Cannot test animation - missing GSAP or topics')
}

// 5. Check for errors
const errors = window.console.error
console.log('5. Check Console for red errors above')

console.log('=== Debug Complete ===')
console.log('If you see ❌, there is an issue with that item')
```

---

## 📸 Expected vs Actual

### Expected Behavior:

1. Click topic → See multi-stage animation (~1 second)
2. Content fades out
3. Halo rotates
4. Topic glows
5. Content fades back in

### Current Behavior (your issue):

- Click topic → Content changes instantly
- No animation
- No transitions

---

## 🆘 If Nothing Works

### Last Resort: Re-apply changes

```powershell
# 1. Stop server (Ctrl+C)

# 2. Backup current Hero.tsx
cd mentalbridge\components
Copy-Item Hero.tsx Hero.tsx.backup

# 3. Check git status
git status
git diff components/Hero.tsx

# 4. If no changes shown, the file might not be saved
# Let me know and I'll re-apply the changes

# 5. Verify file was modified
Get-Item Hero.tsx | Select-Object LastWriteTime
# Should show recent time (today)

# 6. Restart
cd ..
npm run dev
```

---

## 📋 Report Template

**Please test and report:**

```
### Test Results:

1. typeof gsap: [your result]
2. Topics found: [number]
3. Console errors: [yes/no - copy errors if yes]
4. Animation test: [success/fail]
5. Hard refresh tried: [yes/no]
6. Incognito mode: [yes/no]
7. .next deleted: [yes/no]

### Screenshots:
- Console tab
- Network tab (filtered "gsap")
- Elements tab (orbit-topic)
```

---

## 🎯 Quick Checklist

- [ ] Server running (http://localhost:3000)
- [ ] F12 DevTools open
- [ ] Console tab visible
- [ ] Ran: `typeof gsap`
- [ ] Result is "object"
- [ ] Ran: `document.querySelectorAll('.orbit-topic').length`
- [ ] Result is 6
- [ ] Tried hard refresh (Ctrl+Shift+R)
- [ ] No red errors in Console
- [ ] Clicked orbit topic
- [ ] Still no animation

**If all checked and still no animation:**
→ Take screenshot của Console tab
→ Send to me for further debug

---

**Status:** Ready for Debug  
**Next:** Run the Complete Test Script in Console
