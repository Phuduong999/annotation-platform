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
      classifications: ontology.classifications || ['explicit', 'adult', 'suggestive', 'medical', 'safe'],
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