# Drawer Refactor: View-Only Preview

## Overview
Refactored AnnotationDrawer from mutation-heavy component to **pure view-only preview** with navigation to Task Detail page for actual annotation.

---

## Key Changes

### **Before (Old Drawer):**
```
❌ Had annotation form with inputs
❌ Submit button that mutates data
❌ Quick action buttons
❌ Form validation and state management
❌ Mutation hooks (useMutation)
❌ Direct annotation submission
```

### **After (New Drawer):**
```
✅ Pure view-only component
✅ No inputs, no mutations
✅ Navigate to Task Detail for editing
✅ Load Next for quick preview
✅ Copy utilities (request_id, image URL)
✅ Keyboard shortcuts (N, Enter, Esc)
```

---

## Layout Structure

### **Header**
```
┌────────────────────────────────────────────────────┐
│ Quick Preview [meal] [pending]  [Copy: 68e7ef...]  │
│ Assigned: user123  Created: 2025-01-11 15:30      │
└────────────────────────────────────────────────────┘
```

### **Content (3-Column Grid)**

#### **Left Column (33%) - Image + Link Health:**
```
┌─────────────────────────────┐
│ Image Preview        [↗]    │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ │    🖼️ FOOD IMAGE       │ │
│ │    (300px height)       │ │
│ │                         │ │
│ └─────────────────────────┘ │
│ [Copy Image URL]            │
│                             │
│ Link Health                 │
│ • Status: OK / Error        │
│ • MIME Type: image/*        │
│ • AI Confidence: 95.2%      │
└─────────────────────────────┘
```

#### **Middle Column (33%) - AI Summary:**
```
┌─────────────────────────────┐
│ AI Analysis Summary         │
│ ───────────────────────────│
│ Food Name: Pho Bo           │
│ Ingredients: 12 items       │
│ Calories: 450 kcal          │
│                             │
│ Fat: 15g | Protein: 25g    │
│ Carbs: 60g                  │
│                             │
│ [View Raw JSON]             │
└─────────────────────────────┘
```

#### **Right Column (33%) - Read-only Info:**
```
┌─────────────────────────────┐
│ ℹ User Info (From Import)   │
│ ───────────────────────────│
│ Name: Nguyen Van A          │
│ Email: user@example.com     │
│ Is Logged: Yes              │
│ Edit Category: nutrition    │
│                             │
│ End-User Feedback           │
│ ───────────────────────────│
│ Reaction: 👍 like           │
│ Category: wrong_nutrition   │
│ Note: Calories too high     │
│                             │
│ ℹ Quick Guide               │
│ ───────────────────────────│
│ Meal: Prepared food...      │
│ Label: Nutrition facts...   │
│ Front Label: Marketing...   │
│ Screenshot: Screen caps...  │
│ Others: Unclear images...   │
└─────────────────────────────┘
```

### **Footer Actions**
```
┌────────────────────────────────────────────────────┐
│ Press [Enter] to take action, [N] for next         │
│                      [Load Next] [Take Action →]   │
└────────────────────────────────────────────────────┘
```

---

## Features

### **1. View-Only Components**
- **No form inputs** - All data displayed as text/badges
- **No submit buttons** - Cannot mutate data from drawer
- **Read-only** - Pure information display

### **2. Image Preview**
- Large preview (300px height)
- Open in new tab button
- Copy image URL
- Error handling
- Link health status

### **3. AI Summary**
- Food name display
- Ingredients count
- Nutrition breakdown (calories, fat, protein, carbs)
- View Raw JSON modal (read-only)

### **4. User Information**
- User info from import (immutable)
- Edit category badge
- Is Logged status
- End-user feedback (reaction, category, note)

### **5. Annotation Guide**
- 5 type descriptions (Meal, Label, Front Label, Screenshot, Others)
- Highlighted current type
- Quick reference for annotators

### **6. Actions**

#### **Take Action (Primary):**
```typescript
// Navigate to Task Detail page
navigate(`/tasks/${task.id}`);
onClose();
```
- Opens full Task Detail page
- No pre-assignment
- No mutation from drawer

#### **Load Next (Secondary):**
```typescript
// Preview next task in drawer
const currentIndex = tasks.findIndex(t => t.id === selectedTask.id);
if (currentIndex < tasks.length - 1) {
  setSelectedTask(tasks[currentIndex + 1]);
}
```
- Preview-only
- No locking or assignment
- Stays in drawer
- Shows notification if last task

#### **Copy Links:**
- Copy Request ID
- Copy Image URL
- One-click copy with feedback

### **7. Keyboard Shortcuts**
| Key | Action |
|-----|--------|
| `N` | Load Next (preview next task) |
| `Enter` | Take Action (navigate to detail) |
| `Esc` | Close drawer |

---

## Component Interface

```typescript
interface AnnotationDrawerProps {
  opened: boolean;           // Drawer open state
  onClose: () => void;       // Close handler
  task: Task | null;         // Current task to preview
  tasks?: Task[];            // Task list for Load Next
  onLoadNext?: () => void;   // Load next handler (optional)
}
```

**Key Points:**
- No `onSuccess` callback (no mutations)
- No form state
- No mutation hooks
- Simple navigation

---

## Integration with TaskList

```typescript
<AnnotationDrawer
  opened={opened}
  onClose={close}
  task={selectedTask}
  tasks={tasksData?.data}
  onLoadNext={() => {
    // Find and load next task
    if (tasksData?.data && selectedTask) {
      const currentIndex = tasksData.data.findIndex((t: Task) => t.id === selectedTask.id);
      if (currentIndex >= 0 && currentIndex < tasksData.data.length - 1) {
        setSelectedTask(tasksData.data[currentIndex + 1]);
      } else {
        notifications.show({
          title: 'No more tasks',
          message: 'This is the last task in the current page',
          color: 'blue',
        });
      }
    }
  }}
/>
```

**Removed:**
- ~~`onSuccess` callback~~
- ~~`queryClient.invalidateQueries()`~~
- ~~Mutation management~~

---

## Workflow

### **Old Flow (Mutations in Drawer):**
```
TaskList → Click Task → Drawer Opens
  → Fill Form → Submit → Mutate Data
  → Close Drawer → Refresh List
```

### **New Flow (View-Only Preview):**
```
TaskList → Click Task → Drawer Opens
  → View Info → Take Action
  → Navigate to Task Detail Page
  → Annotate There → Save
  → Back to List (refreshed)

OR

TaskList → Click Task → Drawer Opens
  → View Info → Load Next
  → Preview Next Task (no assignment)
  → Take Action when ready
```

---

## Benefits

### **1. Clear Separation of Concerns**
- **Drawer**: Quick preview, navigation
- **Task Detail Page**: Full annotation, mutations

### **2. No Accidental Mutations**
- Cannot assign/annotate from drawer
- Must go to detail page intentionally
- Safer workflow

### **3. Better UX for Quick Review**
- Preview multiple tasks quickly (Load Next)
- No form clutter
- Focus on information display

### **4. Simpler Component**
- No form state management
- No mutation hooks
- Fewer dependencies
- Easier to maintain

### **5. Keyboard Shortcuts**
- Fast navigation (N for next)
- Quick action (Enter to open detail)
- Efficient workflow

---

## Testing Checklist

### **Drawer Display:**
- [ ] Opens from TaskList click
- [ ] Shows task info correctly
- [ ] Image loads properly
- [ ] AI summary displays
- [ ] User info visible
- [ ] Feedback shows (if present)
- [ ] Guide displays

### **Actions:**
- [ ] Take Action → navigates to `/tasks/:id`
- [ ] Load Next → previews next task
- [ ] Load Next at end → shows notification
- [ ] Copy Request ID → copies to clipboard
- [ ] Copy Image URL → copies to clipboard
- [ ] Open in new tab → opens image

### **Keyboard:**
- [ ] Press N → loads next task
- [ ] Press Enter → navigates to detail
- [ ] Press Esc → closes drawer

### **No Mutations:**
- [ ] No submit buttons visible
- [ ] No form inputs
- [ ] Cannot annotate from drawer
- [ ] Must use Task Detail page

---

## Migration Notes

### **Breaking Changes:**
- Removed `onSuccess` prop
- Removed form state
- Removed mutation hooks
- Removed submit handlers

### **New Props:**
- Added `tasks` (optional, for Load Next)
- Added `onLoadNext` (optional)

### **Updated Usage:**
```typescript
// OLD
<AnnotationDrawer
  opened={opened}
  onClose={close}
  task={task}
  onSuccess={() => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }}
/>

// NEW
<AnnotationDrawer
  opened={opened}
  onClose={close}
  task={task}
  tasks={tasksList}
  onLoadNext={handleLoadNext}
/>
```

---

## Files Changed

1. **apps/web/src/components/AnnotationDrawer.tsx**
   - Complete rewrite
   - 489 lines (was 452)
   - Removed form/mutation logic
   - Added view-only display
   - Added navigation actions

2. **apps/web/src/pages/TaskList.tsx**
   - Updated props usage
   - Removed `onSuccess` callback
   - Added `onLoadNext` handler
   - Removed `useQueryClient` import

---

## Future Enhancements

### **Possible Additions:**
1. **Batch Preview**: Cycle through multiple tasks
2. **Quick Filters**: Filter tasks in drawer
3. **Comparison View**: Compare with previous annotations
4. **Export**: Export task info to clipboard
5. **Print**: Print preview for offline review

### **Performance:**
- Lazy load images
- Virtualize task list
- Cache AI summaries

---

## Summary

**Drawer is now a pure preview tool:**
- ✅ View task information
- ✅ Quick navigation (Load Next)
- ✅ Copy utilities
- ✅ Navigate to detail for editing
- ❌ No mutations
- ❌ No form submission
- ❌ No assignment

**Result**: Cleaner, safer, more focused component for quick task review before taking action.
