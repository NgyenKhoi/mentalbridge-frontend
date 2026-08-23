# 🔧 Scroll Overlay Fix

## 🐛 Vấn đề

**Triệu chứng:**
- ❌ Một lớp trắng hình chữ nhật đè lên table
- ❌ Scrollbar xanh ở mép phải nhưng không tương tác đúng
- ❌ Content bị che khuất bởi scroll container
- ❌ Có vẻ như có 2 layers chồng lên nhau

**Nguyên nhân:**
```
Modal Container (fixed)
├─ Overlay (blur backdrop)
└─ Content
   └─ Table Wrap (scroll) ← Đang tạo layer riêng
      └─ Table ← Bị che
```

Vấn đề xảy ra vì:
1. Z-index không được quản lý đúng
2. Scroll container tạo stacking context mới
3. Overlay và content không có pointer-events đúng
4. Scrollbar track có background che content

## ✅ Giải pháp

### 1. **Fix Pointer Events**
```css
.history-modal-container {
  pointer-events: none;  /* Container không chặn clicks */
}

.history-modal-container > * {
  pointer-events: auto;  /* Children nhận clicks */
}
```

**Lý do**: Container chỉ để layout, không cần nhận events. Chỉ có overlay và content cần nhận clicks.

### 2. **Fix Z-Index Stack**
```css
.history-modal-overlay {
  z-index: -1;  /* Đẩy xuống dưới content */
}

.history-modal-content {
  z-index: 1;   /* Lên trên overlay */
  overflow: hidden;  /* Clip children */
}
```

**Lý do**: Overlay phải ở dưới, content ở trên. `overflow: hidden` ngăn content tràn ra ngoài border-radius.

### 3. **Fix Table Stacking**
```css
.history-modal-table-wrap {
  position: relative;  /* Tạo positioning context */
  overflow-x: hidden;  /* Ngăn scroll ngang */
}

.history-modal-table {
  position: relative;
  z-index: 1;  /* Đảm bảo table ở trên */
}
```

**Lý do**: Table cần có z-index để không bị scroll container che.

### 4. **Fix Scrollbar Styling**
```css
.history-modal-table-wrap::-webkit-scrollbar-track {
  background: transparent;  /* ✅ Không có background */
  border-radius: 4px;
}

.history-modal-table-wrap::-webkit-scrollbar-thumb {
  background: var(--teal);
  border: 2px solid var(--surface);  /* Border để tạo padding */
}
```

**Lý do**: Track transparent không tạo lớp che. Border trên thumb tạo spacing tự nhiên.

## 🎨 Visual Layers - Sau khi fix

```
Z-Index Stack (từ dưới lên trên):
┌──────────────────────────────────┐
│ -1: Overlay (blur backdrop)      │
├──────────────────────────────────┤
│  0: (implicit)                   │
├──────────────────────────────────┤
│  1: Modal Content                │
│     └─ Table Wrap (relative)     │
│        └─ Table (z-index: 1)     │
│           └─ Rows                │
└──────────────────────────────────┘

Scrollbar Position:
┌────────────────────────┬─┐
│ Content (scrollable)   │█│ ← Thumb (teal)
│                        │ │ ← Track (transparent)
│                        │ │
└────────────────────────┴─┘
```

## 💻 Code Changes

### Before (Problematic):
```css
/* ❌ Container blocks clicks */
.history-modal-container {
  position: fixed;
  inset: 0;
}

/* ❌ Overlay same level as content */
.history-modal-overlay {
  position: fixed;
}

/* ❌ No overflow control */
.history-modal-content {
  /* no overflow */
}

/* ❌ Track creates white layer */
.history-modal-table-wrap::-webkit-scrollbar-track {
  background: var(--surface-soft);
}
```

### After (Fixed):
```css
/* ✅ Container for layout only */
.history-modal-container {
  pointer-events: none;
}

.history-modal-container > * {
  pointer-events: auto;
}

/* ✅ Overlay behind content */
.history-modal-overlay {
  z-index: -1;
}

/* ✅ Content clips children */
.history-modal-content {
  overflow: hidden;
  z-index: 1;
}

/* ✅ Table on top */
.history-modal-table {
  position: relative;
  z-index: 1;
}

/* ✅ Track transparent */
.history-modal-table-wrap::-webkit-scrollbar-track {
  background: transparent;
}

.history-modal-table-wrap::-webkit-scrollbar-thumb {
  border: 2px solid var(--surface);
}
```

## 🎯 How It Works

### Pointer Events Flow:
```
User Click
    ↓
Container (pointer-events: none) → Pass through
    ↓
Children (pointer-events: auto) → Receive
    ↓
[Overlay] or [Content]
```

### Z-Index Layering:
```
Top (highest z-index)
    ↓
Table (z-index: 1)
    ↓
Content (z-index: 1)
    ↓
(default z-index: 0)
    ↓
Overlay (z-index: -1)
    ↓
Bottom (lowest z-index)
```

### Scroll Container:
```
Table Wrap
├─ position: relative (context)
├─ overflow-y: auto (vertical scroll)
├─ overflow-x: hidden (no horizontal)
└─ Scrollbar
   ├─ Track: transparent (no layer)
   └─ Thumb: teal with border (visible)
```

## 🔍 Debugging Tips

### Check Z-Index:
```css
/* Add temporarily to debug */
.history-modal-overlay {
  background: red !important;  /* Should be behind */
}

.history-modal-content {
  background: blue !important;  /* Should be on top */
}
```

### Check Pointer Events:
```js
// In browser console
document.querySelector('.history-modal-container').style.pointerEvents
// Should be: "none"

document.querySelector('.history-modal-content').style.pointerEvents
// Should be: "auto"
```

### Check Scroll:
```css
/* Add temporarily */
.history-modal-table-wrap::-webkit-scrollbar-track {
  background: red !important;  /* Should NOT see red layer */
}
```

## ✅ Testing Checklist

Visual:
- [x] No white rectangle overlay
- [x] Content fully visible
- [x] Scrollbar visible (teal)
- [x] No double layers

Interaction:
- [x] Can click on table rows
- [x] Can click buttons in table
- [x] Can scroll table
- [x] Scrollbar thumb draggable
- [x] Click overlay closes modal

Layout:
- [x] Content doesn't overflow border-radius
- [x] No horizontal scrollbar
- [x] Footer always visible
- [x] Header stays fixed when scrolling

## 🎨 Scrollbar Design

### Desktop:
```
Width: 8px
Track: transparent (no background)
Thumb: teal (#3D7A6E)
Border: 2px solid surface (creates padding)
Hover: teal-deep (#1E4A43)
```

### Visual:
```
┌──────────────────┬─┐
│ Content          │ │ ← Track (transparent)
│                  │█│ ← Thumb (teal)
│                  │ │   with 2px border
│                  │█│
└──────────────────┴─┘
```

## 📱 Responsive

### Mobile:
- Same fixes apply
- Scrollbar may be hidden (OS dependent)
- Touch scrolling works

### Browser Support:
- ✅ Chrome/Edge: Full support
- ✅ Firefox: Uses default scrollbar
- ✅ Safari: Custom scrollbar supported
- ℹ️ IE11: Not supported (but acceptable)

## 🚀 Performance

Before fix:
- ❌ Double rendering (overlay + table)
- ❌ Z-fighting issues
- ❌ Pointer event conflicts

After fix:
- ✅ Clean stacking context
- ✅ No render conflicts
- ✅ Efficient pointer routing
- ✅ Smooth scrolling

## 📊 Visual Comparison

### Before:
```
┌─────────────────────────┐
│ Header                  │
├─────────────────────────┤
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ← White overlay
│ ▓Table hidden below▓▓▓ │    blocking content
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
└─────────────────────────┘
```

### After:
```
┌─────────────────────────┐
│ Header                  │
├─────────────────────────┤
│ Row 1                   │ ← Content visible
│ Row 2                   │
│ Row 3                   │ ← Scrollable
└─────────────────────────┘
```

---

**Status**: ✅ Fixed
**Complexity**: Medium (z-index + pointer-events)
**Impact**: 🚀 Critical UX fix

## 🎯 Summary

**Problem**: Scroll container creating opaque overlay
**Root Cause**: Z-index stack + scrollbar track background
**Solution**: 
1. Fix pointer-events routing
2. Establish clear z-index hierarchy  
3. Make scrollbar track transparent
4. Add overflow control

**Result**: Clean, transparent scroll with no overlays

