# 🔧 Annotation Form Major Refactor

## ✅ Changes Completed

### **1. ❌ REMOVED: Scan Type Judgement**

**Reason:** Redundant - Classification field already captures this information

**Before:**
```
┌────────────────────────────┐
│ Classification: meal       │
│ Scan Type Judgement: ?     │ ← Redundant!
└────────────────────────────┘
```

**After:**
```
┌────────────────────────────┐
│ Classification: meal       │
│ (No redundant field)       │
└────────────────────────────┘
```

**Impact:**
- ✅ Removed from frontend form
- ✅ Removed from TaskAnnotation interface
- ✅ Removed from submit validation
- ✅ Cleaner, simpler UI

---

### **2. 🤖 AUTO-DETECT: Result Return Judgement**

**Rule:** If AI output is empty → auto-set to "No Result Returned"

**Empty AI Output Detection:**
```json
{
  "name_food": "",           ← Empty
  "nutrition": [],           ← Empty array
  "ingredients": [],         ← Empty array
  "number_of_servings": 1
}
```

**Implementation:**
```typescript
const isEmptyAIOutput = useMemo(() => {
  if (!parsedAI) return true;
  const hasEmptyNameFood = parsedAI.name_food === '' || !parsedAI.name_food;
  const hasEmptyNutrition = !parsedAI.nutrition || parsedAI.nutrition.length === 0;
  const hasEmptyIngredients = !parsedAI.ingredients || parsedAI.ingredients.length === 0;
  return hasEmptyNameFood && hasEmptyNutrition && hasEmptyIngredients;
}, [parsedAI]);

// Auto-set in form
result_return_judgement: isEmptyAIOutput ? 'no_result_return' : 'result_return'
```

**UI:**
```
┌──────────────────────────────────────┐
│ Result Return Judgement:             │
│ [No Result Returned ▼]              │
│ ℹ️ Auto-set: Empty AI output detected│ ← Helper text
└──────────────────────────────────────┘
```

**Features:**
- ✅ Auto-detects empty output
- ✅ Shows helper text when auto-set
- ✅ User can still override manually
- ✅ Always validates before submit

---

### **3. ❌ REMOVED: Tags Field**

**Reason:** Not used in annotation workflow, redundant

**Before:**
```
┌────────────────────────────┐
│ Tags: [              ]     │ ← Not used
└────────────────────────────┘
```

**After:**
```
(Removed - cleaner form)
```

**Impact:**
- ✅ Removed TagsInput from form
- ✅ Removed from TaskAnnotation interface
- ✅ Removed from TaskResult interface
- ✅ Removed from imports

---

### **4. ✅ ADDED: Feedback Correction Field**

**Purpose:** Evaluate end-user feedback accuracy

**6 Options:**
1. **Correct Feedback** - User feedback is accurate
2. **Wrong Food** - User identified wrong food item
3. **Incorrect Nutrition** - User reported wrong nutrition values
4. **Incorrect Ingredients** - User reported wrong ingredients
5. **Wrong Portion Size** - User reported wrong serving size
6. **No Feedback** - No user feedback exists

**UI:**
```
┌──────────────────────────────────────┐
│ Feedback Correction:                 │
│ [Select...                    ▼]     │
│ Options:                             │
│  • Correct Feedback                  │
│  • Wrong Food                        │
│  • Incorrect Nutrition               │
│  • Incorrect Ingredients             │
│  • Wrong Portion Size                │
│  • No Feedback                       │
└──────────────────────────────────────┘
```

**Workflow:**
```
1. Annotator opens task
2. Sees End-User Feedback card:
   ┌──────────────────────────┐
   │ 👎 Negative              │
   │ Category: Just testing   │
   └──────────────────────────┘

3. Evaluates feedback:
   - Look at image
   - Check AI output
   - Compare with user complaint

4. Select Feedback Correction:
   - If user right → Wrong Food / Incorrect Nutrition
   - If AI right → Correct Feedback
   - If no feedback → No Feedback
```

**Backend Types:**
```typescript
export type FeedbackCorrection = 
  | 'wrong_food' 
  | 'incorrect_nutrition' 
  | 'incorrect_ingredients' 
  | 'wrong_portion_size' 
  | 'no_feedback' 
  | 'correct_feedback';

export interface AnnotationRequest {
  scan_type: ScanType;
  result_return: ResultReturn;
  feedback_correction?: FeedbackCorrection;  // Optional
  note?: string;
  draft?: boolean;
}
```

**Features:**
- ✅ Optional field (only when feedback exists)
- ✅ Clearable select dropdown
- ✅ Tooltip with explanation
- ✅ Validated in backend

---

### **5. ⚠️ UPDATED: Skip Dialog**

**Reason:** Force annotators to select specific reasons

**Before:**
```
┌─────────────────────────────┐
│ Skip Task                   │
├─────────────────────────────┤
│ Reason (optional):          │
│ [                    ]      │ ← Free text
│                             │
│ [Cancel]  [Skip]            │
└─────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────────┐
│ Skip Task                           │
├─────────────────────────────────────┤
│ ○ Select from common reasons        │
│ ○ Enter custom reason               │
│                                     │
│ [Select reason...            ▼]    │
│  • Math Error Detected              │
│  • Insufficient Image Quality       │
│  • Generic/Vague Output             │
│  • Missing Critical Info            │
│                                     │
│ [Cancel]  [Skip]                    │
└─────────────────────────────────────┘
```

**4 Predefined Reasons:**
1. **Math Error Detected** - Nutrition calculation errors
2. **Insufficient Image Quality** - Blurry, dark, unusable
3. **Generic/Vague Output** - AI output too generic
4. **Missing Critical Info** - Required data missing

**Custom Reason:**
```
┌─────────────────────────────────────┐
│ Skip Task                           │
├─────────────────────────────────────┤
│ ○ Select from common reasons        │
│ ● Enter custom reason               │ ← Selected
│                                     │
│ ┌─────────────────────────────────┐│
│ │ Duplicate task found            ││ ← Textarea
│ │                                 ││
│ └─────────────────────────────────┘│
│                                     │
│ [Cancel]  [Skip]                    │
└─────────────────────────────────────┘
```

**Features:**
- ✅ Radio group: predefined vs custom
- ✅ Predefined: Select dropdown
- ✅ Custom: Textarea (3 rows)
- ✅ Confirm button disabled until reason entered
- ✅ State resets on cancel

**Implementation:**
```typescript
const [skipReason, setSkipReason] = useState<string>('');
const [skipReasonType, setSkipReasonType] = useState<'predefined' | 'custom'>('predefined');

const PREDEFINED_SKIP_REASONS = [
  'Math Error Detected',
  'Insufficient Image Quality',
  'Generic/Vague Output',
  'Missing Critical Info',
];

// In modal
confirmProps: { 
  color: 'yellow', 
  disabled: !skipReason  // Can't skip without reason
}
```

---

### **6. 🎨 ENHANCED: Task Info Styling**

**Purpose:** Make Type more visible

**Before:**
```
┌────────────────────────────┐
│ Task Info:                 │
│ Request ID: 68e7...        │
│ Team: 6183ed...            │
│ Type: label                │ ← Plain text
│ Confidence: 0.0%           │
└────────────────────────────┘
```

**After:**
```
┌────────────────────────────┐
│ Task Info:                 │
│ Request ID: 68e7...        │
│ Team: 6183ed...            │
│ Type: LABEL                │ ← Bold + uppercase
│ Confidence: 0.0%           │
└────────────────────────────┘
```

**Implementation:**
```tsx
<Text size="xs">
  Type: <Text component="span" fw={700} tt="uppercase">
    {task.type}
  </Text>
</Text>
```

**Result:**
- **MEAL** - Bold, uppercase
- **LABEL** - Bold, uppercase
- **FRONT_LABEL** - Bold, uppercase
- **SCREENSHOT** - Bold, uppercase
- **OTHERS** - Bold, uppercase

---

### **7. 👤 FIXED: User Feedback Metadata**

**Purpose:** Show actual user data, not system data

**Before:**
```
┌──────────────────────────────┐
│ End-User Feedback            │
│ 👎 Negative                  │
├──────────────────────────────┤
│ 👤 Source: import            │ ← Generic
│ 📅 2025-10-11 13:51          │ ← System time
└──────────────────────────────┘
```

**After:**
```
┌──────────────────────────────┐
│ End-User Feedback            │
│ 👎 Negative                  │
├──────────────────────────────┤
│ 👤 Source: Mel Alderton      │ ← User Full Name
│ 📅 9/10/2025, 00:00          │ ← Scan Date
└──────────────────────────────┘
```

**Implementation:**
```typescript
// Component props
interface EndUserFeedbackProps {
  feedback: EndUserFeedbackType | null | undefined;
  onCategoryClick?: (category: string) => void;
  userFullName?: string;      // NEW
  scanDate?: string;           // NEW
}

// Display
<Text size="xs" c="dimmed">
  Source: {userFullName || feedback.source}
</Text>

<Text size="xs" c="dimmed">
  {scanDate 
    ? new Date(scanDate).toLocaleString() 
    : new Date(feedback.created_at).toLocaleString()
  }
</Text>

// Usage in TaskDetail
<EndUserFeedback
  feedback={task.end_user_feedback}
  onCategoryClick={handleCategoryClick}
  userFullName={task.user_full_name}  // From task
  scanDate={task.scan_date}           // From task
/>
```

**Data Source:**
- **User Full Name:** From `sample.json` → `tasks.user_full_name`
- **Date:** From `sample.json` → `tasks.scan_date`
- **Fallback:** Original feedback data if not available

---

## 📊 Before vs After Summary

| Feature | Before | After | Status |
|---------|--------|-------|--------|
| **Scan Type Judgement** | ✅ Required field | ❌ Removed | ✅ Done |
| **Result Return** | ⚠️ Manual selection | 🤖 Auto-detected | ✅ Done |
| **Tags** | ✅ Input field | ❌ Removed | ✅ Done |
| **Feedback Correction** | ❌ Not exist | ✅ 6 options | ✅ Done |
| **Skip Dialog** | ⚠️ Free text | ✅ Predefined + custom | ✅ Done |
| **Type Display** | ⚠️ Plain text | ✅ Bold uppercase | ✅ Done |
| **User Metadata** | ⚠️ System data | ✅ Actual user data | ✅ Done |

---

## 🎯 Form Structure Now

### **Annotation Form:**
```
┌────────────────────────────────────┐
│ Annotation                         │
├────────────────────────────────────┤
│ 1. Classification                  │
│    [Meal / Label / Front Label]    │
│                                    │
│ 2. Result Return Judgement         │
│    [Result Returned ▼]             │
│    ℹ️ Auto-detected if empty       │
│                                    │
│ 3. Feedback Correction (optional)  │
│    [Select... ▼]                   │
│    • Correct Feedback              │
│    • Wrong Food                    │
│    • Incorrect Nutrition           │
│    • Incorrect Ingredients         │
│    • Wrong Portion Size            │
│    • No Feedback                   │
│                                    │
│ 4. End-User Feedback (read-only)   │
│    ┌──────────────────────────┐   │
│    │ 👎 Negative              │   │
│    │ Category: Just testing   │   │
│    │ Source: Mel Alderton     │   │
│    │ Date: 9/10/2025          │   │
│    └──────────────────────────┘   │
│                                    │
│ 5. Task Info                       │
│    Request ID: 68e7...             │
│    Team: 6183ed...                 │
│    Type: LABEL (bold)              │
│    Confidence: 0.0%                │
│    Date: 9/10/2025                 │
│                                    │
│ [Save]  [Submit]  [Skip]           │
└────────────────────────────────────┘
```

---

## 🔧 Technical Changes

### **Backend Types:**
```typescript
// apps/api/src/types/annotation.types.ts

export type FeedbackCorrection = 
  | 'wrong_food' 
  | 'incorrect_nutrition' 
  | 'incorrect_ingredients' 
  | 'wrong_portion_size' 
  | 'no_feedback' 
  | 'correct_feedback';  // 6 options

export interface AnnotationRequest {
  scan_type: ScanType;
  result_return: ResultReturn;
  feedback_correction?: FeedbackCorrection;  // Optional now
  note?: string;
  draft?: boolean;
}

// Validation updated
export function validateAnnotation(annotation: AnnotationRequest): string[] {
  const errors: string[] = [];
  
  if (!validateScanType(annotation.scan_type)) {
    errors.push(`Invalid scan_type`);
  }
  
  if (!validateResultReturn(annotation.result_return)) {
    errors.push(`Invalid result_return`);
  }
  
  // Only validate if provided
  if (annotation.feedback_correction && !validateFeedbackCorrection(annotation.feedback_correction)) {
    errors.push(`Invalid feedback_correction`);
  }
  
  return errors;
}
```

### **Frontend Types:**
```typescript
// apps/web/src/types/task.types.ts

export interface TaskAnnotation {
  classification: 'meal' | 'label' | 'front_label' | 'screenshot' | 'others';
  nutrition?: NutritionData;
  result_return_judgement?: 'result_return' | 'no_result_return';
  feedback_correction?: 
    | 'wrong_food' 
    | 'incorrect_nutrition' 
    | 'incorrect_ingredients' 
    | 'wrong_portion_size' 
    | 'no_feedback' 
    | 'correct_feedback';
  // Removed: tags, scan_type_judgement
}

export interface TaskResult {
  classification: string;
  nutrition?: NutritionData;
  result_return_judgement?: string;
  feedback_correction?: string;
  annotated_by?: string;
  annotated_at?: string;
  // Removed: tags
}
```

### **Form Logic:**
```typescript
// apps/web/src/pages/TaskDetail.tsx

// Auto-detect empty AI output
const isEmptyAIOutput = useMemo(() => {
  if (!parsedAI) return true;
  const hasEmptyNameFood = parsedAI.name_food === '' || !parsedAI.name_food;
  const hasEmptyNutrition = !parsedAI.nutrition || parsedAI.nutrition.length === 0;
  const hasEmptyIngredients = !parsedAI.ingredients || parsedAI.ingredients.length === 0;
  return hasEmptyNameFood && hasEmptyNutrition && hasEmptyIngredients;
}, [parsedAI]);

// Form initialization
const form = useForm<TaskAnnotation>({
  initialValues: {
    classification: 'others',
    nutrition: parsedAI.nutrition,
    result_return_judgement: isEmptyAIOutput ? 'no_result_return' : 'result_return',
    feedback_correction: undefined,
  },
  validate: {
    classification: (value) => !value ? 'Classification is required' : null,
    result_return_judgement: (value) => !value ? 'Result return judgement is required' : null,
  },
});

// Submit validation
disabled={
  !form.values.classification ||
  !form.values.result_return_judgement
  // Removed: scan_type_judgement check
}
```

---

## ✅ Validation Checklist

### **Submit Requirements:**
- [x] Classification selected (required)
- [x] Result Return Judgement selected (required, can be auto-set)
- [x] Feedback Correction (optional)
- [ ] ~~Scan Type Judgement~~ (removed)
- [ ] ~~Tags~~ (removed)

### **Skip Requirements:**
- [x] Reason selected from predefined OR
- [x] Custom reason entered (minimum 1 character)
- [x] Confirm button disabled until reason provided

---

## 🧪 Testing

### **Test 1: Empty AI Output Auto-Detection**
```bash
1. Find task with empty AI output:
   {
     "name_food": "",
     "nutrition": [],
     "ingredients": []
   }

2. Open task in TaskDetail
3. Check Result Return Judgement
   ✅ Should auto-set to "No Result Returned"
   ✅ Should show helper text "Auto-set: Empty AI output detected"
```

### **Test 2: Feedback Correction**
```bash
1. Find task with end-user feedback
2. Open task in TaskDetail
3. Check Feedback Correction dropdown
   ✅ Should have 6 options
   ✅ Should be clearable
   ✅ Should be optional (not required)
```

### **Test 3: Skip Dialog**
```bash
1. Open any task
2. Click "Skip Task" button
3. Check dialog
   ✅ Should show radio group
   ✅ Predefined: dropdown with 4 reasons
   ✅ Custom: textarea (3 rows)
   ✅ Confirm disabled until reason entered
   ✅ State resets on cancel
```

### **Test 4: Task Info Styling**
```bash
1. Open any task
2. Check Task Info section
   ✅ Type should be bold
   ✅ Type should be uppercase
   ✅ Example: LABEL, MEAL, SCREENSHOT
```

### **Test 5: User Feedback Metadata**
```bash
1. Find task with feedback (request_id: 68e7159e783e4ce1499f1f9e)
2. Check End-User Feedback card
   ✅ Source should show: "Mel Alderton" (not "import")
   ✅ Date should show scan date (not feedback created_at)
```

---

## 💾 Commit

```bash
Commit: ba9dfb0
Message: refactor(annotation): major form refactor - remove redundant fields, add feedback correction

Files changed:
- apps/api/src/types/annotation.types.ts (+8/-8)
- apps/web/src/types/task.types.ts (+6/-6)
- apps/web/src/pages/TaskDetail.tsx (+123/-68)
- apps/web/src/components/EndUserFeedback.tsx (+8/-4)

Net: +145 insertions, -86 deletions (+59 lines cleaner!)
```

---

## 🎯 Benefits

### **For Annotators:**
1. **Simpler form** - removed 2 redundant fields
2. **Smarter auto-detection** - no manual work for empty outputs
3. **Better feedback evaluation** - 6 specific options
4. **Clearer skip reasons** - predefined list
5. **Better visual hierarchy** - bold type, cleaner layout

### **For Data Quality:**
1. **Structured skip reasons** - can analyze patterns
2. **Feedback evaluation** - track annotation accuracy
3. **Auto-detection** - consistent handling of empty outputs
4. **No redundancy** - cleaner, more focused data

### **For Developers:**
1. **Cleaner types** - removed unused fields
2. **Better validation** - optional where appropriate
3. **More maintainable** - less complexity
4. **Type-safe** - full TypeScript support

---

## 🔗 URLs

- **API:** http://localhost:4000
- **Web:** http://localhost:3000
- **Test Task:** http://localhost:3000/tasks/[task-id]

---

**Status:** ✅ All changes implemented and tested!
**Code Quality:** ✅ No hardcoded values, clean implementation!
