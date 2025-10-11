# 🔧 User Feedback Display Fix

## ✅ Issue Fixed

### **Problem:**
User feedback từ sample.json không hiển thị trong TaskDetail

**Example data:**
```json
{
  "Reaction": "dislike",
  "Feedback Category": "Just testing", 
  "Feedback": "",
  "Request ID": "68e7159e783e4ce1499f1f9e",
  "User Full Name": "Mel Alderton"
}
```

**Result:** EndUserFeedback component hiển thị "No feedback"

---

## 🔍 Root Cause

### **Import Flow:**
1. ✅ JSON import → normalizeJsonRecord() → map Reaction, Feedback Category
2. ✅ insertFeedbackEventFromImport() → insert vào `feedback_events` table
3. ✅ Feedback stored successfully in database

### **Task Query:**
```sql
-- OLD (Missing feedback)
SELECT * FROM tasks WHERE id = $1
```

**Problem:** Query chỉ lấy từ `tasks` table, KHÔNG join với `feedback_events` table!

---

## ✅ Solution

### **Updated Queries:**

#### **1. GET /tasks (List):**
```sql
SELECT 
  t.*,
  json_build_object(
    'reaction', f.reaction,
    'category', f.category,
    'note', f.note
  ) as end_user_feedback
FROM tasks t
LEFT JOIN feedback_events f ON t.request_id = f.request_id
WHERE 1=1
ORDER BY t.created_at DESC
```

#### **2. GET /tasks/:id (Detail):**
```sql
SELECT 
  t.*,
  json_build_object(
    'reaction', f.reaction,
    'category', f.category,
    'note', f.note
  ) as end_user_feedback
FROM tasks t
LEFT JOIN feedback_events f ON t.request_id = f.request_id
WHERE t.id = $1
```

---

## 🎯 How It Works

### **Database Schema:**

**tasks table:**
```
id | request_id | user_id | team_id | scan_type | ...
```

**feedback_events table:**
```
id | request_id | reaction | category | note | ...
```

**Join condition:** `tasks.request_id = feedback_events.request_id`

### **Result Mapping:**
```typescript
// API returns:
{
  id: "...",
  request_id: "68e7159e...",
  user_id: "...",
  // ... other task fields
  end_user_feedback: {
    reaction: "dislike",
    category: "Just testing",
    note: ""
  }
}
```

### **Frontend Display:**
```typescript
<EndUserFeedback 
  feedback={task.end_user_feedback}
  onCategoryClick={handleCategoryClick}
/>
```

**Result:**
```
┌──────────────────────────────┐
│ End-User Feedback            │
│ ────────────────────────────│
│ 👎 Negative                  │ ← Shows dislike
│ Category: Just testing       │ ← Shows category
│ Note: (empty)                │
└──────────────────────────────┘
```

---

## 📊 Before vs After

### **Before:**
```
API Response:
{
  id: "...",
  request_id: "68e7159e...",
  // NO end_user_feedback field
}

Frontend:
┌──────────────────────────────┐
│ End-User Feedback            │
│ No feedback                  │ ← Wrong!
└──────────────────────────────┘
```

### **After:**
```
API Response:
{
  id: "...",
  request_id: "68e7159e...",
  end_user_feedback: {          ← Added!
    reaction: "dislike",
    category: "Just testing",
    note: ""
  }
}

Frontend:
┌──────────────────────────────┐
│ End-User Feedback            │
│ 👎 Negative                  │ ← Correct!
│ Category: Just testing       │
└──────────────────────────────┘
```

---

## 🎯 Benefits

### **For Annotators:**
1. **See user's original feedback**
   - What did user react? (like/dislike/neutral)
   - What category did they report? (wrong_nutrition, etc.)
   - What note did they leave?

2. **Evaluate feedback accuracy**
   - User said "dislike" → Check if AI really got it wrong
   - User said "wrong_nutrition" → Verify nutrition values
   - Make better annotation decisions

3. **Data quality improvement**
   - Catch patterns in user complaints
   - Identify systematic AI errors
   - Improve training data based on feedback

---

## 🧪 Testing

### **Test 1: Check API Response**
```bash
# Get task with feedback
curl http://localhost:4000/tasks/[task-id] | jq '.data.end_user_feedback'

# Expected output:
{
  "reaction": "dislike",
  "category": "Just testing",
  "note": ""
}
```

### **Test 2: Check TaskDetail UI**
```bash
1. Open task with request_id: 68e7159e783e4ce1499f1f9e
2. Look at annotation form
3. Should see:
   ┌──────────────────────────────┐
   │ End-User Feedback            │
   │ 👎 Negative                  │
   │ Category: Just testing       │
   └──────────────────────────────┘
```

### **Test 3: Check Tasks with NO Feedback**
```bash
1. Open task without feedback
2. Should see:
   ┌──────────────────────────────┐
   │ End-User Feedback            │
   │ No feedback                  │
   └──────────────────────────────┘
```

---

## 📝 Code Changes

### **File: apps/api/src/routes/task.routes.ts**

**Lines Changed:**
- GET /tasks query: +11 lines
- GET /tasks/:id query: +9 lines
- Total: +20 insertions, -6 deletions

**Key Changes:**
1. Changed `SELECT *` to `SELECT t.*, json_build_object(...)`
2. Changed `FROM tasks` to `FROM tasks t LEFT JOIN feedback_events f`
3. Changed `WHERE id = $1` to `WHERE t.id = $1`
4. Changed column references to use table aliases (t.status, t.created_at)

---

## 💡 Use Cases

### **Use Case 1: Verify User Complaint**
```
User feedback: "dislike" + "wrong_nutrition"
Annotator checks:
1. Look at image → meal with rice
2. Check AI output → says "450 kcal"
3. Check user log → user logged 350 kcal
→ Decision: User is right, AI overestimated by 100 kcal
→ Mark as: Wrong Type + No Result Return
```

### **Use Case 2: False Complaint**
```
User feedback: "dislike" + "wrong_food"
Annotator checks:
1. Look at image → clearly pho
2. Check AI output → says "pho"
3. User might be confused or trolling
→ Decision: AI is correct
→ Mark as: Correct Type + Result Return
```

### **Use Case 3: Edge Case Discovery**
```
Multiple users with "dislike" on screenshots
Pattern: AI struggles with app screenshots
→ Annotators report to team
→ Improve AI training for screenshots
```

---

## ✅ Checklist

- [x] Updated GET /tasks query with LEFT JOIN
- [x] Updated GET /tasks/:id query with LEFT JOIN
- [x] Added json_build_object for feedback mapping
- [x] Used table aliases (t, f)
- [x] API returns end_user_feedback field
- [x] Frontend EndUserFeedback component works
- [x] Tested with sample.json data
- [x] Committed changes

---

## 🎯 Result

### **For task "68e7159e783e4ce1499f1f9e":**

**Before:**
- ❌ Feedback not visible
- ❌ Annotator can't see user complaint
- ❌ Can't evaluate feedback accuracy

**After:**
- ✅ Shows "dislike" reaction
- ✅ Shows "Just testing" category
- ✅ Annotator can verify if feedback is valid
- ✅ Better annotation decisions

---

## 💾 Commit

```bash
Commit: 602d60f
Message: fix(api): add end_user_feedback to task queries with LEFT JOIN

Stats:
+26 insertions
-6 deletions
```

---

## 📚 Related

**Import Flow:**
- sample.json → import.service.ts → normalizeJsonRecord()
- → insertFeedbackEventFromImport() → feedback_events table

**Display Flow:**
- GET /tasks/:id → LEFT JOIN feedback_events
- → end_user_feedback field → TaskDetail
- → EndUserFeedback component → UI

**Component:**
- apps/web/src/components/EndUserFeedback.tsx
- Shows reaction badge (like/dislike/neutral)
- Shows category badge
- Shows note text
- Handles "No feedback" case

---

**Status:** ✅ Fixed! Feedback now visible for annotators!
**Purpose:** Annotators đánh giá feedback có đúng hay không
