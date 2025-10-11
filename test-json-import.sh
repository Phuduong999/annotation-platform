#!/bin/bash

# Test JSON import endpoint
# Usage: ./test-json-import.sh

API_URL="${API_URL:-http://localhost:3001}"
JSON_FILE="test-import-full.json"

echo "Testing JSON import to $API_URL/import/jobs"
echo "Using file: $JSON_FILE"
echo ""

# Send POST request with JSON body
curl -X POST "$API_URL/import/jobs" \
  -H "Content-Type: application/json" \
  -H "x-import-filename: $JSON_FILE" \
  -d @"$JSON_FILE" \
  -v

echo ""
echo "Import test completed!"
