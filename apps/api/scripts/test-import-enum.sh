#!/bin/bash

# Test script for Import API with new ScanTypeEnum enforcement
# Tests that only ['meal','label','front_label','screenshot','others'] are accepted

API_URL="http://localhost:4000"
TEST_CSV="./test-data-new-enum.csv"

echo "🧪 Testing Import API with New ScanTypeEnum (Option 1 Strategy)"
echo "================================================================="
echo "Testing that type field only accepts: ['meal','label','front_label','screenshot','others']"
echo "NOTE: Import only creates import_rows - tasks created separately via /tasks/create"
echo ""

# Test with valid and invalid enum values
echo "1️⃣ Testing CSV with mixed valid and invalid enum values..."
echo "Expected: 5 valid rows (meal,label,front_label,screenshot,others)"
echo "Expected: 1 invalid row (invalid_type)"

if [ ! -f "$TEST_CSV" ]; then
  echo "❌ Test CSV file not found: $TEST_CSV"
  exit 1
fi

echo "📂 CSV content:"
cat "$TEST_CSV"
echo ""

echo "📡 Making POST request to /import/jobs..."
RESPONSE=$(curl -s -X POST "$API_URL/import/jobs" \
  -F "file=@$TEST_CSV")

echo "📋 Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Parse response
SUCCESS=$(echo "$RESPONSE" | grep -o '"success":[^,]*' | cut -d':' -f2)
VALID_ROWS=$(echo "$RESPONSE" | grep -o '"validRows":[0-9]*' | cut -d':' -f2)
INVALID_ROWS=$(echo "$RESPONSE" | grep -o '"invalidRows":[0-9]*' | cut -d':' -f2)
TOTAL_ROWS=$(echo "$RESPONSE" | grep -o '"totalRows":[0-9]*' | cut -d':' -f2)
JOB_ID=$(echo "$RESPONSE" | grep -o '"jobId":"[^"]*' | cut -d'"' -f4)

echo "📊 Results Summary:"
echo "   Success: $SUCCESS"
echo "   Total Rows: $TOTAL_ROWS"
echo "   Valid Rows: $VALID_ROWS"
echo "   Invalid Rows: $INVALID_ROWS"
echo "   Job ID: $JOB_ID"
echo ""

# Validate results
if [ "$SUCCESS" = "true" ] && [ "$VALID_ROWS" = "5" ] && [ "$INVALID_ROWS" = "1" ]; then
  echo "✅ PASS: Enum validation working correctly!"
  echo "   - Accepted valid types: meal, label, front_label, screenshot, others"
  echo "   - Rejected invalid type: invalid_type"
else
  echo "❌ FAIL: Unexpected results"
  echo "   Expected: 5 valid, 1 invalid"
  echo "   Got: $VALID_ROWS valid, $INVALID_ROWS invalid"
fi

# If we have a job ID, get the error report
if [ ! -z "$JOB_ID" ] && [ "$INVALID_ROWS" -gt "0" ]; then
  echo ""
  echo "2️⃣ Fetching error report for invalid rows..."
  ERROR_REPORT=$(curl -s -X GET "$API_URL/import/jobs/$JOB_ID/errors")
  
  echo "📋 Error Report:"
  echo "$ERROR_REPORT"
  echo ""
  
  # Check if error report contains our expected invalid type
  if echo "$ERROR_REPORT" | grep -q "invalid_type"; then
    echo "✅ PASS: Error report correctly identifies 'invalid_type' as invalid"
  else
    echo "❌ FAIL: Error report does not mention 'invalid_type'"
  fi
fi

# Test the task creation workflow
if [ "$SUCCESS" = "true" ] && [ ! -z "$JOB_ID" ] && [ "$VALID_ROWS" -gt "0" ]; then
  echo ""
  echo "3️⃣ Testing task creation workflow (Option 1 Strategy)..."
  echo "Creating tasks from import job (only for valid rows with good assets)..."
  
  TASK_RESPONSE=$(curl -s -X POST "$API_URL/tasks/create" \
    -H "Content-Type: application/json" \
    -d "{\"jobId\": \"$JOB_ID\"}")
  
  echo "📋 Task Creation Response:"
  echo "$TASK_RESPONSE" | jq '.' 2>/dev/null || echo "$TASK_RESPONSE"
  echo ""
  
  TASKS_CREATED=$(echo "$TASK_RESPONSE" | grep -o '"tasksCreated":[0-9]*' | cut -d':' -f2)
  TASKS_SKIPPED=$(echo "$TASK_RESPONSE" | grep -o '"tasksSkipped":[0-9]*' | cut -d':' -f2)
  
  echo "📊 Task Creation Results:"
  echo "   Tasks Created: $TASKS_CREATED"
  echo "   Tasks Skipped: $TASKS_SKIPPED"
  
  if [ "$TASKS_CREATED" = "0" ]; then
    echo "⚠️  WARNING: No tasks created (expected since no asset validation in this test)"
    echo "   Tasks would be created only for rows with link_status='ok'"
  else
    echo "✅ PASS: Tasks created successfully from valid import rows"
  fi
fi

echo ""
echo "🏁 Import enum validation and task creation test completed!"
echo "============================================================"
