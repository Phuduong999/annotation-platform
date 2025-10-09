#!/bin/bash

echo "Testing CSV Import Endpoint"
echo "============================"
echo ""

# Upload CSV file
echo "1. Uploading test CSV file..."
RESPONSE=$(curl -s -X POST http://localhost:4000/import/jobs \
  -H "x-user-id: test-user" \
  -F "file=@test-import.csv" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  JOB_ID=$(echo "$BODY" | jq -r '.data.jobId' 2>/dev/null)
  
  if [ "$JOB_ID" != "null" ] && [ -n "$JOB_ID" ]; then
    echo "✓ CSV upload successful!"
    echo "  Job ID: $JOB_ID"
    echo "  Total Rows: $(echo "$BODY" | jq -r '.data.totalRows')"
    echo "  Valid Rows: $(echo "$BODY" | jq -r '.data.validRows')"
    echo "  Invalid Rows: $(echo "$BODY" | jq -r '.data.invalidRows')"
    echo ""
    
    # Get job details
    echo "2. Fetching job details..."
    curl -s http://localhost:4000/import/jobs/$JOB_ID | jq '.'
    echo ""
    
    # Download error report
    echo "3. Downloading error report..."
    INVALID_COUNT=$(echo "$BODY" | jq -r '.data.invalidRows')
    if [ "$INVALID_COUNT" -gt "0" ]; then
      curl -s http://localhost:4000/import/jobs/$JOB_ID/errors -o "error_report_$JOB_ID.csv"
      echo "✓ Error report saved to: error_report_$JOB_ID.csv"
      echo ""
      echo "Error report preview:"
      head -20 "error_report_$JOB_ID.csv"
    else
      echo "No errors to report"
    fi
  else
    echo "✗ Failed to extract job ID from response"
  fi
else
  echo "✗ Upload failed with status $HTTP_CODE"
fi

echo ""
echo "============================"
echo "Test completed"
