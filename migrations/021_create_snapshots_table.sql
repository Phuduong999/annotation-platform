-- Migration: Create snapshots table for data versioning and export
-- Description: Snapshots are versioned datasets with train/validation/test splits

CREATE TABLE IF NOT EXISTS snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Split configuration
  split_seed INTEGER NOT NULL DEFAULT 42,
  train_ratio DECIMAL(5,4) NOT NULL DEFAULT 0.7,
  validation_ratio DECIMAL(5,4) NOT NULL DEFAULT 0.15,
  test_ratio DECIMAL(5,4) NOT NULL DEFAULT 0.15,
  stratify_by VARCHAR(100) DEFAULT 'classification',
  
  -- Filter criteria stored as JSON
  filter_criteria JSONB,
  
  -- Checksums for data integrity
  data_checksum VARCHAR(64),
  manifest_checksum VARCHAR(64),
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'processing',
  is_published BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  
  -- Lineage
  parent_snapshot_id UUID REFERENCES snapshots(id),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NOT NULL DEFAULT 'system',
  published_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT valid_ratios CHECK (
    train_ratio >= 0 AND train_ratio <= 1 AND
    validation_ratio >= 0 AND validation_ratio <= 1 AND
    test_ratio >= 0 AND test_ratio <= 1
  ),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Create snapshot_items table for storing individual data items in snapshots
CREATE TABLE IF NOT EXISTS snapshot_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  task_id UUID NOT NULL,
  split VARCHAR(20) NOT NULL CHECK (split IN ('train', 'validation', 'test')),
  split_index INTEGER NOT NULL,
  data JSONB NOT NULL,
  item_checksum VARCHAR(64) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint to prevent duplicate task in same snapshot
  UNIQUE(snapshot_id, task_id)
);

-- Create export_manifests table for metadata about exports
CREATE TABLE IF NOT EXISTS export_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  version VARCHAR(50) NOT NULL,
  schema_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  
  -- Ontology and schema stored as JSON
  ontology JSONB NOT NULL,
  schema JSONB NOT NULL,
  
  -- Statistics
  statistics JSONB NOT NULL,
  
  -- Lineage
  lineage JSONB NOT NULL,
  
  -- Optional metadata
  dataset_name VARCHAR(255),
  dataset_description TEXT,
  license VARCHAR(100),
  authors JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- One manifest per snapshot
  UNIQUE(snapshot_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_snapshots_status ON snapshots(status);
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON snapshots(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_published ON snapshots(is_published) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_snapshots_version_id ON snapshots(version_id);

CREATE INDEX IF NOT EXISTS idx_snapshot_items_snapshot ON snapshot_items(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_items_split ON snapshot_items(snapshot_id, split);
CREATE INDEX IF NOT EXISTS idx_snapshot_items_task ON snapshot_items(task_id);

CREATE INDEX IF NOT EXISTS idx_export_manifests_snapshot ON export_manifests(snapshot_id);

-- Add computed columns for item counts (will be updated via triggers or application)
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS total_items INTEGER DEFAULT 0;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS train_count INTEGER DEFAULT 0;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS validation_count INTEGER DEFAULT 0;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS test_count INTEGER DEFAULT 0;

-- Function to calculate snapshot checksum
CREATE OR REPLACE FUNCTION calculate_snapshot_checksum(p_snapshot_id UUID)
RETURNS VARCHAR(64) AS $$
DECLARE
  v_checksum VARCHAR(64);
BEGIN
  SELECT encode(digest(string_agg(item_checksum, '' ORDER BY split, split_index), 'sha256'), 'hex')
  INTO v_checksum
  FROM snapshot_items
  WHERE snapshot_id = p_snapshot_id;
  
  RETURN v_checksum;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_snapshots_updated_at 
  BEFORE UPDATE ON snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_export_manifests_updated_at 
  BEFORE UPDATE ON export_manifests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
