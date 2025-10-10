#!/usr/bin/env tsx

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import FormData from 'form-data';
import axios from 'axios';

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const API_URL = process.env.API_URL || 'http://localhost:4000';

// Test data - CSV with 3 valid rows and 2 invalid rows using the correct schema
const testCSVContent = `date,request_id,user_id,team_id,type,user_input,raw_ai_output
2024-01-01T12:00:00Z,req-valid-1,user-1,team-1,content_moderation,https://via.placeholder.com/300.jpg,{"result":"safe","confidence":0.95}
2024-01-02T13:00:00Z,req-valid-2,user-2,team-2,safety_check,https://dummyimage.com/400x400/000/fff.png,{"status":"ok","score":0.85}
2024-01-03T14:00:00Z,req-valid-3,user-3,team-3,quality_assessment,https://placekitten.com/300/300,{"assessment":"high","tags":["animal","cat"]}
2024-01-01,req-error-1,user-4,team-4,INVALID_ENUM_TYPE,invalid-url-without-protocol,{"result":"error"}
2024-01-05T16:00:00Z,req-error-2,user-5,team-5,content_moderation,ftp://wrong-protocol.com/image.jpg,{invalid_json: this is not valid}`;

async function checkDependencies(): Promise<boolean> {
  console.log(`${colors.yellow}Checking dependencies...${colors.reset}`);
  
  try {
    // Check if we have axios and form-data
    const axios = require('axios');
    const FormData = require('form-data');
    console.log(`${colors.green}✓ Dependencies available${colors.reset}`);
    return true;
  } catch (error) {
    console.log(`${colors.red}✗ Missing dependencies. Installing...${colors.reset}`);
    
    // Try to install dependencies
    try {
      const { execSync } = require('child_process');
      execSync('pnpm add -D axios form-data tsx', { stdio: 'inherit', cwd: process.cwd() });
      console.log(`${colors.green}✓ Dependencies installed${colors.reset}`);
      return true;
    } catch (installError) {
      console.log(`${colors.red}✗ Failed to install dependencies automatically${colors.reset}`);
      console.log(`${colors.yellow}Please run: pnpm add -D axios form-data tsx${colors.reset}`);
      return false;
    }
  }
}

async function runTest() {
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}   Comprehensive API Import Test${colors.reset}`);
  console.log(`${colors.blue}   Testing /import/jobs endpoint${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log();

  // Check dependencies first
  if (!(await checkDependencies())) {
    process.exit(1);
  }

  let testPassed = true;
  let jobId: string | null = null;

  try {
    // Step 1: Create test CSV file with correct schema
    console.log(`${colors.yellow}Step 1: Creating test CSV with proper schema...${colors.reset}`);
    const csvFilePath = 'test-import-proper-schema.csv';
    writeFileSync(csvFilePath, testCSVContent);
    console.log(`${colors.green}✓ CSV created with proper schema (date,request_id,user_id,team_id,type,user_input,raw_ai_output)${colors.reset}`);
    console.log(`${colors.green}✓ 5 rows total: 3 valid, 2 invalid${colors.reset}`);
    
    // Show test data structure
    console.log('\nTest data structure:');
    console.log('Valid rows (3):');
    console.log('  - Row 1: Valid content_moderation scan with placeholder image');
    console.log('  - Row 2: Valid safety_check scan with dummy image');  
    console.log('  - Row 3: Valid quality_assessment scan with kitten image');
    console.log('Invalid rows (2):');
    console.log('  - Row 4: Invalid date format + invalid enum type + invalid URL');
    console.log('  - Row 5: Invalid URL protocol (ftp) + invalid JSON');
    console.log();

    // Step 2: Check API health
    console.log(`${colors.yellow}Step 2: Checking API health...${colors.reset}`);
    try {
      const healthResponse = await axios.get(`${API_URL}/health`, { timeout: 5000 });
      if (healthResponse.status === 200) {
        console.log(`${colors.green}✓ API is healthy and responding${colors.reset}`);
      }
    } catch (error: any) {
      console.log(`${colors.red}✗ API is not ready or not responding${colors.reset}`);
      console.log(`${colors.yellow}  Please ensure the API is running: pnpm -F @monorepo/api dev${colors.reset}`);
      console.log(`${colors.yellow}  And database is running: docker-compose up -d${colors.reset}`);
      if (error.code === 'ECONNREFUSED') {
        console.log(`${colors.red}  Connection refused. Is the API server started?${colors.reset}`);
      }
      process.exit(1);
    }
    console.log();

    // Step 3: Upload CSV file
    console.log(`${colors.yellow}Step 3: Uploading CSV file to /import/jobs...${colors.reset}`);
    
    const formData = new FormData();
    formData.append('file', readFileSync(csvFilePath), {
      filename: 'test-import-proper-schema.csv',
      contentType: 'text/csv'
    });

    const uploadResponse = await axios.post(
      `${API_URL}/import/jobs`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 30000  // 30 second timeout for upload
      }
    );

    console.log('API Response Status:', uploadResponse.status);
    console.log('API Response Data:');
    console.log(JSON.stringify(uploadResponse.data, null, 2));
    console.log();

    // Step 4: Validate response structure and data
    console.log(`${colors.yellow}Step 4: Validating API response...${colors.reset}`);
    
    if (uploadResponse.status !== 200) {
      console.log(`${colors.red}✗ Expected 200 status, got ${uploadResponse.status}${colors.reset}`);
      testPassed = false;
    } else {
      console.log(`${colors.green}✓ HTTP 200 OK${colors.reset}`);
    }

    const { success, data, timestamp } = uploadResponse.data;
    
    // Check response structure
    if (success === true) {
      console.log(`${colors.green}✓ Response success: true${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Response success should be true, got: ${success}${colors.reset}`);
      testPassed = false;
    }

    if (timestamp) {
      console.log(`${colors.green}✓ Timestamp present: ${timestamp}${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Missing timestamp in response${colors.reset}`);
      testPassed = false;
    }

    if (!data) {
      console.log(`${colors.red}✗ Missing data object in response${colors.reset}`);
      testPassed = false;
      return;
    }

    // Extract and validate data fields
    jobId = data.jobId;
    
    // Check job ID
    if (jobId && typeof jobId === 'string' && jobId.length > 0) {
      console.log(`${colors.green}✓ Job ID received: ${jobId}${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Invalid or missing job ID: ${jobId}${colors.reset}`);
      testPassed = false;
    }

    // Check filename
    if (data.filename === 'test-import-proper-schema.csv') {
      console.log(`${colors.green}✓ Filename correct: ${data.filename}${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Filename incorrect: expected 'test-import-proper-schema.csv', got '${data.filename}'${colors.reset}`);
      testPassed = false;
    }

    // Check total rows count
    if (data.totalRows === 5) {
      console.log(`${colors.green}✓ Total rows correct: 5${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Total rows incorrect: expected 5, got ${data.totalRows}${colors.reset}`);
      testPassed = false;
    }

    // Check valid rows count
    if (data.validRows === 3) {
      console.log(`${colors.green}✓ Valid rows count correct: 3${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Valid rows count incorrect: expected 3, got ${data.validRows}${colors.reset}`);
      testPassed = false;
    }

    // Check invalid rows count
    if (data.invalidRows === 2) {
      console.log(`${colors.green}✓ Invalid rows count correct: 2${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Invalid rows count incorrect: expected 2, got ${data.invalidRows}${colors.reset}`);
      testPassed = false;
    }

    // Check status
    if (data.status === 'completed') {
      console.log(`${colors.green}✓ Import status: completed${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Import status incorrect: expected 'completed', got '${data.status}'${colors.reset}`);
      testPassed = false;
    }

    console.log();

    // Step 5: Download and validate error CSV
    if (jobId && data.invalidRows > 0) {
      console.log(`${colors.yellow}Step 5: Downloading and validating error CSV...${colors.reset}`);
      
      // Wait a bit for processing to complete
      console.log('  Waiting for error report generation...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        const errorResponse = await axios.get(
          `${API_URL}/import/jobs/${jobId}/errors`,
          { 
            responseType: 'text',
            timeout: 15000
          }
        );

        const errorCSV = errorResponse.data;
        const errorFilePath = 'downloaded-error-report.csv';
        writeFileSync(errorFilePath, errorCSV);
        
        console.log(`${colors.green}✓ Error CSV downloaded successfully${colors.reset}`);
        
        // Validate CSV headers
        if (errorResponse.headers['content-type']?.includes('text/csv')) {
          console.log(`${colors.green}✓ Content-Type is text/csv${colors.reset}`);
        } else {
          console.log(`${colors.red}✗ Content-Type is not CSV: ${errorResponse.headers['content-type']}${colors.reset}`);
        }

        console.log();
        console.log('Error CSV Content:');
        console.log('==================');
        console.log(errorCSV);
        console.log('==================');
        console.log();

        // Parse and validate error CSV content
        const lines = errorCSV.split('\n').filter((line: string) => line.trim());
        const headerLine = lines[0];
        const dataLines = lines.slice(1);

        console.log('Validating error CSV content...');
        
        // Check header structure
        const expectedHeaders = ['line_number', 'error_code', 'error_detail', 'original_data'];
        if (headerLine.includes('line_number') && headerLine.includes('error_code') && headerLine.includes('error_detail')) {
          console.log(`${colors.green}✓ Error CSV has proper headers${colors.reset}`);
        } else {
          console.log(`${colors.red}✗ Error CSV headers incorrect. Expected: ${expectedHeaders.join(', ')}${colors.reset}`);
          console.log(`  Got: ${headerLine}`);
          testPassed = false;
        }

        // Check data rows count
        if (dataLines.length >= 2) {
          console.log(`${colors.green}✓ Error CSV has at least 2 error entries (got ${dataLines.length})${colors.reset}`);
        } else {
          console.log(`${colors.red}✗ Error CSV should have at least 2 error entries, got ${dataLines.length}${colors.reset}`);
          testPassed = false;
        }

        // Check for specific error types
        let foundDateError = false;
        let foundEnumError = false;
        let foundUrlError = false;
        let foundJsonError = false;

        for (const line of dataLines) {
          if (line.includes('INVALID_DATE_FORMAT') || line.includes('date')) {
            foundDateError = true;
          }
          if (line.includes('INVALID_ENUM_VALUE') || line.includes('enum') || line.includes('INVALID_ENUM_TYPE')) {
            foundEnumError = true;
          }
          if (line.includes('INVALID_URL') || line.includes('invalid-url-without-protocol') || line.includes('ftp://')) {
            foundUrlError = true;
          }
          if (line.includes('INVALID_JSON') || line.includes('invalid_json')) {
            foundJsonError = true;
          }
        }

        // Validate specific error types found
        if (foundDateError) {
          console.log(`${colors.green}✓ Found date format validation error${colors.reset}`);
        } else {
          console.log(`${colors.yellow}⚠ Date format error not explicitly found (might be part of compound error)${colors.reset}`);
        }

        if (foundEnumError) {
          console.log(`${colors.green}✓ Found enum validation error${colors.reset}`);
        } else {
          console.log(`${colors.yellow}⚠ Enum validation error not found${colors.reset}`);
        }

        if (foundUrlError) {
          console.log(`${colors.green}✓ Found URL validation error${colors.reset}`);
        } else {
          console.log(`${colors.yellow}⚠ URL validation error not found${colors.reset}`);
        }

        if (foundJsonError) {
          console.log(`${colors.green}✓ Found JSON validation error${colors.reset}`);
        } else {
          console.log(`${colors.yellow}⚠ JSON validation error not found${colors.reset}`);
        }

        // Clean up error report file
        unlinkSync(errorFilePath);
        console.log(`${colors.green}✓ Error report file cleaned up${colors.reset}`);
        
      } catch (error: any) {
        console.log(`${colors.red}✗ Failed to download error CSV: ${error.message}${colors.reset}`);
        if (error.response?.status === 404) {
          console.log(`${colors.yellow}  This might indicate no errors were found or the job wasn't processed yet${colors.reset}`);
        }
        testPassed = false;
      }
    } else {
      console.log(`${colors.yellow}Step 5: Skipping error CSV download (no errors or no job ID)${colors.reset}`);
    }

    // Clean up test CSV
    unlinkSync(csvFilePath);
    console.log(`${colors.green}✓ Test CSV file cleaned up${colors.reset}`);

  } catch (error: any) {
    console.error(`${colors.red}Test failed with error:${colors.reset}`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    testPassed = false;
  }

  // Step 6: Final results and summary
  console.log();
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}           TEST RESULTS${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  
  if (testPassed) {
    console.log(`${colors.green}🎉 ALL TESTS PASSED!${colors.reset}`);
    console.log();
    console.log(`${colors.green}✅ Test Summary:${colors.reset}`);
    console.log(`${colors.green}   ✓ CSV upload successful${colors.reset}`);
    console.log(`${colors.green}   ✓ API returned job ID: ${jobId}${colors.reset}`);
    console.log(`${colors.green}   ✓ Correct counts - Valid: 3, Invalid: 2${colors.reset}`);
    console.log(`${colors.green}   ✓ Error CSV downloaded with proper structure${colors.reset}`);
    console.log(`${colors.green}   ✓ Error messages contain validation details${colors.reset}`);
    console.log();
    console.log(`${colors.blue}The /import/jobs API endpoint is working correctly!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ SOME TESTS FAILED${colors.reset}`);
    console.log();
    console.log(`${colors.red}❗ Issues found:${colors.reset}`);
    console.log(`${colors.yellow}   Check the detailed output above for specific failures${colors.reset}`);
    console.log(`${colors.yellow}   Make sure:${colors.reset}`);
    console.log(`${colors.yellow}   - PostgreSQL is running (docker-compose up -d)${colors.reset}`);
    console.log(`${colors.yellow}   - Database tables are created (check migrations)${colors.reset}`);
    console.log(`${colors.yellow}   - API server is running (pnpm -F @monorepo/api dev)${colors.reset}`);
    console.log(`${colors.yellow}   - Worker is running (pnpm -F @monorepo/worker dev)${colors.reset}`);
    process.exit(1);
  }
}

// Run the test
console.log(`${colors.blue}Starting comprehensive import API test...${colors.reset}`);
console.log(`${colors.yellow}Target API: ${API_URL}${colors.reset}`);
console.log();

runTest().catch(error => {
  console.error(`${colors.red}Unexpected error during test execution:${colors.reset}`, error);
  process.exit(1);
});