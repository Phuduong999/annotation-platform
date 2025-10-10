# API Import Tests

## Mô tả
Thư mục này chứa các test automation cho API endpoint `/import/jobs` với validation CSV.

## Test Scenarios
- Upload CSV với 3 dòng hợp lệ và 2 dòng lỗi
- Kiểm tra API response trả về:
  - `jobId`: ID của import job
  - `validRows`: 3
  - `invalidRows`: 2
- Download và kiểm tra error CSV:
  - Chứa đúng 2 dòng lỗi
  - Mỗi lỗi có field và message rõ ràng

## Các file test

### 1. test-import-mock.sh
Test giả lập (mock) để demo luồng test khi chưa có services.
```bash
./test-import-mock.sh
```

### 2. test-import-api.sh
Test thực tế với API (cần Docker và API đang chạy).
```bash
# Khởi động services trước
docker-compose up -d
pnpm -F @monorepo/api dev

# Chạy test
./test-import-api.sh
```

### 3. test-import-api.ts
Test TypeScript với axios và form-data.
```bash
# Cài dependencies nếu cần
pnpm add -D form-data axios tsx

# Chạy test
pnpm tsx tests/test-import-api.ts

# Hoặc
./test-import-api.ts
```

## CSV Test Data

### Dữ liệu hợp lệ (3 rows)
1. URL hợp lệ từ placeholder services
2. Category trong enum hợp lệ (category1, category2, category3)
3. Metadata là JSON hợp lệ

### Dữ liệu lỗi (2 rows)
1. **Row 4**: 
   - URL không có protocol (invalid-url-without-protocol)
   - Category không trong enum (INVALID_ENUM_CATEGORY)
   
2. **Row 5**:
   - URL với protocol không hỗ trợ (ftp://)
   - Metadata không phải JSON hợp lệ

## Expected Results

✅ **PASS** khi:
- API trả về `jobId`, `validRows=3`, `invalidRows=2`
- Error CSV download thành công
- Error CSV có ít nhất 2 entries với lỗi rõ ràng
- Mỗi lỗi có field name và error message

❌ **FAIL** khi:
- API không trả về đúng số lượng valid/invalid rows
- Error CSV không chứa đủ lỗi
- Lỗi không có message rõ ràng

## Cách chạy đầy đủ

```bash
# 1. Khởi động Docker
docker-compose up -d

# 2. Khởi động API (terminal 1)
pnpm -F @monorepo/api dev

# 3. Khởi động Worker (terminal 2 - optional)
pnpm -F @monorepo/worker dev

# 4. Chạy test
cd tests
./test-import-api.sh

# Hoặc dùng TypeScript test
pnpm tsx test-import-api.ts
```

## Notes
- Test không yêu cầu tạo project trước
- Worker không bắt buộc cho test cơ bản
- Error CSV có thể chứa nhiều entries cho 1 row nếu row đó có nhiều lỗi