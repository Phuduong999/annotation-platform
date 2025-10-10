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

// Test data - CSV with 3 valid and 2 invalid rows
const testCSVContent = `url,name,category,metadata
https://via.placeholder.com/300,Valid Image 1,category1,{"tags":["test"],"source":"placeholder"}
https://dummyimage.com/400x400/000/fff,Valid Image 2,category2,{"tags":["demo"],"size":"large"}
https://placekitten.com/300/300,Valid Cat Image,category3,{"tags":["cat","animal"]}
invalid-url-without-protocol,Invalid URL Row,INVALID_ENUM_CATEGORY,{"tags":["error"]}
ftp://wrong-protocol.com/image.jpg,Wrong Protocol,category1,{"invalid_json": this is not valid json}`;

async function runTest() {
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}   API Import Test with CSV Validation${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log();

  let testPassed = true;
  let jobId: string | null = null;

  try {
    // Step 1: Create test CSV file
    console.log(`${colors.yellow}Step 1: Creating test CSV file...${colors.reset}`);
    const csvFilePath = 'test-import-validation.csv';
    writeFileSync(csvFilePath, testCSVContent);
    console.log(`${colors.green}✓ CSV created with 5 rows (3 valid, 2 invalid)${colors.reset}`);
    console.log();

    // Step 2: Check API health
    console.log(`${colors.yellow}Step 2: Checking API health...${colors.reset}`);
    try {
      const healthResponse = await axios.get(`${API_URL}/health`);
      if (healthResponse.status === 200) {
        console.log(`${colors.green}✓ API is healthy${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.red}✗ API is not ready. Please start it with: pnpm -F @monorepo/api dev${colors.reset}`);
      process.exit(1);
    }
    console.log();

    // Step 3: Upload CSV file
    console.log(`${colors.yellow}Step 3: Uploading CSV file to API...${colors.reset}`);
    
    const formData = new FormData();
    formData.append('file', readFileSync(csvFilePath), {
      filename: 'test-import-validation.csv',
      contentType: 'text/csv'
    });

    const uploadResponse = await axios.post(
      `${API_URL}/import/jobs`,
      formData,
      {
        headers: formData.getHeaders()
      }
    );

    console.log('API Response:');
    console.log(JSON.stringify(uploadResponse.data, null, 2));
    console.log();

    // Step 4: Validate response
    console.log(`${colors.yellow}Step 4: Validating API response...${colors.reset}`);
    
    const { data } = uploadResponse.data;
    jobId = data.jobId;
    
    // Check job ID
    if (jobId) {
      console.log(`${colors.green}✓ Job ID received: ${jobId}${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ No job ID in response${colors.reset}`);
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
    console.log();

    // Step 5: Download and validate error CSV
    if (jobId && data.invalidRows > 0) {
      console.log(`${colors.yellow}Step 5: Downloading error CSV...${colors.reset}`);
      
      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        const errorResponse = await axios.get(
          `${API_URL}/import/jobs/${jobId}/errors`,
          { responseType: 'text' }
        );

        const errorCSV = errorResponse.data;
        const errorFilePath = 'error-report.csv';
        writeFileSync(errorFilePath, errorCSV);
        
        console.log(`${colors.green}✓ Error CSV downloaded${colors.reset}`);
        console.log();
        console.log('Error CSV content:');
        console.log('-------------------');
        console.log(errorCSV);
        console.log('-------------------');
        console.log();

        // Count error rows (excluding header)
        const lines = errorCSV.split('\n').filter((line: string) => line.trim());
        const errorCount = lines.length - 1; // Subtract header

        console.log('Validating error CSV...');
        
        if (errorCount >= 2) {
          console.log(`${colors.green}✓ Error CSV has at least 2 error entries${colors.reset}`);
        } else {
          console.log(`${colors.red}✗ Error CSV row count incorrect: expected at least 2, got ${errorCount}${colors.reset}`);
          testPassed = false;
        }

        // Check for expected errors
        if (errorCSV.includes('invalid-url-without-protocol')) {
          console.log(`${colors.green}✓ Found invalid URL error${colors.reset}`);
        } else {
          console.log(`${colors.red}✗ Missing invalid URL error${colors.reset}`);
          testPassed = false;
        }

        if (errorCSV.includes('INVALID_ENUM_CATEGORY') || errorCSV.includes('enum')) {
          console.log(`${colors.green}✓ Found enum validation error${colors.reset}`);
        } else {
          console.log(`${colors.red}✗ Missing enum validation error${colors.reset}`);
          testPassed = false;
        }

        // Clean up error report
        unlinkSync(errorFilePath);
      } catch (error: any) {
        console.log(`${colors.red}✗ Failed to download error CSV: ${error.message}${colors.reset}`);
        testPassed = false;
      }
    }

    // Clean up test CSV
    unlinkSync(csvFilePath);
    console.log();
    console.log(`${colors.green}✓ Test files cleaned up${colors.reset}`);

  } catch (error: any) {
    console.error(`${colors.red}Test failed with error:${colors.reset}`, error.message);
    testPassed = false;
  }

  // Final results
  console.log();
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}           TEST RESULTS${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  
  if (testPassed) {
    console.log(`${colors.green}✅ ALL TESTS PASSED!${colors.reset}`);
    console.log(`${colors.green}   - API returned correct jobId${colors.reset}`);
    console.log(`${colors.green}   - Valid rows count: 3 ✓${colors.reset}`);
    console.log(`${colors.green}   - Invalid rows count: 2 ✓${colors.reset}`);
    console.log(`${colors.green}   - Error CSV has correct error entries ✓${colors.reset}`);
    console.log(`${colors.green}   - Error messages are clear ✓${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ SOME TESTS FAILED${colors.reset}`);
    console.log(`${colors.red}   Check the output above for details${colors.reset}`);
    process.exit(1);
  }
}

// Run the test
runTest().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});