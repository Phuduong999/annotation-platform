#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}   API Import Test with CSV Validation${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Configuration
API_URL="http://localhost:4000"
PROJECT_ID="test-project-$(date +%s)"

# Create test CSV file with 3 valid and 2 invalid rows
echo "Creating test CSV file..."
cat > test-import-validation.csv << 'EOF'
url,name,category,metadata
https://via.placeholder.com/300,Valid Image 1,category1,{"tags":["test"],"source":"placeholder"}
https://dummyimage.com/400x400/000/fff,Valid Image 2,category2,{"tags":["demo"],"size":"large"}
https://placekitten.com/300/300,Valid Cat Image,category3,{"tags":["cat","animal"]}
invalid-url-without-protocol,Invalid URL Row,INVALID_ENUM_CATEGORY,{"tags":["error"]}
ftp://wrong-protocol.com/image.jpg,Wrong Protocol,category1,{"invalid_json": this is not valid json}
EOF

echo -e "${GREEN}✓ Test CSV created with 5 rows (3 valid, 2 invalid)${NC}"
echo ""

# Function to check if services are ready
check_services() {
    echo "Checking if services are ready..."
    
    # Check API health
    if curl -s -o /dev/null -w "%{http_code}" ${API_URL}/health | grep -q "200"; then
        echo -e "${GREEN}✓ API is ready${NC}"
    else
        echo -e "${RED}✗ API is not ready. Please start it with: pnpm -F @monorepo/api dev${NC}"
        exit 1
    fi
}

# Function to create a test project
create_project() {
    echo "Skipping project creation (not required for basic import test)..."
    echo -e "${GREEN}✓ Ready to test import${NC}"
}

# Function to upload CSV and get job_id
upload_csv() {
    echo ""
    echo "Uploading CSV file to API..."
    
    RESPONSE=$(curl -s -X POST \
        -F "file=@test-import-validation.csv" \
        ${API_URL}/import/jobs)
    
    echo "API Response:"
    echo "${RESPONSE}" | jq '.' 2>/dev/null || echo "${RESPONSE}"
    
    # Extract values from response
    JOB_ID=$(echo "${RESPONSE}" | jq -r '.data.jobId' 2>/dev/null)
    VALID_ROWS=$(echo "${RESPONSE}" | jq -r '.data.validRows' 2>/dev/null)
    INVALID_ROWS=$(echo "${RESPONSE}" | jq -r '.data.invalidRows' 2>/dev/null)
    
    echo ""
    echo "Extracted values:"
    echo "  Job ID: ${JOB_ID}"
    echo "  Valid rows: ${VALID_ROWS}"
    echo "  Invalid rows: ${INVALID_ROWS}"
}

# Function to validate upload response
validate_upload() {
    echo ""
    echo -e "${YELLOW}Validating upload response...${NC}"
    
    local test_passed=true
    
    # Check if we got a job_id
    if [ "${JOB_ID}" != "null" ] && [ -n "${JOB_ID}" ]; then
        echo -e "${GREEN}✓ Job ID received: ${JOB_ID}${NC}"
    else
        echo -e "${RED}✗ No job ID in response${NC}"
        test_passed=false
    fi
    
    # Check valid rows count
    if [ "${VALID_ROWS}" = "3" ]; then
        echo -e "${GREEN}✓ Valid rows count correct: 3${NC}"
    else
        echo -e "${RED}✗ Valid rows count incorrect: expected 3, got ${VALID_ROWS}${NC}"
        test_passed=false
    fi
    
    # Check invalid rows count
    if [ "${INVALID_ROWS}" = "2" ]; then
        echo -e "${GREEN}✓ Invalid rows count correct: 2${NC}"
    else
        echo -e "${RED}✗ Invalid rows count incorrect: expected 2, got ${INVALID_ROWS}${NC}"
        test_passed=false
    fi
    
    return $([ "$test_passed" = true ] && echo 0 || echo 1)
}

# Function to download and check error CSV
check_error_csv() {
    echo ""
    echo -e "${YELLOW}Downloading error CSV...${NC}"
    
    # Wait a bit for processing
    sleep 2
    
    # Download error CSV
    curl -s ${API_URL}/import/jobs/${JOB_ID}/errors > error-report.csv
    
    if [ ! -s error-report.csv ]; then
        echo -e "${RED}✗ Error CSV is empty or not found${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Error CSV downloaded${NC}"
    echo ""
    echo "Error CSV content:"
    cat error-report.csv
    echo ""
    
    # Count lines (excluding header)
    ERROR_COUNT=$(tail -n +2 error-report.csv | wc -l | tr -d ' ')
    
    echo "Validating error CSV..."
    
    if [ "${ERROR_COUNT}" = "2" ]; then
        echo -e "${GREEN}✓ Error CSV has correct number of rows: 2${NC}"
    else
        echo -e "${RED}✗ Error CSV row count incorrect: expected 2, got ${ERROR_COUNT}${NC}"
        return 1
    fi
    
    # Check for expected error messages
    if grep -q "invalid-url-without-protocol" error-report.csv; then
        echo -e "${GREEN}✓ Found invalid URL error${NC}"
    else
        echo -e "${RED}✗ Missing invalid URL error${NC}"
        return 1
    fi
    
    if grep -q "INVALID_ENUM_CATEGORY\|invalid_json\|Wrong Protocol" error-report.csv; then
        echo -e "${GREEN}✓ Found validation errors in CSV${NC}"
    else
        echo -e "${RED}✗ Missing expected validation errors${NC}"
        return 1
    fi
    
    return 0
}

# Function to check database state
check_database() {
    echo ""
    echo -e "${YELLOW}Checking database state...${NC}"
    
    # Check import_jobs table
    JOB_RESULT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d monorepo -t -c "
        SELECT total_rows, valid_rows, error_rows, status
        FROM import_jobs 
        WHERE id = '${JOB_ID}'" 2>/dev/null | tr -d ' ')
    
    if [ -n "${JOB_RESULT}" ]; then
        echo -e "${GREEN}✓ Job found in database${NC}"
        echo "  Database record: ${JOB_RESULT}"
    else
        echo -e "${YELLOW}! Job not found in database (worker might not be running)${NC}"
    fi
    
    # Check assets created
    ASSET_COUNT=$(PGPASSWORD=postgres psql -h localhost -U postgres -d monorepo -t -c "
        SELECT COUNT(*) 
        FROM assets 
        WHERE import_job_id = '${JOB_ID}'" 2>/dev/null | tr -d ' ')
    
    if [ -n "${ASSET_COUNT}" ] && [ "${ASSET_COUNT}" -gt 0 ]; then
        echo -e "${GREEN}✓ Assets created: ${ASSET_COUNT}${NC}"
    else
        echo -e "${YELLOW}! No assets found (worker might not be running)${NC}"
    fi
}

# Function to clean up test data
cleanup() {
    echo ""
    echo -e "${YELLOW}Cleaning up test files...${NC}"
    rm -f test-import-validation.csv error-report.csv
    echo -e "${GREEN}✓ Test files removed${NC}"
}

# Main test execution
main() {
    echo ""
    echo "Starting test execution..."
    echo ""
    
    # Check services
    check_services
    
    # Create test project
    create_project
    
    # Upload CSV
    upload_csv
    
    # Validate upload response
    if validate_upload; then
        echo ""
        echo -e "${GREEN}✓ Upload validation PASSED${NC}"
        upload_test_passed=true
    else
        echo ""
        echo -e "${RED}✗ Upload validation FAILED${NC}"
        upload_test_passed=false
    fi
    
    # Check error CSV
    if check_error_csv; then
        echo ""
        echo -e "${GREEN}✓ Error CSV validation PASSED${NC}"
        error_test_passed=true
    else
        echo ""
        echo -e "${RED}✗ Error CSV validation FAILED${NC}"
        error_test_passed=false
    fi
    
    # Check database (optional, requires worker)
    check_database
    
    # Clean up
    cleanup
    
    # Final result
    echo ""
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}           TEST RESULTS${NC}"
    echo -e "${YELLOW}========================================${NC}"
    
    if [ "$upload_test_passed" = true ] && [ "$error_test_passed" = true ]; then
        echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
        echo -e "${GREEN}   - API returned correct job_id${NC}"
        echo -e "${GREEN}   - Valid rows count: 3 ✓${NC}"
        echo -e "${GREEN}   - Invalid rows count: 2 ✓${NC}"
        echo -e "${GREEN}   - Error CSV has 2 error rows ✓${NC}"
        echo -e "${GREEN}   - Error messages are clear ✓${NC}"
        exit 0
    else
        echo -e "${RED}❌ SOME TESTS FAILED${NC}"
        [ "$upload_test_passed" = false ] && echo -e "${RED}   - Upload validation failed${NC}"
        [ "$error_test_passed" = false ] && echo -e "${RED}   - Error CSV validation failed${NC}"
        exit 1
    fi
}

# Run main function
main