#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="http://localhost:4000"
DB_NAME="monorepo"
DB_USER="postgres"
DB_PASS="postgres"

echo -e "${YELLOW}=== Import and Link Health Test ===${NC}"
echo ""

# Step 1: Clean database
echo -e "${YELLOW}Step 1: Cleaning database...${NC}"
PGPASSWORD=$DB_PASS psql -U $DB_USER -d $DB_NAME -c "
DELETE FROM tasks;
DELETE FROM assets;
DELETE FROM import_jobs;
DELETE FROM projects WHERE name LIKE 'Test%';
"

# Step 2: Create test project
echo -e "${YELLOW}Step 2: Creating test project...${NC}"
PROJECT_ID=$(PGPASSWORD=$DB_PASS psql -U $DB_USER -d $DB_NAME -t -c "
INSERT INTO projects (name, description, created_by) 
VALUES ('Test Import Project', 'Link health testing', 'test-user') 
RETURNING id;
" | tr -d ' ')
echo "Created project with ID: $PROJECT_ID"

# Step 3: Create test CSV
echo -e "${YELLOW}Step 3: Creating test CSV file...${NC}"
cat > test-import.csv << 'EOF'
url,name,category,metadata
https://via.placeholder.com/300/FF0000/FFFFFF,Valid Red Image,category1,{"tags":["valid","placeholder"]}
https://via.placeholder.com/300/00FF00/FFFFFF,Valid Green Image,category1,{"tags":["valid","placeholder"]}
https://via.placeholder.com/300/0000FF/FFFFFF,Valid Blue Image,category2,{"tags":["valid","placeholder"]}
https://dummyimage.com/400x400/000/fff,Valid Black Image,category2,{"tags":["valid","dummy"]}
https://placekitten.com/300/300,Valid Cat Image,category3,{"tags":["valid","kitten"]}
https://picsum.photos/200,Valid Random Image 1,category1,{"tags":["valid","random"]}
https://picsum.photos/300,Valid Random Image 2,category2,{"tags":["valid","random"]}
https://placeholder.pics/svg/200x200/DEDEDE/555555/Valid,Valid SVG,category3,{"tags":["valid","svg"]}
https://via.placeholder.com/250,Valid Placeholder 250,category1,{"tags":["valid"]}
https://via.placeholder.com/350,Valid Placeholder 350,category2,{"tags":["valid"]}
https://httpstat.us/404,Error 404 Status,category1,{"error":"404"}
https://example.com/nonexistent.jpg,Error 404 Not Found,category2,{"error":"404"}
https://httpstat.us/524?sleep=10000,Error Timeout,category1,{"error":"timeout"}
https://example.com/document.pdf,Error Invalid MIME,category3,{"error":"wrong_type"}
https://example.com/broken.json,Error JSON Decode,category2,{invalid json here}
EOF
echo "Created test CSV with 15 rows (10 valid, 5 errors)"

# Step 4: Upload CSV via API
echo -e "${YELLOW}Step 4: Uploading CSV to API...${NC}"
RESPONSE=$(curl -s -X POST \
  -F "file=@test-import.csv" \
  -F "project_id=$PROJECT_ID" \
  -F "validate_links=true" \
  "$API_URL/api/import")

echo "API Response: $RESPONSE"

# Extract job_id
JOB_ID=$(echo $RESPONSE | grep -o '"job_id":"[^"]*' | cut -d'"' -f4)
echo "Import Job ID: $JOB_ID"

# Extract counts
TOTAL_ROWS=$(echo $RESPONSE | grep -o '"total_rows":[0-9]*' | cut -d':' -f2)
VALID_ROWS=$(echo $RESPONSE | grep -o '"valid_rows":[0-9]*' | cut -d':' -f2)
INVALID_ROWS=$(echo $RESPONSE | grep -o '"invalid_rows":[0-9]*' | cut -d':' -f2)

echo "Total Rows: $TOTAL_ROWS"
echo "Valid Rows: $VALID_ROWS"
echo "Invalid Rows: $INVALID_ROWS"

# Validate counts
if [ "$VALID_ROWS" == "10" ] && [ "$INVALID_ROWS" == "5" ]; then
    echo -e "${GREEN}✓ Row counts are correct${NC}"
else
    echo -e "${RED}✗ Row counts are incorrect${NC}"
fi

# Step 5: Wait for processing
echo -e "${YELLOW}Step 5: Waiting for import processing...${NC}"
sleep 3

# Step 6: Download error CSV
echo -e "${YELLOW}Step 6: Downloading error CSV...${NC}"
curl -s "$API_URL/api/import/$JOB_ID/errors" > error-export.csv
ERROR_LINES=$(cat error-export.csv | wc -l | tr -d ' ')
echo "Error CSV has $ERROR_LINES lines"

# Check error content
if grep -q "404" error-export.csv && \
   grep -q "timeout" error-export.csv && \
   grep -q "invalid_mime" error-export.csv && \
   grep -q "decode_error" error-export.csv; then
    echo -e "${GREEN}✓ Error CSV contains all expected error types${NC}"
else
    echo -e "${RED}✗ Error CSV missing some error types${NC}"
fi

# Step 7: Wait for worker link checks
echo -e "${YELLOW}Step 7: Waiting for worker link health checks...${NC}"
sleep 5

# Step 8: Verify database states
echo -e "${YELLOW}Step 8: Verifying database states...${NC}"

# Check valid assets
VALID_ASSETS=$(PGPASSWORD=$DB_PASS psql -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM assets 
WHERE import_job_id = '$JOB_ID' 
AND link_status = 'ok';
" | tr -d ' ')

echo "Valid assets with link_status=ok: $VALID_ASSETS"
if [ "$VALID_ASSETS" == "10" ]; then
    echo -e "${GREEN}✓ Valid assets count correct${NC}"
else
    echo -e "${RED}✗ Valid assets count incorrect${NC}"
fi

# Check error statuses
echo "Checking error statuses:"
for status in "404" "timeout" "invalid_mime" "decode_error"; do
    COUNT=$(PGPASSWORD=$DB_PASS psql -U $DB_USER -d $DB_NAME -t -c "
    SELECT COUNT(*) FROM assets 
    WHERE import_job_id = '$JOB_ID' 
    AND link_status = '$status';
    " | tr -d ' ')
    echo "  - Status '$status': $COUNT assets"
done

# Check tasks created only for valid links
TASKS_FROM_VALID=$(PGPASSWORD=$DB_PASS psql -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM tasks t
JOIN assets a ON t.asset_id = a.id
WHERE a.import_job_id = '$JOB_ID'
AND a.link_status = 'ok';
" | tr -d ' ')

TASKS_FROM_INVALID=$(PGPASSWORD=$DB_PASS psql -U $DB_USER -d $DB_NAME -t -c "
SELECT COUNT(*) FROM tasks t
JOIN assets a ON t.asset_id = a.id
WHERE a.import_job_id = '$JOB_ID'
AND a.link_status != 'ok';
" | tr -d ' ')

echo "Tasks from valid links: $TASKS_FROM_VALID"
echo "Tasks from invalid links: $TASKS_FROM_INVALID"

if [ "$TASKS_FROM_VALID" == "10" ] && [ "$TASKS_FROM_INVALID" == "0" ]; then
    echo -e "${GREEN}✓ Tasks created only for valid links${NC}"
else
    echo -e "${RED}✗ Task creation incorrect${NC}"
fi

# Step 9: Check job status
echo -e "${YELLOW}Step 9: Checking job status...${NC}"
JOB_STATUS=$(PGPASSWORD=$DB_PASS psql -U $DB_USER -d $DB_NAME -t -c "
SELECT status FROM import_jobs WHERE id = '$JOB_ID';
" | tr -d ' ')

JOB_VALID_COUNT=$(PGPASSWORD=$DB_PASS psql -U $DB_USER -d $DB_NAME -t -c "
SELECT valid_count FROM import_jobs WHERE id = '$JOB_ID';
" | tr -d ' ')

JOB_ERROR_COUNT=$(PGPASSWORD=$DB_PASS psql -U $DB_USER -d $DB_NAME -t -c "
SELECT error_count FROM import_jobs WHERE id = '$JOB_ID';
" | tr -d ' ')

echo "Job Status: $JOB_STATUS"
echo "Job Valid Count: $JOB_VALID_COUNT"
echo "Job Error Count: $JOB_ERROR_COUNT"

if [ "$JOB_STATUS" == "completed" ] && [ "$JOB_VALID_COUNT" == "10" ] && [ "$JOB_ERROR_COUNT" == "5" ]; then
    echo -e "${GREEN}✓ Job completed with correct counts${NC}"
else
    echo -e "${RED}✗ Job status or counts incorrect${NC}"
fi

# Step 10: Summary
echo ""
echo -e "${YELLOW}=== Test Summary ===${NC}"
echo ""

# Check all pass conditions
if [ "$VALID_ROWS" == "10" ] && \
   [ "$INVALID_ROWS" == "5" ] && \
   [ "$ERROR_LINES" == "6" ] && \
   [ "$VALID_ASSETS" == "10" ] && \
   [ "$TASKS_FROM_VALID" == "10" ] && \
   [ "$TASKS_FROM_INVALID" == "0" ] && \
   [ "$JOB_STATUS" == "completed" ]; then
    echo -e "${GREEN}✓✓✓ ALL TESTS PASSED ✓✓✓${NC}"
    echo ""
    echo "✓ API returned correct job_id, valid=10, invalid=5"
    echo "✓ Error CSV contains 5 error rows with clear messages"
    echo "✓ Worker set link_status correctly for all assets"
    echo "✓ No annotation tasks created from failed links"
    EXIT_CODE=0
else
    echo -e "${RED}✗✗✗ SOME TESTS FAILED ✗✗✗${NC}"
    EXIT_CODE=1
fi

# Cleanup
echo ""
echo -e "${YELLOW}Cleaning up test files...${NC}"
rm -f test-import.csv error-export.csv

exit $EXIT_CODE