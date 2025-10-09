// Snapshot and export types

export type DataSplit = 'train' | 'validation' | 'test';
export type ExportFormat = 'csv' | 'json' | 'jsonl' | 'parquet';
export type SnapshotStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired';

export interface Snapshot {
  id: string;
  version_id: string;
  name: string;
  description?: string;
  
  // Counts
  total_items: number;
  train_count: number;
  validation_count: number;
  test_count: number;
  
  // Split configuration
  split_seed: number;
  train_ratio: number;
  validation_ratio: number;
  test_ratio: number;
  
  // Stratification
  stratify_by?: string;
  stratify_groups?: Record<string, number>;
  
  // Filtering
  filter_criteria?: any;
  
  // Checksums
  data_checksum?: string;
  manifest_checksum?: string;
  
  // Status
  status: SnapshotStatus;
  is_published: boolean;
  is_archived: boolean;
  
  // Lineage
  parent_snapshot_id?: string;
  
  // Timestamps
  created_at: string;
  created_by: string;
  published_at?: string;
  archived_at?: string;
}

export interface SnapshotItem {
  id: string;
  snapshot_id: string;
  task_id: string;
  split: DataSplit;
  split_index: number;
  data: any;
  item_checksum: string;
  created_at: string;
}

export interface ExportManifest {
  id: string;
  snapshot_id: string;
  version: string;
  schema_version: string;
  
  // Ontology and schema
  ontology: OntologyDefinition;
  schema: SchemaDefinition;
  
  // Metadata
  dataset_name?: string;
  dataset_description?: string;
  license?: string;
  authors?: Author[];
  
  // Statistics
  statistics: DatasetStatistics;
  
  // Lineage
  lineage: DataLineage;
  
  // Export history
  exports?: ExportRecord[];
  
  created_at: string;
  updated_at: string;
}

export interface OntologyDefinition {
  classifications: string[];
  tags: string[];
  fields: FieldDefinition[];
  version: string;
}

export interface FieldDefinition {
  name: string;
  type: string;
  description?: string;
  required: boolean;
  enum_values?: string[];
}

export interface SchemaDefinition {
  type: string;
  properties: Record<string, any>;
  required: string[];
}

export interface Author {
  name: string;
  email?: string;
  organization?: string;
}

export interface DatasetStatistics {
  total_samples: number;
  class_distribution: Record<string, number>;
  split_distribution: {
    train: number;
    validation: number;
    test: number;
  };
  quality_metrics?: {
    avg_confidence?: number;
    completeness?: number;
    consistency?: number;
  };
}

export interface DataLineage {
  source_systems: string[];
  processing_steps: ProcessingStep[];
  transformations: string[];
  filters_applied: any[];
}

export interface ProcessingStep {
  name: string;
  timestamp: string;
  version?: string;
  parameters?: Record<string, any>;
}

export interface ExportRecord {
  id: string;
  format: ExportFormat;
  split?: DataSplit;
  created_at: string;
  file_checksum: string;
  download_url?: string;
}

export interface Export {
  id: string;
  snapshot_id: string;
  format: ExportFormat;
  split?: DataSplit;
  
  // File info
  file_path?: string;
  file_size_bytes?: number;
  file_checksum?: string;
  row_count?: number;
  
  // Compression
  is_compressed: boolean;
  compression_type?: string;
  
  // URLs
  download_url?: string;
  expires_at?: string;
  
  // Status
  status: ExportStatus;
  error_message?: string;
  
  created_at: string;
  created_by?: string;
}

export interface CreateSnapshotRequest {
  name: string;
  description?: string;
  filter_criteria?: any;
  stratify_by?: string;
  split_seed?: number;
  train_ratio?: number;
  validation_ratio?: number;
  test_ratio?: number;
  parent_snapshot_id?: string;
}

export interface CreateExportRequest {
  snapshot_id: string;
  format: ExportFormat;
  split?: DataSplit;
  compression?: boolean;
}

export interface SnapshotFilter {
  status?: SnapshotStatus;
  is_published?: boolean;
  is_archived?: boolean;
  created_by?: string;
  from_date?: string;
  to_date?: string;
}

// Helper functions for split ratios
export const DEFAULT_SPLIT_RATIOS = {
  train: 0.7,
  validation: 0.15,
  test: 0.15,
};

export const validateSplitRatios = (train: number, validation: number, test: number): boolean => {
  return Math.abs(train + validation + test - 1.0) < 0.001;
};