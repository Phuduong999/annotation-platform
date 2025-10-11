# 🚀 QUICK START - XEM UI MỚI

## ❌ **TẠI SAO BẠN THẤY UI CŨ?**

### **Lý do:**
1. ❌ **Chưa login** với role `annotator` 
2. ❌ Đang xem TaskList (không phải TaskDetail)
3. ❌ Browser cache cũ

---

## ✅ **CÁCH XEM UI MỚI (3 BƯỚC):**

### **BƯỚC 1: Mở browser và login**
```bash
# 1. Mở browser
open http://localhost:3000

# 2. Sẽ redirect to /login
```

**Login page sẽ như này:**
```
┌─────────────────────────────────────┐
│        Welcome Back                 │
│   Sign in to D4T4L4B3lXAI Platform │
│                                     │
│   Username: [user123]      ← GÕ VÀO ĐÂY
│   Password: [user123]      ← GÕ VÀO ĐÂY
│   ☑ Remember me (Dev Mode)          │
│                                     │
│   [Sign In]                         │
│                                     │
│   Dev Mode Credentials:             │
│   • user123 / user123 (Annotator)  ← DÙNG CÁI NÀY!
│   • admin / admin123 (Admin)        │
│   • viewer1 / viewer123 (Viewer)   │
└─────────────────────────────────────┘
```

**QUAN TRỌNG:** 
- Phải login với **user123 / user123** (role: annotator)
- Admin và viewer sẽ thấy UI cũ (full TaskDetail)
- CHỈ annotator role thấy UI mới!

---

### **BƯỚC 2: Vào Task List**
Sau khi login thành công:
```
URL: http://localhost:3000/tasks

Sẽ thấy:
┌─────────────────────────────────────────────────────────┐
│  D4T4L4B3lXAI         [User Avatar: user123] [Logout]  │
├─────────────────────────────────────────────────────────┤
│  Tasks                                                  │
│  ┌────────────────────────────────────────────────┐    │
│  │ [Image] Request ID    Type   Status  ...       │    │
│  │ ────────────────────────────────────────────   │    │
│  │  🖼️     68e7ef59...   meal   pending           │  ← CLICK VÀO ĐÂY
│  │  🖼️     68e7bb19...   meal   pending           │    │
│  │  🖼️     68e7b662...   meal   pending           │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

### **BƯỚC 3: Click vào 1 Task**
Click vào bất kỳ task nào → **UI MỚI SẼ HIỆN RA!**

```
┌───────────────────────────────────────────────────────────────┐
│  [◀] Task: 68e7ef59... [▶]   Progress: 45%  [Zoom] [?]      │
├────────────────────────────────────┬──────────────────────────┤
│                                    │  QUICK ANNOTATION        │
│                                    │  ┌──────────────────┐    │
│                                    │  │ Quick Actions:   │    │
│      🖼️ HÌNH ẢNH TO (70%)         │  │ ✓ Correct       │    │
│                                    │  │ ✗ Wrong         │    │
│      [Click để zoom full-screen]   │  └──────────────────┘    │
│                                    │                          │
│                                    │  Scan Type: *            │
│                                    │  [✓ Correct][✗ Wrong]   │
│                                    │  Press 1 or 2            │
│                                    │                          │
│                                    │  Result Return: *        │
│                                    │  [✓ Return][✗ No Return]│
│                                    │  Press 3 or 4            │
│                                    │                          │
│                                    │  [Submit & Next]         │
│                                    │  Ctrl+Enter              │
└────────────────────────────────────┴──────────────────────────┘
```

**ĐÂY LÀ UI MỚI! ✅**
- Image chiếm 70% màn hình (to rõ ràng)
- Annotation sidebar bên phải (30%)
- Quick actions buttons
- Keyboard shortcuts hiển thị

---

## 🔍 **SO SÁNH UI CŨ VS UI MỚI:**

### **UI CŨ (TaskDetail - cho admin/viewer):**
```
┌──────────────┬──────────────┬──────────────┐
│  IMAGE       │  AI OUTPUT   │  ANNOTATION  │
│  (33%)       │  (33%)       │  (33%)       │
│  Nhỏ ❌      │  JSON dài ❌  │  Form bị chen│
└──────────────┴──────────────┴──────────────┘
```

### **UI MỚI (AnnotatorView - cho annotator):**
```
┌───────────────────────────────┬──────────────┐
│     IMAGE (70%)               │  ANNOTATION  │
│     To rõ ràng ✅             │  (30%)       │
│                               │  Compact ✅   │
└───────────────────────────────┴──────────────┘
```

---

## ❓ **TROUBLESHOOTING:**

### **1. Vẫn thấy UI cũ?**
**Check:**
```bash
# A. Bạn login với user nào?
# Xem góc phải header: Avatar user

# Nếu là "admin" hoặc "viewer1" → Sẽ thấy UI cũ (đúng!)
# Phải logout → login lại với user123
```

### **2. Không thấy Login page?**
```bash
# Logout trước:
# Click vào Avatar → Logout
# Sau đó mở: http://localhost:3000
# Sẽ tự động redirect to /login
```

### **3. TaskList vẫn như cũ?**
```
TaskList KHÔNG thay đổi! (vẫn giống cũ)

Chỉ có TaskDetail (khi click vào task) mới có UI mới!

Workflow:
TaskList (cũ) → Click task → TaskDetail (MỚI!)
```

### **4. Web không load?**
```bash
# Restart web server:
cd /Users/duongthanhphu/monorepo-project/apps/web
npm run dev

# Check: http://localhost:3000
```

---

## 📋 **CHECKLIST:**

Làm theo thứ tự:
- [ ] 1. Mở http://localhost:3000
- [ ] 2. Thấy Login page?
  - ✅ Yes → Go to step 3
  - ❌ No → Click Logout ở header, refresh page
- [ ] 3. Login với **user123 / user123**
- [ ] 4. Check "Remember me"
- [ ] 5. Click [Sign In]
- [ ] 6. Redirect to Tasks page?
  - ✅ Yes → Go to step 7
  - ❌ No → Check console for errors
- [ ] 7. Click vào 1 task bất kỳ (row trong table)
- [ ] 8. Thấy layout mới với image to bên trái + sidebar bên phải?
  - ✅ Yes → **THÀNH CÔNG! 🎉**
  - ❌ No → Check role (phải là annotator)

---

## 🎯 **ĐẶC ĐIỂM UI MỚI:**

Khi thấy UI mới, sẽ có các đặc điểm này:

### **✅ Dấu hiệu nhận biết UI MỚI:**
1. Image chiếm 70% màn hình (bên trái)
2. Sidebar annotation 30% (bên phải)
3. Progress bar ở top (45% - 9/20 tasks)
4. Quick action buttons: "✓ Correct & Complete", "✗ Wrong Type"
5. Segmented controls thay vì dropdown
6. Keyboard shortcuts visible (Press 1, 2, 3, 4...)
7. Buttons ở dưới: [Submit & Next] Ctrl+Enter
8. AI Output collapsed at bottom (click to expand)

### **❌ Dấu hiệu UI CŨ (không phải UI mới):**
1. 3 columns: Image | AI Output | Annotation
2. Mỗi column 33% width
3. Image nhỏ
4. AI Output hiển thị full JSON dài
5. Dropdown controls thay vì segmented
6. Không có quick actions
7. Không có progress bar
8. Không có keyboard shortcuts visible

---

## 💡 **TIPS:**

### **Nếu muốn so sánh 2 UI:**

**1. Test UI MỚI (Annotator):**
```
Login: user123 / user123
→ Click task → Thấy UI mới (70-30 layout)
```

**2. Test UI CŨ (Admin):**
```
Logout → Login: admin / admin123
→ Click task → Thấy UI cũ (33-33-33 layout)
```

**3. So sánh:**
```
UI MỚI:  ████████████████████░░░░  (Image 70%)
UI CŨ:   ████████░░░░████████░░░░  (Image 33%)
```

---

## 📞 **VẪN KHÔNG THẤY?**

Screenshot màn hình của bạn và gửi cho tôi:
1. Login page
2. Tasks list page
3. Task detail page (sau khi click vào task)

Tôi sẽ debug ngay!

---

**Last Updated:** 2025-10-11 16:25  
**Web URL:** http://localhost:3000  
**Test User:** user123 / user123 (annotator role)
