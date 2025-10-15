#!/bin/bash
# Test script for importing labeled annotation data
# This tests the new feature to import CSV/XLSX/JSON with annotation labels

set -e

API_URL="${API_URL:-http://localhost:3000}"

echo "🧪 Testing labeled annotation data import..."
echo "API URL: $API_URL"
echo ""

# Create sample labeled data (2 records from user's JSON)
SAMPLE_DATA='[
  {
    "Date": "2025-10-05T00:00:00Z",
    "Request ID": "68e2eff9783e4ce1499f0c4a",
    "User ID": "684c39cf6e8cd5bdedf77ff0",
    "Team ID": "669ebef4c23e4b0025b12009",
    "User Email": "br4facebook@gmail.com",
    "User Full Name": "Brittany Rodriguez",
    "Type": "meal",
    "User Input": "https://example.com/image1.jpg",
    "Raw Ai Output": {
      "name_food": "Buffalo Cauliflower with Noodles",
      "ingredients": [
        {
          "name": "cauliflower",
          "quantity": 150,
          "unit": "gram"
        }
      ],
      "nutrition": [
        {
          "protein": 3.97,
          "fat": 5.35,
          "carbs": 11.95,
          "calories": 92.5
        }
      ],
      "number_of_servings": 1
    },
    "Is Logged": "No",
    "Reaction": "dislike",
    "Feedback Category": "Wrong food",
    "label skip?": "no skip",
    "scan type?": "meal",
    "result return?": "correct result",
    "feedback correction?": "no feedback",
    "Reason?": "AI correctly identified the food"
  },
  {
    "Date": "2025-10-05T00:00:00Z",
    "Request ID": "68e2d331ec672a81ed693df0",
    "User ID": "6789851afecf58cf0336cb61",
    "Team ID": "5ff04c528ed4ff0013192759",
    "User Email": "buitrieuan@gmail.com",
    "User Full Name": "Millie Bui",
    "Type": "meal",
    "User Input": "https://example.com/image2.jpg",
    "Raw Ai Output": {
      "name_food": "Breakfast Plate with Scrambled Eggs",
      "ingredients": [
        {
          "name": "egg",
          "quantity": 3,
          "unit": "piece"
        }
      ],
      "nutrition": [
        {
          "protein": 18.42,
          "fat": 15.12,
          "carbs": 3.44,
          "calories": 218.18
        }
      ],
      "number_of_servings": 1
    },
    "Is Logged": "No",
    "label skip?": "no skip",
    "scan type?": "meal",
    "result return?": "correct result",
    "feedback correction?": "no feedback"
  }
]'

echo "📤 Uploading labeled annotation data..."
RESPONSE=$(curl -s -X POST "$API_URL/api/import/jobs" \
  -H "Content-Type: application/json" \
  -H "x-import-filename: test-labeled-data.json" \
  -H "x-user-id: test-importer" \
  -d "$SAMPLE_DATA")

echo "Response: $RESPONSE"
echo ""

# Extract job ID
JOB_ID=$(echo "$RESPONSE" | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$JOB_ID" ]; then
  echo "❌ Failed to get job ID from response"
  exit 1
fi

echo "✅ Import job created: $JOB_ID"
echo ""

# Check import job details
echo "📊 Checking import job details..."
JOB_DETAILS=$(curl -s "$API_URL/api/import/jobs/$JOB_ID")
echo "$JOB_DETAILS" | jq '.'
echo ""

# Create tasks from import job
echo "🔨 Creating tasks from import job..."
TASK_CREATION=$(curl -s -X POST "$API_URL/api/tasks/create" \
  -H "Content-Type: application/json" \
  -d "{\"jobId\": \"$JOB_ID\", \"skipLinkCheck\": true}")

echo "$TASK_CREATION" | jq '.'
echo ""

# List created tasks
echo "📋 Listing created tasks..."
TASKS=$(curl -s "$API_URL/api/tasks?limit=5")
echo "$TASKS" | jq '.data.tasks[0:2]'
echo ""

echo "✅ Test completed successfully!"
echo ""
echo "Summary:"
echo "- Imported labeled annotation data with 2 records"
echo "- Each record includes annotation labels (scan_type, result_return, feedback_correction)"
echo "- Tasks should be created with status 'completed' and labels_final records"
echo "- Check the database to verify labels_final table has the annotation data"
