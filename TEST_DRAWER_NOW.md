# 🧪 TEST DRAWER NOW - Quick Check

## ✅ FIX APPLIED

**Issue:** Missing `ActionIcon` import
**Fix:** Added to imports from '@mantine/core'
**Status:** ✅ Fixed and deployed

---

## 🚀 TEST STEPS

### **1. Open Web**
```bash
open http://localhost:3000/tasks
```

### **2. Click Any Task**
- Click any row in the table
- OR click the 👁️ icon

**Expected:**
- ✅ Drawer opens from right (90% width)
- ✅ NOT blank/white
- ✅ Shows content in 3 columns

---

## 📋 WHAT YOU SHOULD SEE

### **Header (Top):**
```
┌────────────────────────────────────────────┐
│ Quick Preview  [meal] [pending]  [Copy ID] │
│ Assigned: user123  Created: 2025-...      │
└────────────────────────────────────────────┘
```

### **Left Column (33%):**
```
┌─────────────────────┐
│ Image Preview  [↗]  │
│ ┌─────────────────┐ │
│ │                 │ │
│ │  🖼️ FOOD IMAGE  │ │
│ │  (should load)  │ │
│ │                 │ │
│ └─────────────────┘ │
│ [Copy Image URL]    │
│                     │
│ Link Health         │
│ • Status: OK        │
│ • MIME: image/*     │
│ • Confidence: X%    │
└─────────────────────┘
```

### **Middle Column (33%):**
```
┌─────────────────────┐
│ AI Analysis Summary │
│ ────────────────────│
│ Food Name: ...      │
│ Ingredients: X items│
│ Calories: X kcal    │
│ Fat, Protein, Carbs │
│                     │
│ [View Raw JSON]     │
└─────────────────────┘
```

### **Right Column (33%):**
```
┌─────────────────────┐
│ ℹ User Info         │
│ ────────────────────│
│ Name: ...           │
│ Email: ...          │
│ Is Logged: Yes/No   │
│                     │
│ End-User Feedback   │
│ • Reaction: like    │
│ • Category: ...     │
│                     │
│ Quick Guide         │
│ • Meal: ...         │
│ • Label: ...        │
│ • Front Label: ...  │
│ • Screenshot: ...   │
│ • Others: ...       │
└─────────────────────┘
```

### **Footer (Bottom):**
```
┌────────────────────────────────────────────┐
│ Press [Enter] to take action, [N] for next │
│                  [Load Next] [Take Action] │
└────────────────────────────────────────────┘
```

---

## ❌ IF STILL BLANK

### **Check 1: Task Data**
```javascript
// Open browser console (F12)
// Check if task has data:
console.log('Task:', task);
```

**Expected:**
- task.user_input (image URL)
- task.type (meal/label/etc)
- task.status
- task.request_id

### **Check 2: Console Errors**
```javascript
// Look for errors in console
// Common issues:
// - "Cannot read property 'type' of undefined"
// - "task is null"
// - Image CORS errors
```

### **Check 3: Network Tab**
```
1. Open DevTools → Network tab
2. Click task to open drawer
3. Check if image request fails
4. Look for 404/403/500 errors
```

---

## 🔧 QUICK FIXES

### **If drawer is completely blank:**

**Possible cause:** Task is null when drawer opens

**Fix in TaskList.tsx:**
```typescript
// Make sure task is set before opening
onClick={() => {
  setSelectedTask(task);  // Set task first
  open();                 // Then open drawer
}}
```

### **If only image is missing:**

**Possible cause:** CORS or invalid URL

**Check:**
- task.user_input is a valid URL
- Image server allows CORS
- URL is accessible

---

## ✅ SUCCESS CHECKLIST

When drawer works correctly:
- [ ] Drawer opens (not blank)
- [ ] Header shows task info
- [ ] Left: Image loads
- [ ] Middle: AI summary shows
- [ ] Right: User info + guide shows
- [ ] Footer: Buttons visible
- [ ] Click "Take Action" → navigates to /tasks/:id
- [ ] Press N → loads next task
- [ ] Press Esc → closes drawer

---

## 🐛 DEBUGGING COMMANDS

```bash
# Check if web is running
curl -s http://localhost:3000

# Check console for React errors
# (Open DevTools in browser)

# Verify component imports
cd /Users/duongthanhphu/monorepo-project/apps/web
grep "ActionIcon" src/components/AnnotationDrawer.tsx

# Should see:
# import { ... ActionIcon ... } from '@mantine/core';
```

---

## 📞 REPORT BACK

After testing, report:

1. **Drawer opens?** Yes / No
2. **Content visible?** Yes / No / Partial
3. **What's missing?** (if any)
4. **Console errors?** (copy/paste)
5. **Screenshot?** (if possible)

---

**Web running at:** http://localhost:3000/tasks  
**Status:** ✅ Import fixed, ready to test!
