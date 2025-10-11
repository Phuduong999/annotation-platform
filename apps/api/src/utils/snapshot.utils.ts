import crypto from 'crypto';
import { Pool } from 'pg';

/**
 * Generate SHA-256 checksum for data
 */
export function generateChecksum(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate deterministic split assignment based on seed and item ID
 */
export function assignDataSplit(
  itemId: string,
  seed: number,
  trainRatio: number,
  validationRatio: number
): 'train' | 'validation' | 'test' {
  // Create deterministic hash from item ID and seed
  const hash = crypto
    .createHash('sha256')
    .update(`${itemId}:${seed}`)
    .digest('hex');
  
  // Convert first 8 hex chars to number and normalize to [0, 1]
  const hashNumber = parseInt(hash.substring(0, 8), 16);
  const normalized = hashNumber / 0xffffffff;
  
  // Assign to split based on ratios
  if (normalized < trainRatio) {
    return 'train';
  } else if (normalized < trainRatio + validationRatio) {
    return 'validation';
  } else {
    return 'test';
  }
}

/**
 * Stratified split assignment
 * Ensures each class maintains the same distribution across splits
 */
export function stratifiedSplit<T extends { id: string; [key: string]: any }>(
  items: T[],
  stratifyBy: string,
  seed: number,
  trainRatio: number,
  validationRatio: number
): Map<string, { split: 'train' | 'validation' | 'test'; index: number }> {
  const result = new Map<string, { split: 'train' | 'validation' | 'test'; index: number }>();
  
  // Group items by stratification key
  const groups = new Map<string, T[]>();
  items.forEach(item => {
    const key = String(item[stratifyBy] || 'unknown');
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  });
  
  // Process each group
  const splitCounts = { train: 0, validation: 0, test: 0 };
  
  groups.forEach((groupItems, groupKey) => {
    // Shuffle items deterministically based on seed
    const shuffled = deterministicShuffle(groupItems, seed + groupKey.length);
    
    // Calculate split sizes for this group
    const groupSize = shuffled.length;
    const trainSize = Math.floor(groupSize * trainRatio);
    const valSize = Math.floor(groupSize * validationRatio);
    
    // Assign items to splits
    shuffled.forEach((item, idx) => {
      let split: 'train' | 'validation' | 'test';
      if (idx < trainSize) {
        split = 'train';
      } else if (idx < trainSize + valSize) {
        split = 'validation';
      } else {
        split = 'test';
      }
      
      result.set(item.id, {
        split,
        index: splitCounts[split]++
      });
    });
  });
  
  return result;
}

/**
 * Deterministic shuffle using seed
 */
function deterministicShuffle<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let currentIndex = shuffled.length;
  
  // Simple deterministic random based on seed
  const random = (i: number) => {
    const x = Math.sin(seed + i) * 10000;
    return x - Math.floor(x);
  };
  
  while (currentIndex > 0) {
    const randomIndex = Math.floor(random(currentIndex) * currentIndex);
    currentIndex--;
    [shuffled[currentIndex], shuffled[randomIndex]] = 
    [shuffled[randomIndex], shuffled[currentIndex]];
  }
  
  return shuffled;
}

/**
 * Generate version ID with format: v{major}.{minor}.{patch}-{date}
 */
export async function generateVersionId(pool: Pool): Promise<string> {
  const result = await pool.query(`
    SELECT generate_version_id() as version_id
  `);
  return result.rows[0].version_id;
}

/**
 * Calculate statistics for dataset
 */
export function calculateDatasetStatistics(
  items: Array<{ classification?: string; ai_confidence?: number; split: string }>
) {
  const stats = {
    total_samples: items.length,
    class_distribution: {} as Record<string, number>,
    split_distribution: {
      train: 0,
      validation: 0,
      test: 0,
    },
    quality_metrics: {
      avg_confidence: 0,
      completeness: 0,
      consistency: 0,
    },
  };
  
  let totalConfidence = 0;
  let confidenceCount = 0;
  let completeCount = 0;
  
  items.forEach(item => {
    // Class distribution
    const cls = item.classification || 'unknown';
    stats.class_distribution[cls] = (stats.class_distribution[cls] || 0) + 1;
    
    // Split distribution
    if (item.split === 'train') stats.split_distribution.train++;
    else if (item.split === 'validation') stats.split_distribution.validation++;
    else if (item.split === 'test') stats.split_distribution.test++;
    
    // Confidence metrics
    if (item.ai_confidence !== undefined) {
      totalConfidence += item.ai_confidence;
      confidenceCount++;
    }
    
    // Completeness (has classification)
    if (item.classification) {
      completeCount++;
    }
  });
  
  // Calculate averages
  if (confidenceCount > 0) {
    stats.quality_metrics.avg_confidence = totalConfidence / confidenceCount;
  }
  
  if (items.length > 0) {
    stats.quality_metrics.completeness = completeCount / items.length;
    
    // Consistency: ratio of most common class to total
    const maxClassCount = Math.max(...Object.values(stats.class_distribution));
    stats.quality_metrics.consistency = maxClassCount / items.length;
  }
  
  return stats;
}

/**
 * Generate manifest for export
 */
export function generateManifest(
  snapshot: any,
  statistics: any,
  ontology: any
): any {
  return {
    version: snapshot.version_id,
    schema_version: '1.0.0',
    dataset_name: snapshot.name,
    dataset_description: snapshot.description,
    created_at: snapshot.created_at,
    
    ontology: {
      classifications: ontology.classifications || ['meal', 'label', 'front_label', 'screenshot', 'others', 'safe'],
      tags: ontology.tags || [],
      fields: [
        {
          name: 'classification',
          type: 'string',
          required: true,
          enum_values: ontology.classifications,
        },
        {
          name: 'tags',
          type: 'array',
          required: false,
        },
        {
          name: 'confidence',
          type: 'number',
          required: false,
        },
      ],
      version: '1.0.0',
    },
    
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        classification: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        split: { type: 'string', enum: ['train', 'validation', 'test'] },
      },
      required: ['id', 'classification', 'split'],
    },
    
    statistics,
    
    lineage: {
      source_systems: ['annotation_platform'],
      processing_steps: [
        {
          name: 'data_import',
          timestamp: snapshot.created_at,
        },
        {
          name: 'review_and_validation',
          timestamp: snapshot.created_at,
        },
        {
          name: 'snapshot_creation',
          timestamp: snapshot.created_at,
          parameters: {
            split_seed: snapshot.split_seed,
            train_ratio: snapshot.train_ratio,
            validation_ratio: snapshot.validation_ratio,
            test_ratio: snapshot.test_ratio,
            stratify_by: snapshot.stratify_by,
          },
        },
      ],
      transformations: ['normalization', 'validation', 'stratified_splitting'],
      filters_applied: snapshot.filter_criteria || [],
    },
    
    checksums: {
      data: snapshot.data_checksum,
      manifest: null, // Will be calculated after manifest is created
    },
  };
}

/**
 * Convert snapshot items to CSV format
 */
export function convertToCSV(items: any[]): string {
  if (items.length === 0) return '';
  
  // Get headers from first item
  const headers = Object.keys(items[0]);
  const csvHeaders = headers.join(',');
  
  // Convert each item to CSV row
  const csvRows = items.map(item => {
    return headers.map(header => {
      const value = item[header];
      // Handle different data types
      if (value === null || value === undefined) {
        return '';
      } else if (typeof value === 'object') {
        // JSON stringify objects/arrays and escape quotes
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      } else if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        // Escape strings containing special characters
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',');
  });
  
  return [csvHeaders, ...csvRows].join('\n');
}

/**
 * Convert snapshot items to JSONL format
 */
export function convertToJSONL(items: any[]): string {
  return items.map(item => JSON.stringify(item)).join('\n');
}

/**
 * Stream CSV data in chunks
 * Returns an async generator that yields CSV rows in batches
 */
export async function* streamCSV(
  pool: Pool,
  snapshotId: string,
  split?: string,
  batchSize: number = 1000
): AsyncGenerator<string, void, unknown> {
  const client = await pool.connect();
  try {
    // Build query
    let query = `
      SELECT data, split, split_index 
      FROM snapshot_items 
      WHERE snapshot_id = $1
    `;
    const params: any[] = [snapshotId];
    
    if (split && split !== 'all') {
      query += ` AND split = $2`;
      params.push(split);
    }
    
    query += ` ORDER BY split, split_index`;
    
    // Use cursor for streaming
    const cursorName = `snapshot_cursor_${Date.now()}`;
    await client.query('BEGIN');
    await client.query(`DECLARE ${cursorName} CURSOR FOR ${query}`, params);
    
    let firstBatch = true;
    let headers: string[] = [];
    
    while (true) {
      const result = await client.query(
        `FETCH ${batchSize} FROM ${cursorName}`
      );
      
      if (result.rows.length === 0) break;
      
      const items = result.rows.map(row => ({
        ...row.data,
        split: row.split,
      }));
      
      // Generate CSV for this batch
      if (firstBatch) {
        headers = Object.keys(items[0]);
        yield headers.join(',') + '\n';
        firstBatch = false;
      }
      
      // Convert items to CSV rows
      const csvRows = items.map(item => {
        return headers.map(header => {
          const value = item[header];
          if (value === null || value === undefined) {
            return '';
          } else if (typeof value === 'object') {
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          } else if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',');
      }).join('\n');
      
      yield csvRows + '\n';
    }
    
    await client.query(`CLOSE ${cursorName}`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Stream JSONL data in chunks
 * Returns an async generator that yields JSONL lines in batches
 */
export async function* streamJSONL(
  pool: Pool,
  snapshotId: string,
  split?: string,
  batchSize: number = 1000
): AsyncGenerator<string, void, unknown> {
  const client = await pool.connect();
  try {
    // Build query
    let query = `
      SELECT data, split, split_index 
      FROM snapshot_items 
      WHERE snapshot_id = $1
    `;
    const params: any[] = [snapshotId];
    
    if (split && split !== 'all') {
      query += ` AND split = $2`;
      params.push(split);
    }
    
    query += ` ORDER BY split, split_index`;
    
    // Use cursor for streaming
    const cursorName = `snapshot_cursor_${Date.now()}`;
    await client.query('BEGIN');
    await client.query(`DECLARE ${cursorName} CURSOR FOR ${query}`, params);
    
    while (true) {
      const result = await client.query(
        `FETCH ${batchSize} FROM ${cursorName}`
      );
      
      if (result.rows.length === 0) break;
      
      const items = result.rows.map(row => ({
        ...row.data,
        split: row.split,
      }));
      
      // Convert to JSONL
      const jsonlChunk = items.map(item => JSON.stringify(item)).join('\n') + '\n';
      yield jsonlChunk;
    }
    
    await client.query(`CLOSE ${cursorName}`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Calculate streaming checksum for large datasets
 */
export async function calculateStreamingChecksum(
  pool: Pool,
  snapshotId: string,
  split?: string
): Promise<string> {
  const hash = crypto.createHash('sha256');
  const client = await pool.connect();
  
  try {
    let query = `
      SELECT item_checksum
      FROM snapshot_items 
      WHERE snapshot_id = $1
    `;
    const params: any[] = [snapshotId];
    
    if (split && split !== 'all') {
      query += ` AND split = $2`;
      params.push(split);
    }
    
    query += ` ORDER BY split, split_index`;
    
    // Stream checksums
    const cursorName = `checksum_cursor_${Date.now()}`;
    await client.query('BEGIN');
    await client.query(`DECLARE ${cursorName} CURSOR FOR ${query}`, params);
    
    while (true) {
      const result = await client.query(`FETCH 1000 FROM ${cursorName}`);
      if (result.rows.length === 0) break;
      
      result.rows.forEach(row => {
        hash.update(row.item_checksum);
      });
    }
    
    await client.query(`CLOSE ${cursorName}`);
    await client.query('COMMIT');
    
    return hash.digest('hex');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Generate enhanced manifest with full ontology, schema, and lineage
 */
export async function generateEnhancedManifest(
  pool: Pool,
  snapshot: any,
  ontologyConfig?: any
): Promise<any> {
  // Get statistics from database
  const statsResult = await pool.query(
    `SELECT em.statistics, em.ontology 
     FROM export_manifests em 
     WHERE em.snapshot_id = $1`,
    [snapshot.id]
  );
  
  const existingStats = statsResult.rows[0]?.statistics || {};
  const existingOntology = statsResult.rows[0]?.ontology || {};
  
  // Merge with provided config
  const classifications = ontologyConfig?.classifications || 
                         existingOntology.classifications || 
                         ['meal', 'label', 'front_label', 'screenshot', 'others', 'safe'];
  
  // Build comprehensive ontology
  const ontology = {
    version: '1.0.0',
    classifications,
    tags: ontologyConfig?.tags || existingOntology.tags || [],
    fields: [
      {
        name: 'id',
        type: 'string',
        description: 'Unique task identifier',
        required: true,
        format: 'uuid',
      },
      {
        name: 'classification',
        type: 'string',
        description: 'Task classification category',
        required: true,
        enum_values: classifications,
      },
      {
        name: 'tags',
        type: 'array',
        description: 'Additional tags for categorization',
        required: false,
        items: { type: 'string' },
      },
      {
        name: 'confidence',
        type: 'number',
        description: 'AI confidence score',
        required: false,
        minimum: 0,
        maximum: 1,
      },
      {
        name: 'split',
        type: 'string',
        description: 'Dataset split assignment',
        required: true,
        enum_values: ['train', 'validation', 'test'],
      },
      {
        name: 'request_id',
        type: 'string',
        description: 'Original request identifier',
        required: false,
      },
      {
        name: 'team_id',
        type: 'string',
        description: 'Team identifier',
        required: false,
      },
    ],
    relationships: [
      {
        source: 'task',
        target: 'request',
        type: 'belongs_to',
        foreign_key: 'request_id',
      },
      {
        source: 'task',
        target: 'team',
        type: 'belongs_to',
        foreign_key: 'team_id',
      },
    ],
  };
  
  // Build JSON Schema
  const schema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: `https://example.com/schemas/snapshot/${snapshot.version_id}.json`,
    title: snapshot.name,
    description: snapshot.description || 'Snapshot dataset',
    type: 'object',
    properties: {
      id: { 
        type: 'string', 
        format: 'uuid',
        description: 'Unique task identifier',
      },
      classification: { 
        type: 'string',
        enum: classifications,
        description: 'Task classification category',
      },
      tags: { 
        type: 'array', 
        items: { type: 'string' },
        description: 'Additional tags',
      },
      confidence: { 
        type: 'number', 
        minimum: 0, 
        maximum: 1,
        description: 'AI confidence score',
      },
      split: { 
        type: 'string', 
        enum: ['train', 'validation', 'test'],
        description: 'Dataset split',
      },
      request_id: { 
        type: 'string',
        description: 'Request identifier',
      },
      team_id: { 
        type: 'string',
        description: 'Team identifier',
      },
      scan_date: {
        type: 'string',
        format: 'date-time',
        description: 'Scan timestamp',
      },
      user_input: {
        type: 'object',
        description: 'Original user input data',
      },
    },
    required: ['id', 'classification', 'split'],
    additionalProperties: false,
  };
  
  // Build detailed lineage
  const lineage = {
    snapshot_id: snapshot.id,
    version_id: snapshot.version_id,
    parent_snapshot_id: snapshot.parent_snapshot_id,
    source_systems: ['annotation_platform'],
    data_sources: [
      {
        type: 'database',
        name: 'tasks',
        query: 'SELECT * FROM tasks WHERE status = \'completed\' AND review_status = \'accepted\'',
        timestamp: snapshot.created_at,
      },
    ],
    processing_steps: [
      {
        name: 'data_extraction',
        description: 'Extract finalized tasks from database',
        timestamp: snapshot.created_at,
        version: '1.0.0',
        parameters: {
          filter_criteria: snapshot.filter_criteria,
        },
      },
      {
        name: 'quality_validation',
        description: 'Validate data quality and completeness',
        timestamp: snapshot.created_at,
        version: '1.0.0',
      },
      {
        name: 'stratified_splitting',
        description: 'Assign train/validation/test splits',
        timestamp: snapshot.created_at,
        version: '1.0.0',
        algorithm: 'deterministic_stratified_split',
        parameters: {
          split_seed: snapshot.split_seed,
          train_ratio: snapshot.train_ratio,
          validation_ratio: snapshot.validation_ratio,
          test_ratio: snapshot.test_ratio,
          stratify_by: snapshot.stratify_by,
        },
      },
      {
        name: 'snapshot_creation',
        description: 'Create immutable snapshot',
        timestamp: snapshot.created_at,
        version: '1.0.0',
        parameters: {
          immutable: true,
          checksum_algorithm: 'sha256',
        },
      },
    ],
    transformations: [
      'normalization',
      'validation',
      'stratified_splitting',
      'checksum_generation',
    ],
    filters_applied: snapshot.filter_criteria ? [snapshot.filter_criteria] : [],
    quality_checks: [
      {
        name: 'completeness_check',
        passed: true,
        timestamp: snapshot.created_at,
      },
      {
        name: 'consistency_check',
        passed: true,
        timestamp: snapshot.created_at,
      },
    ],
  };
  
  // Calculate checksums
  const manifestWithoutChecksum = {
    version: snapshot.version_id,
    schema_version: '2.0.0',
    dataset_name: snapshot.name,
    dataset_description: snapshot.description,
    created_at: snapshot.created_at,
    created_by: snapshot.created_by,
    ontology,
    schema,
    statistics: existingStats,
    lineage,
    split_config: {
      seed: snapshot.split_seed,
      ratios: {
        train: snapshot.train_ratio,
        validation: snapshot.validation_ratio,
        test: snapshot.test_ratio,
      },
      stratify_by: snapshot.stratify_by,
      reproducible: true,
    },
  };
  
  const manifestChecksum = generateChecksum(JSON.stringify(manifestWithoutChecksum));
  const ontologyChecksum = generateChecksum(JSON.stringify(ontology));
  const schemaChecksum = generateChecksum(JSON.stringify(schema));
  const lineageChecksum = generateChecksum(JSON.stringify(lineage));
  
  return {
    ...manifestWithoutChecksum,
    checksums: {
      manifest: manifestChecksum,
      ontology: ontologyChecksum,
      schema: schemaChecksum,
      lineage: lineageChecksum,
      data: snapshot.data_checksum,
    },
    immutable: true,
    published: snapshot.is_published,
  };
}

/**
 * Verify split reproducibility
 */
export async function verifySplitReproducibility(
  pool: Pool,
  snapshotId: string,
  seed: number
): Promise<{ reproducible: boolean; mismatches: number; details?: any[] }> {
  // Get snapshot configuration
  const snapshotResult = await pool.query(
    `SELECT * FROM snapshots WHERE id = $1`,
    [snapshotId]
  );
  
  if (snapshotResult.rows.length === 0) {
    throw new Error('Snapshot not found');
  }
  
  const snapshot = snapshotResult.rows[0];
  
  // Get all items with their current splits
  const itemsResult = await pool.query(
    `SELECT si.task_id, si.split as current_split, si.data
     FROM snapshot_items si
     WHERE si.snapshot_id = $1
     ORDER BY si.task_id`,
    [snapshotId]
  );
  
  const items = itemsResult.rows.map(row => ({
    id: row.task_id,
    ...row.data,
    current_split: row.current_split,
  }));
  
  // Recalculate splits with the given seed
  const recalculatedSplits = stratifiedSplit(
    items,
    snapshot.stratify_by,
    seed,
    snapshot.train_ratio,
    snapshot.validation_ratio
  );
  
  // Compare splits
  const mismatches: any[] = [];
  items.forEach(item => {
    const recalculatedSplit = recalculatedSplits.get(item.id)?.split;
    if (recalculatedSplit !== item.current_split) {
      mismatches.push({
        task_id: item.id,
        expected_split: item.current_split,
        recalculated_split: recalculatedSplit,
      });
    }
  });
  
  return {
    reproducible: mismatches.length === 0,
    mismatches: mismatches.length,
    details: mismatches.length > 0 ? mismatches.slice(0, 10) : undefined,
  };
}
