# 📋 HƯỚNG DẪN SỬ DỤNG ANNOTATION TOOL

## 🎯 **Mục đích:**
Công cụ annotation giúp bạn đánh giá và label dữ liệu hình ảnh thức ăn một cách nhanh chóng và chính xác.

---

## 🖥️ **GIAO DIỆN MỚI - ANNOTATOR VIEW**

### **Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  [◀] Task ID: 68e7ef59...  [▶]      [Zoom] [Shortcuts]    │
│  Progress: ████████░░░░░░░ 45% (9/20 tasks)                │
├──────────────────────────────┬──────────────────────────────┤
│                              │  QUICK ANNOTATION            │
│                              │  ┌─────────────────────────┐ │
│         HÌNH ẢNH            │  │ Quick Actions:           │ │
│         (70%)               │  │ ✓ Correct & Complete    │ │
│                              │  │ ✗ Wrong Type / No Result│ │
│    [Click để zoom]          │  └─────────────────────────┘ │
│                              │                              │
│                              │  Scan Type Judgement: *      │
│                              │  [✓ Correct] [✗ Wrong]      │
│                              │  Press 1 or 2               │
│                              │                              │
│                              │  Result Return: *            │
│                              │  [✓ Return] [✗ No Return]   │
│                              │  Press 3 or 4               │
│                              │                              │
│                              │  Corrected Type:            │
│                              │  [Dropdown]                 │
│                              │                              │
│                              │  Notes:                      │
│                              │  [Text area]                │
│                              │                              │
│                              │  [Submit & Next] Ctrl+Enter │
├──────────────────────────────┴──────────────────────────────┤
│  ▼ AI Analysis [Click to expand]                           │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ **WORKFLOW NHANH:**

### **Bước 1: Xem hình ảnh**
- Hình ảnh hiển thị to (70% màn hình)
- Click vào ảnh hoặc nhấn `Z` để zoom full-screen
- Xem chi tiết món ăn, ingredients, presentation

### **Bước 2: Đánh giá nhanh**
Có 2 cách:

#### **A. Quick Actions (1-click):**
- ✅ **Correct & Complete**: Click nếu AI đúng hoàn toàn
- ❌ **Wrong Type / No Result**: Click nếu AI sai hoàn toàn

#### **B. Custom Annotation (chi tiết):**
1. **Scan Type Judgement** (bắt buộc):
   - `✓ Correct Type`: AI nhận diện đúng loại
   - `✗ Wrong Type`: AI nhận diện sai loại
   - Phím tắt: `1` (Correct) | `2` (Wrong)

2. **Result Return Judgement** (bắt buộc):
   - `✓ Result Return`: AI trả về kết quả nutrition
   - `✗ No Result Return`: AI không trả về kết quả
   - Phím tắt: `3` (Return) | `4` (No Return)

3. **Corrected Type** (nếu AI sai):
   - Chọn loại đúng: Meal, Label, Front Label, Screenshot, Others

4. **Notes** (tùy chọn):
   - Ghi chú thêm nếu cần (ví dụ: "Missing ingredient", "Portion size wrong")

### **Bước 3: Submit**
- Click **Submit & Next** hoặc nhấn `Ctrl+Enter`
- Hệ thống tự động chuyển sang task tiếp theo

---

## ⌨️ **KEYBOARD SHORTCUTS (Phím tắt)**

### **Annotation:**
- `1` - Correct Type
- `2` - Wrong Type  
- `3` - Result Return
- `4` - No Result Return
- `Ctrl+Enter` - Submit & Next

### **Navigation:**
- `Ctrl+N` - Next Task
- `Ctrl+P` - Previous Task
- `←` / `→` - Navigate tasks

### **Image:**
- `Z` - Zoom full-screen
- `ESC` - Close zoom

### **Help:**
- `?` - Show keyboard shortcuts

---

## 📊 **PROGRESS TRACKING:**

### **Session Progress Bar:**
- Hiển thị ở top bar
- Format: `45% (9/20 tasks)`
- Cập nhật real-time sau mỗi submission

### **Motivation:**
- Xem được bao nhiêu task đã hoàn thành
- Track productivity trong session
- Goal-oriented workflow

---

## 🎓 **ANNOTATION GUIDELINES:**

### **1. Meal (Món ăn)**
**Đặc điểm:**
- Đồ ăn đã chế biến
- Cần estimate nutrition (protein, carbs, fat, calories)
- Có thể có nhiều ingredients

**Ví dụ:**
- ✅ Phở bò, cơm gà, bánh mì
- ✅ Salad, pasta, burger
- ❌ Nutrition label (đây là Label, không phải Meal)

### **2. Label (Nhãn dinh dưỡng)**
**Đặc điểm:**
- Bảng thông tin dinh dưỡng trên bao bì
- Có số liệu cụ thể (per 100g, per serving)
- Cần OCR để đọc text

**Ví dụ:**
- ✅ Nutrition Facts table
- ✅ Thông tin dinh dưỡng trên lon/hộp
- ❌ Hình ảnh món ăn thực tế

### **3. Front Label (Nhãn mặt trước)**
**Đặc điểm:**
- Hình ảnh marketing trên bao bì
- Có logo, brand name, claims
- Không có bảng nutrition facts

**Ví dụ:**
- ✅ "High Protein", "Low Fat" claims
- ✅ Product packaging front
- ❌ Back label với nutrition table

### **4. Screenshot**
**Đặc điểm:**
- Screenshot từ app/website
- Có UI elements (buttons, menus)
- Documentation purpose

### **5. Others**
**Đặc điểm:**
- Không thuộc 4 loại trên
- Hình ảnh không liên quan đồ ăn
- Error cases

---

## ✅ **BEST PRACTICES:**

### **1. Focus on Image First**
- Xem kỹ hình ảnh trước khi label
- Zoom in nếu cần xem chi tiết
- Đảm bảo hiểu rõ nội dung

### **2. Use Quick Actions Wisely**
- Chỉ dùng Quick Actions khi **100% chắc chắn**
- Nếu nghi ngờ → dùng Custom Annotation để kiểm tra kỹ

### **3. Always Add Notes for Edge Cases**
- Món ăn unusual: "Thai dish, unclear ingredients"
- Label blur: "Text too small to read"
- Mixed content: "Both meal and label visible"

### **4. Maintain Consistency**
- Cùng 1 loại món → label giống nhau
- Nếu không chắc → hỏi team lead

### **5. Speed vs Accuracy**
- Mục tiêu: **Fast AND accurate**
- Không sacrifice quality để đi nhanh
- Average: 15-20 seconds per task

---

## 🚨 **COMMON MISTAKES TO AVOID:**

### **❌ Mistake 1: Rushing without checking**
**Wrong:** Nhìn nhanh → Click Quick Action
**Right:** Xem kỹ → Verify → Submit

### **❌ Mistake 2: Confusing Meal vs Label**
**Tip:** 
- Có bảng số liệu nutrition → Label
- Hình ảnh món ăn thực tế → Meal

### **❌ Mistake 3: Ignoring AI hints**
**Tip:** Xem AI Analysis (expandable) để tham khảo

### **❌ Mistake 4: Not using hotkeys**
**Tip:** Học hotkeys để tăng tốc x2

---

## 📈 **PRODUCTIVITY TIPS:**

### **1. Session Goals**
- Đặt mục tiêu: 50 tasks/session
- Break after 30 minutes
- Track your speed improvement

### **2. Batch Similar Tasks**
- Label cùng loại task liên tiếp
- Tăng consistency và speed

### **3. Master Hotkeys**
- Week 1: Learn `1,2,3,4`
- Week 2: Master `Ctrl+Enter`, `Ctrl+N`
- Week 3: Use all shortcuts fluently

### **4. Minimize Mouse Usage**
- Keyboard-only workflow = 2x faster
- Mouse chỉ dùng cho zoom và notes

---

## 🎯 **QUALITY METRICS:**

### **Your annotation will be evaluated on:**

1. **Accuracy** (90%+ target)
   - Correct scan type judgement
   - Proper result return assessment

2. **Speed** (15-20s per task)
   - Balance between fast and accurate
   - Use shortcuts to optimize

3. **Consistency** (Check inter-annotator agreement)
   - Similar tasks → similar labels
   - Follow guidelines strictly

4. **Notes Quality**
   - Clear, concise, helpful
   - Add context for edge cases

---

## 🆘 **NEED HELP?**

### **In-App Help:**
- Press `?` to see keyboard shortcuts
- Hover tooltips for field explanations
- Expand "Annotation Guide" in sidebar

### **Common Questions:**

**Q: What if I make a mistake?**
A: Tasks can be re-annotated. Focus on accuracy first.

**Q: What if image doesn't load?**
A: Click refresh or skip task. Report to admin.

**Q: Can I change annotation after submit?**
A: Contact admin if you need to revise.

**Q: How to handle unclear images?**
A: Add detailed notes and mark as uncertain.

---

## 🏆 **BECOMING AN EXPERT ANNOTATOR:**

### **Week 1: Learning**
- Understand 5 types clearly
- Practice with 50+ tasks
- Learn basic hotkeys (1-4)

### **Week 2: Speed Up**
- Target 20s per task
- Master all hotkeys
- Achieve 85% accuracy

### **Week 3: Mastery**
- Target 15s per task
- 95%+ accuracy
- Minimal notes needed
- Help train new annotators

### **Success Metrics:**
- ⭐ Bronze: 50 tasks/day, 80% accuracy
- ⭐⭐ Silver: 100 tasks/day, 90% accuracy  
- ⭐⭐⭐ Gold: 150 tasks/day, 95% accuracy
- 🏆 Platinum: 200+ tasks/day, 98% accuracy

---

## 📞 **SUPPORT:**

**Technical Issues:**
- Email: support@d4t4l4b3lxai.local
- Slack: #annotation-support

**Guidelines Questions:**
- Ask team lead
- Check internal wiki
- Review this guide

---

**Last Updated:** 2025-10-11  
**Version:** 2.0 (Annotator-Focused UI)  
**Feedback:** help@d4t4l4b3lxai.local
