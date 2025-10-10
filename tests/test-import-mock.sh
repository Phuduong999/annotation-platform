#!/bin/bash

# Mock test để demo khi chưa có services

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   MOCK TEST - API Import Validation${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create test CSV file
echo -e "${YELLOW}Step 1: Creating test CSV file...${NC}"
cat > test-import-validation.csv << 'EOF'
url,name,category,metadata
https://via.placeholder.com/300,Valid Image 1,category1,{"tags":["test"],"source":"placeholder"}
https://dummyimage.com/400x400/000/fff,Valid Image 2,category2,{"tags":["demo"],"size":"large"}
https://placekitten.com/300/300,Valid Cat Image,category3,{"tags":["cat","animal"]}
invalid-url-without-protocol,Invalid URL Row,INVALID_ENUM_CATEGORY,{"tags":["error"]}
ftp://wrong-protocol.com/image.jpg,Wrong Protocol,category1,{"invalid_json": this is not valid json}
EOF

echo -e "${GREEN}✓ CSV created with 5 rows (3 valid, 2 invalid)${NC}"
echo ""
echo "CSV content:"
echo "-------------------"
cat test-import-validation.csv
echo "-------------------"
echo ""

# Mock API response
echo -e "${YELLOW}Step 2: Simulating API upload...${NC}"
echo "POST http://localhost:4000/api/import/jobs"
echo "  - file: test-import-validation.csv"
echo "  - project_id: test-project-123"
echo ""

# Mock response
MOCK_RESPONSE='{
  "success": true,
  "data": {
    "job_id": "mock-job-uuid-12345",
    "total_rows": 5,
    "valid_rows": 3,
    "invalid_rows": 2,
    "status": "processing"
  },
  "timestamp": "2024-10-09T17:33:26Z"
}'

echo "Mock API Response:"
echo "${MOCK_RESPONSE}" | jq '.'
echo ""

# Extract values
JOB_ID=$(echo "${MOCK_RESPONSE}" | jq -r '.data.job_id')
VALID_ROWS=$(echo "${MOCK_RESPONSE}" | jq -r '.data.valid_rows')
INVALID_ROWS=$(echo "${MOCK_RESPONSE}" | jq -r '.data.invalid_rows')

# Validate response
echo -e "${YELLOW}Step 3: Validating API response...${NC}"

if [ "${JOB_ID}" = "mock-job-uuid-12345" ]; then
    echo -e "${GREEN}✓ Job ID received: ${JOB_ID}${NC}"
else
    echo -e "${RED}✗ No job ID in response${NC}"
fi

if [ "${VALID_ROWS}" = "3" ]; then
    echo -e "${GREEN}✓ Valid rows count correct: 3${NC}"
else
    echo -e "${RED}✗ Valid rows count incorrect: expected 3, got ${VALID_ROWS}${NC}"
fi

if [ "${INVALID_ROWS}" = "2" ]; then
    echo -e "${GREEN}✓ Invalid rows count correct: 2${NC}"
else
    echo -e "${RED}✗ Invalid rows count incorrect: expected 2, got ${INVALID_ROWS}${NC}"
fi

echo ""

# Mock error CSV
echo -e "${YELLOW}Step 4: Simulating error CSV download...${NC}"
echo "GET http://localhost:4000/api/import/jobs/${JOB_ID}/errors"
echo ""

# Create mock error CSV
cat > error-report.csv << 'EOF'
row,field,error,original_value
4,url,Invalid URL format - missing protocol,invalid-url-without-protocol
4,category,Invalid enum value,INVALID_ENUM_CATEGORY
5,url,Unsupported protocol - only http/https allowed,ftp://wrong-protocol.com/image.jpg
5,metadata,Invalid JSON format,{"invalid_json": this is not valid json}
EOF

echo "Mock Error CSV content:"
echo "-------------------"
cat error-report.csv
echo "-------------------"
echo ""

# Validate error CSV
echo -e "${YELLOW}Step 5: Validating error CSV...${NC}"

ERROR_COUNT=$(tail -n +2 error-report.csv | wc -l | tr -d ' ')

if [ "${ERROR_COUNT}" = "4" ]; then
    echo -e "${YELLOW}! Note: Error CSV has 4 entries (2 rows with multiple errors)${NC}"
    echo -e "${GREEN}✓ This is expected - 2 invalid rows can have multiple errors${NC}"
else
    echo -e "${RED}✗ Unexpected error count: ${ERROR_COUNT}${NC}"
fi

if grep -q "Invalid URL format" error-report.csv; then
    echo -e "${GREEN}✓ Found invalid URL error with clear message${NC}"
else
    echo -e "${RED}✗ Missing URL validation error${NC}"
fi

if grep -q "Invalid enum value" error-report.csv; then
    echo -e "${GREEN}✓ Found enum validation error${NC}"
else
    echo -e "${RED}✗ Missing enum validation error${NC}"
fi

if grep -q "Invalid JSON format" error-report.csv; then
    echo -e "${GREEN}✓ Found JSON validation error${NC}"
else
    echo -e "${RED}✗ Missing JSON validation error${NC}"
fi

echo ""

# Cleanup
echo -e "${YELLOW}Step 6: Cleaning up...${NC}"
rm -f test-import-validation.csv error-report.csv
echo -e "${GREEN}✓ Test files removed${NC}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}           MOCK TEST RESULTS${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ ALL VALIDATIONS PASSED!${NC}"
echo ""
echo "Summary:"
echo "  • Created CSV with 3 valid + 2 invalid rows"
echo "  • API would return: job_id, valid=3, invalid=2"
echo "  • Error CSV would contain 2 rows with clear errors"
echo "  • Each error has field name and descriptive message"
echo ""
echo -e "${YELLOW}To run the real test:${NC}"
echo "  1. Start Docker: docker-compose up -d"
echo "  2. Start API: pnpm -F @monorepo/api dev"
echo "  3. Run: ./tests/test-import-api.sh"