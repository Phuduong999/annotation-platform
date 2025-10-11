# 🧪 Test Guide: View-Only Drawer

## 🎯 Overview
The Drawer is now **view-only** - no mutations, only preview and navigation.

---

## ✅ What Changed

### **BEFORE (Mutation Drawer):**
```
❌ Form inputs (Scan Type, Result Return, Notes)
❌ Submit button → Direct mutation
❌ Quick action buttons
❌ Form validation
❌ Auto-refresh after submit
❌ Can annotate from drawer
```

### **AFTER (View-Only Preview):**
```
✅ Pure information display
✅ No inputs, no buttons that mutate
✅ Navigate to Task Detail for editing
✅ Load Next for quick preview
✅ Copy utilities (request_id, image URL)
✅ Keyboard shortcuts (N, Enter, Esc)
```

---

## 🎨 New Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Quick Preview  [meal] [pending]  [Copy: 68e7ef...]    [X]   │
│  Assigned: user123  Created: 2025-01-11 15:30               │
├────────────────┬────────────────┬─────────────────────────────┤
│ LEFT (33%)     │ MIDDLE (33%)   │ RIGHT (33%)                 │
├────────────────┼────────────────┼─────────────────────────────┤
│ Image Preview  │ AI Summary     │ User Info (From Import)     │
│ ┌────────────┐ │                │                             │
│ │ 🖼️ FOOD    │ │ Food: Pho Bo   │ Name: Nguyen Van A         │
│ │  IMAGE     │ │ Ingredients: 12│ Email: user@example.com    │
│ │  (300px)   │ │ Calories: 450  │ Is Logged: Yes             │
│ └────────────┘ │                │ Edit Category: nutrition    │
│ [Copy URL]     │ Fat: 15g       │                             │
│                │ Protein: 25g   │ End-User Feedback           │
│ Link Health    │ Carbs: 60g     │ • Reaction: 👍 like         │
│ • Status: OK   │                │ • Category: wrong_nutrition │
│ • MIME: image/*│ [View Raw JSON]│ • Note: Calories too high   │
│ • Confidence:  │                │                             │
│   95.2%        │                │ Quick Guide                 │
│                │                │ • Meal: Prepared food...    │
│                │                │ • Label: Nutrition facts... │
│                │                │ • Front Label: Marketing... │
└────────────────┴────────────────┴─────────────────────────────┘
│ Press [Enter] to take action, [N] for next    [Load Next] [Take Action →] │
└──────────────────────────────────────────────────────────────┘
```

---

## 🧪 Test Cases

### **Test 1: Open Drawer**
**Steps:**
1. Go to http://localhost:3000/tasks
2. Click any task row (or click 👁️ icon)

**Expected:**
- ✅ Drawer opens from right (90% width)
- ✅ Shows 3-column layout
- ✅ Header displays: Request ID, Status, Assigned, Timestamps
- ✅ Image loads in left column
- ✅ AI summary in middle
- ✅ User info + guide in right
- ✅ Footer shows actions

**Check:**
- ❌ No form inputs visible
- ❌ No submit/save buttons
- ❌ No annotation form

---

### **Test 2: View Image**
**Steps:**
1. Open drawer with any task
2. Look at left column

**Expected:**
- ✅ Image displays (300px height)
- ✅ "Open in new tab" button (↗) visible
- ✅ "Copy Image URL" button visible
- ✅ Link Health info shows:
  - Status: OK/Error
  - MIME Type: image/*
  - AI Confidence: X%

**Actions:**
- Click "Open in new tab" → Opens image in new browser tab
- Click "Copy Image URL" → Copies URL to clipboard, button shows "Copied!"

---

### **Test 3: View AI Summary**
**Steps:**
1. Open drawer with meal task
2. Look at middle column

**Expected:**
- ✅ AI Analysis Summary card
- ✅ Shows food name (if available)
- ✅ Shows ingredients count
- ✅ Shows calories
- ✅ Shows macros (Fat, Protein, Carbs)
- ✅ "View Raw JSON" button

**Actions:**
- Click "View Raw JSON" → Opens modal with JSON (read-only)
- Modal shows formatted JSON
- Can scroll through JSON
- Close modal → Returns to drawer

---

### **Test 4: View User Info**
**Steps:**
1. Open drawer
2. Look at right column

**Expected:**
- ✅ "User Info (From Import)" card
- ✅ Shows name (if available)
- ✅ Shows email (if available)
- ✅ Shows is_logged status badge
- ✅ Shows edit_category (if available)

**Check:**
- ❌ Cannot edit any of these fields
- ❌ No input boxes
- ❌ Pure display only

---

### **Test 5: View Feedback**
**Steps:**
1. Open task that has end_user_feedback
2. Look at right column

**Expected:**
- ✅ "End-User Feedback" card visible
- ✅ Shows reaction badge (like/dislike)
- ✅ Shows category badge
- ✅ Shows note text

**Check:**
- All read-only
- No edit buttons

---

### **Test 6: View Guide**
**Steps:**
1. Open any drawer
2. Scroll right column to bottom

**Expected:**
- ✅ "Quick Guide" card (blue background)
- ✅ Shows 5 types:
  - Meal: Prepared food items...
  - Label: Nutrition facts...
  - Front Label: Marketing claims...
  - Screenshot: Screen captures...
  - Others: Any image not fitting...
- ✅ Current task type highlighted in blue

---

### **Test 7: Copy Request ID**
**Steps:**
1. Open drawer
2. Click "Copy Request ID" button in header (e.g., "68e7ef...")

**Expected:**
- ✅ Full request_id copied to clipboard
- ✅ Button shows checkmark icon
- ✅ Tooltip changes to "Copied!"
- After 2 seconds → Resets to copy icon

---

### **Test 8: Take Action**
**Steps:**
1. Open drawer
2. Click "Take Action" button in footer

**Expected:**
- ✅ Navigates to `/tasks/:id` (Task Detail page)
- ✅ Drawer closes
- ✅ Full annotation form loads
- ✅ URL changes to `/tasks/UUID`

**Check:**
- Can now annotate on detail page
- Has full form with inputs
- Has submit button

---

### **Test 9: Load Next**
**Steps:**
1. Open drawer with first task
2. Click "Load Next" button

**Expected:**
- ✅ Drawer stays open
- ✅ Content updates to next task
- ✅ Image changes
- ✅ AI summary updates
- ✅ User info updates
- ✅ All data reflects new task

**Edge Case - Last Task:**
1. Open drawer with last task in list
2. Click "Load Next"

**Expected:**
- ✅ Shows notification: "No more tasks"
- ✅ Message: "This is the last task in the current page"
- ✅ Drawer stays open
- ✅ Same task still displayed

---

### **Test 10: Keyboard Shortcut - N**
**Steps:**
1. Open drawer
2. Press `N` key

**Expected:**
- ✅ Loads next task (same as clicking "Load Next")
- ✅ Drawer updates content
- ✅ Works from any focused element

---

### **Test 11: Keyboard Shortcut - Enter**
**Steps:**
1. Open drawer
2. Press `Enter` key

**Expected:**
- ✅ Navigates to Task Detail (same as "Take Action")
- ✅ Drawer closes
- ✅ Detail page loads

---

### **Test 12: Keyboard Shortcut - Esc**
**Steps:**
1. Open drawer
2. Press `Esc` key

**Expected:**
- ✅ Drawer closes
- ✅ Returns to TaskList
- ✅ No mutation occurred

---

### **Test 13: No Mutations Possible**
**Steps:**
1. Open drawer
2. Look for any way to edit/save data

**Expected:**
- ❌ No text inputs
- ❌ No select dropdowns
- ❌ No textareas
- ❌ No submit button
- ❌ No save button
- ❌ No "Annotate" button
- ❌ No "Skip" button
- ✅ Only "Take Action" (navigates)
- ✅ Only "Load Next" (preview)

---

### **Test 14: Completed Task Display**
**Steps:**
1. Open drawer with completed task (status = 'completed')
2. Look at right column

**Expected:**
- ✅ "Current Annotation" card visible
- ✅ Shows "Annotated Type" badge
- ✅ Blue alert box: "This task has been annotated. Click 'Take Action' to view or modify."
- ✅ No inline edit
- ✅ Must navigate to detail

---

### **Test 15: Multi-task Navigation**
**Steps:**
1. Open drawer with task #1
2. Press `N` → Task #2 loads
3. Press `N` → Task #3 loads
4. Press `Enter` → Navigates to Task #3 detail
5. Go back → TaskList
6. Open task #5 → Drawer shows #5

**Expected:**
- ✅ Load Next cycles through tasks
- ✅ Take Action goes to current task
- ✅ Drawer always shows correct task
- ✅ No data loss or mixing

---

## 🎯 Regression Tests

### **TaskList Still Works:**
- ✅ Table displays all tasks
- ✅ Pagination works
- ✅ Filters work
- ✅ Click row → Opens drawer
- ✅ Column visibility toggle works

### **Task Detail Still Works:**
- ✅ Navigate directly to `/tasks/:id`
- ✅ Full annotation form loads
- ✅ Can submit annotations
- ✅ Mutations work
- ✅ Back button returns to list

---

## ❌ Anti-Tests (Should NOT Work)

### **Cannot Annotate from Drawer:**
- ❌ Cannot select scan type
- ❌ Cannot select result return
- ❌ Cannot enter corrected type
- ❌ Cannot write notes
- ❌ Cannot submit
- ❌ Cannot skip

### **Cannot Assign from Drawer:**
- ❌ No "Start Task" button
- ❌ No "Assign to Me" button
- ❌ Task assignment unchanged
- ❌ Status unchanged

### **Cannot Mutate Data:**
- ❌ No API calls to mutate
- ❌ No form submissions
- ❌ Task list does not refresh (because no changes)

---

## 🚀 Workflow Test

### **Happy Path: Preview → Annotate**
```
1. User opens TaskList
   ✅ Sees 20 tasks

2. User clicks task #5
   ✅ Drawer opens (view-only)
   ✅ Sees image, AI summary, user info

3. User presses N (Load Next)
   ✅ Task #6 previews
   ✅ Sees different image/data

4. User presses N again
   ✅ Task #7 previews

5. User presses Enter (Take Action)
   ✅ Navigates to /tasks/UUID-7
   ✅ Drawer closes
   ✅ Full annotation form loads

6. User annotates task #7
   ✅ Fills form
   ✅ Clicks Submit
   ✅ Task saved

7. User clicks Back
   ✅ Returns to TaskList
   ✅ Task #7 now shows 'completed'
   ✅ Can open drawer on task #8
```

---

## 📊 Comparison Table

| Feature | OLD Drawer | NEW Drawer |
|---------|------------|------------|
| **Display Info** | ✅ | ✅ |
| **Image Preview** | ✅ | ✅ |
| **AI Summary** | ❌ | ✅ |
| **Form Inputs** | ✅ | ❌ |
| **Submit Button** | ✅ | ❌ |
| **Quick Actions** | ✅ | ❌ |
| **Load Next** | ❌ | ✅ |
| **Copy Utils** | ❌ | ✅ |
| **Keyboard Nav** | ❌ | ✅ |
| **Navigate to Detail** | ❌ | ✅ |
| **Mutations** | ✅ | ❌ |
| **Can Annotate** | ✅ | ❌ |

---

## 🐛 Known Limitations

1. **Load Next** only works within current page (20 tasks)
   - Cannot load task from next page
   - Shows notification when reaching end

2. **No batch operations** from drawer
   - Cannot skip multiple tasks
   - Cannot assign multiple tasks

3. **Image errors** not auto-retried
   - If image fails to load, shows error
   - User must refresh manually

---

## ✅ Success Criteria

### **Drawer Opens:**
- [x] Click row → Drawer opens
- [x] Shows task info
- [x] No form inputs visible

### **Information Display:**
- [x] Image loads
- [x] AI summary shows
- [x] User info displays
- [x] Guide visible

### **Actions Work:**
- [x] Take Action → navigates to detail
- [x] Load Next → previews next task
- [x] Copy links → copies to clipboard

### **Keyboard Shortcuts:**
- [x] N → loads next
- [x] Enter → navigates
- [x] Esc → closes

### **No Mutations:**
- [x] Cannot edit from drawer
- [x] Cannot submit from drawer
- [x] Must use detail page

---

## 🎬 Demo Script

```bash
# 1. Start servers
cd monorepo-project
# API and DB should be running

# 2. Open web
open http://localhost:3000/tasks

# 3. Test drawer
# - Click any task row
# - Verify view-only layout
# - Press N (load next)
# - Press N again
# - Press Enter (navigate to detail)
# - Annotate on detail page
# - Back to list
# - Click another task
# - Click "Load Next" button
# - Click "Copy Request ID"
# - Click "Take Action"
```

---

## 📝 Test Report Template

```
## Drawer Refactor Test Report

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:** Development

### Basic Functionality
- [ ] Drawer opens from TaskList
- [ ] 3-column layout displays
- [ ] Image loads correctly
- [ ] AI summary shows
- [ ] User info visible
- [ ] No form inputs present

### Actions
- [ ] Take Action navigates to detail
- [ ] Load Next previews next task
- [ ] Copy Request ID works
- [ ] Copy Image URL works
- [ ] Open in new tab works

### Keyboard Shortcuts
- [ ] N loads next task
- [ ] Enter navigates to detail
- [ ] Esc closes drawer

### No Mutations
- [ ] Cannot annotate from drawer
- [ ] Cannot submit from drawer
- [ ] No assignment buttons
- [ ] Must use detail page for editing

### Bugs Found
[List any bugs]

### Suggestions
[Any improvements]

### Conclusion
- [ ] All tests passed
- [ ] Ready for production
```

---

**Test thoroughly before deploying! 🚀**
