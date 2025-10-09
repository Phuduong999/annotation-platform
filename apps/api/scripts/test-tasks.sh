#!/bin/bash

# Test script for Task API endpoints
# This script tests task creation, assignment, and retrieval

API_URL="http://localhost:4000"
CSV_FILE="../test-data.csv"

echo "🚀 Testing Task API Endpoints"
echo "=============================="

# First, ensure we have an import job
echo -e "\n1️⃣ Creating import job with CSV..."
IMPORT_RESPONSE=$(curl -s -X POST "$API_URL/import/jobs" \
  -F "file=@$CSV_FILE")

JOB_ID=$(echo $IMPORT_RESPONSE | grep -o '"jobId":"[^"]*' | cut -d'"' -f4)

if [ -z "$JOB_ID" ]; then
  echo "❌ Failed to create import job"
  exit 1
fi

echo "✅ Import job created: $JOB_ID"
echo "Response: $IMPORT_RESPONSE"

# Wait a moment for import to complete
sleep 2

# Test task creation from import job
echo -e "\n2️⃣ Creating tasks from import job..."
TASK_CREATE_RESPONSE=$(curl -s -X POST "$API_URL/tasks/create" \
  -H "Content-Type: application/json" \
  -d "{\"jobId\": \"$JOB_ID\"}")

echo "Response: $TASK_CREATE_RESPONSE"

# Test getting task statistics
echo -e "\n3️⃣ Getting task statistics..."
STATS_RESPONSE=$(curl -s -X GET "$API_URL/tasks/stats")
echo "Response: $STATS_RESPONSE"

# Test equal-split assignment
echo -e "\n4️⃣ Testing equal-split assignment..."
ASSIGN_RESPONSE=$(curl -s -X POST "$API_URL/tasks/assign" \
  -H "Content-Type: application/json" \
  -d '{
    "userIds": ["alice", "bob", "charlie"],
    "quotaPerUser": 2
  }')

echo "Response: $ASSIGN_RESPONSE"

# Test getting next task (pull queue)
echo -e "\n5️⃣ Testing pull queue (getting next task for user 'david')..."
NEXT_TASK_RESPONSE=$(curl -s -X GET "$API_URL/tasks/next?user_id=david")
echo "Response: $NEXT_TASK_RESPONSE"

# Test getting user tasks
echo -e "\n6️⃣ Getting tasks for user 'alice'..."
USER_TASKS_RESPONSE=$(curl -s -X GET "$API_URL/tasks/user/alice")
echo "Response: $USER_TASKS_RESPONSE"

# Test getting assignment logs
echo -e "\n7️⃣ Getting assignment logs..."
LOGS_RESPONSE=$(curl -s -X GET "$API_URL/tasks/assignments?limit=10")
echo "Response: $LOGS_RESPONSE"

# Test getting assignment logs with filters
echo -e "\n8️⃣ Getting assignment logs for equal_split method..."
FILTERED_LOGS=$(curl -s -X GET "$API_URL/tasks/assignments?method=equal_split&limit=5")
echo "Response: $FILTERED_LOGS"

# Final statistics
echo -e "\n9️⃣ Final task statistics..."
FINAL_STATS=$(curl -s -X GET "$API_URL/tasks/stats")
echo "Response: $FINAL_STATS"

echo -e "\n✅ Task API tests completed!"
echo "=============================="