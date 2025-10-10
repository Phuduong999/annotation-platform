#!/usr/bin/env tsx
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'http://localhost:4000';
const DB_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'monorepo',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
};

describe('Import and Link Health Test', () => {
  let pool: Pool;
  let testJobId: string;
  let testProjectId: string;

  beforeAll(async () => {
    pool = new Pool(DB_CONFIG);
    
    // Clean database
    await cleanDatabase(pool);
    
    // Create test project
    const projectResult = await pool.query(
      `INSERT INTO projects (name, description, created_by) 
       VALUES ('Test Import Project', 'Link health testing', 'test-user') 
       RETURNING id`
    );
    testProjectId = projectResult.rows[0].id;
    
    // Create test CSV file
    await createTestCSV();
  });

  afterAll(async () => {
    await pool.end();
    // Clean up test files
    fs.unlinkSync('./test-import.csv');
    if (fs.existsSync('./error-export.csv')) {
      fs.unlinkSync('./error-export.csv');
    }
  });

  it('should upload CSV and return correct counts', async () => {
    const formData = new FormData();
    formData.append('file', fs.createReadStream('./test-import.csv'));
    formData.append('project_id', testProjectId);
    formData.append('validate_links', 'true');

    const response = await fetch(`${API_URL}/api/import`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
    });

    expect(response.ok).toBe(true);
    
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.job_id).toBeDefined();
    expect(result.data.total_rows).toBe(15);
    expect(result.data.valid_rows).toBe(10);
    expect(result.data.invalid_rows).toBe(5);
    
    testJobId = result.data.job_id;
  });

  it('should generate error CSV with 5 error rows', async () => {
    // Wait for import processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const response = await fetch(`${API_URL}/api/import/${testJobId}/errors`);
    expect(response.ok).toBe(true);
    
    const csvContent = await response.text();
    fs.writeFileSync('./error-export.csv', csvContent);
    
    const lines = csvContent.split('\n').filter(line => line.trim());
    // Header + 5 error rows
    expect(lines.length).toBe(6);
    
    // Verify error messages are clear
    expect(csvContent).toContain('404');
    expect(csvContent).toContain('timeout');
    expect(csvContent).toContain('invalid_mime');
    expect(csvContent).toContain('decode_error');
  });

  it('should set correct link_status for all assets', async () => {
    // Wait for worker to process link checks
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check valid assets
    const validAssets = await pool.query(
      `SELECT * FROM assets 
       WHERE import_job_id = $1 
       AND link_status = 'ok'`,
      [testJobId]
    );
    expect(validAssets.rows.length).toBe(10);
    
    // Check error assets by type
    const errorStatuses = [
      { status: '404', count: 2 },
      { status: 'timeout', count: 1 },
      { status: 'invalid_mime', count: 1 },
      { status: 'decode_error', count: 1 },
    ];
    
    for (const { status, count } of errorStatuses) {
      const result = await pool.query(
        `SELECT * FROM assets 
         WHERE import_job_id = $1 
         AND link_status = $2`,
        [testJobId, status]
      );
      expect(result.rows.length).toBe(count);
    }
  });

  it('should not create annotation tasks for failed links', async () => {
    const tasks = await pool.query(
      `SELECT t.* FROM tasks t
       JOIN assets a ON t.asset_id = a.id
       WHERE a.import_job_id = $1
       AND a.link_status != 'ok'`,
      [testJobId]
    );
    
    expect(tasks.rows.length).toBe(0);
  });

  it('should create annotation tasks only for valid links', async () => {
    const tasks = await pool.query(
      `SELECT t.* FROM tasks t
       JOIN assets a ON t.asset_id = a.id
       WHERE a.import_job_id = $1
       AND a.link_status = 'ok'`,
      [testJobId]
    );
    
    expect(tasks.rows.length).toBe(10);
  });

  it('should properly handle worker link health checks', async () => {
    // Check worker processing results
    const jobStatus = await pool.query(
      `SELECT * FROM import_jobs WHERE id = $1`,
      [testJobId]
    );
    
    const job = jobStatus.rows[0];
    expect(job.status).toBe('completed');
    expect(job.valid_count).toBe(10);
    expect(job.error_count).toBe(5);
    
    // Verify error details are stored
    expect(job.error_details).toBeDefined();
    const errorDetails = JSON.parse(job.error_details);
    expect(errorDetails.length).toBe(5);
  });
});

async function cleanDatabase(pool: Pool) {
  await pool.query('DELETE FROM tasks');
  await pool.query('DELETE FROM assets');
  await pool.query('DELETE FROM import_jobs');
  await pool.query('DELETE FROM projects WHERE name LIKE \'Test%\'');
}

async function createTestCSV() {
  const csvContent = `url,name,category,metadata
https://example.com/valid-image-1.jpg,Valid Image 1,category1,{"tags":["test"]}
https://example.com/valid-image-2.png,Valid Image 2,category1,{"tags":["test"]}
https://example.com/valid-image-3.jpeg,Valid Image 3,category2,{"tags":["test"]}
https://example.com/valid-image-4.gif,Valid Image 4,category2,{"tags":["test"]}
https://example.com/valid-image-5.webp,Valid Image 5,category3,{"tags":["test"]}
https://placeholder.pics/200x200,Valid Placeholder 1,category1,{"tags":["placeholder"]}
https://via.placeholder.com/300,Valid Placeholder 2,category2,{"tags":["placeholder"]}
https://dummyimage.com/400x400,Valid Placeholder 3,category3,{"tags":["placeholder"]}
https://placekitten.com/300/300,Valid Placeholder 4,category1,{"tags":["placeholder"]}
https://picsum.photos/200,Valid Placeholder 5,category2,{"tags":["placeholder"]}
https://example.com/not-found-1.jpg,Error 404-1,category1,{"error":"404"}
https://example.com/not-found-2.png,Error 404-2,category2,{"error":"404"}
https://timeout-test.example.com/slow.jpg,Error Timeout,category1,{"error":"timeout"}
https://example.com/document.pdf,Error Invalid MIME,category3,{"error":"wrong_type"}
https://example.com/broken.json,Error JSON Decode,category2,{invalid json here}`;
  
  fs.writeFileSync('./test-import.csv', csvContent);
}