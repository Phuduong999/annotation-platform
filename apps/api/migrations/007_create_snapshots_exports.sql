-- Create data split enum
CREATE TYPE data_split AS ENUM ('train', 'validation', 'test');

-- Create export format enum
CREATE TYPE export_format AS ENUM ('csv', 'json', 'jsonl', 'parquet');

-- Create snapshots table for versioned data exports
CREATE TABLE IF NOT EXISTS snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id VARCHAR(20) UNIQUE NOT NULL, -- e.g., v1.0.0-20240115
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Snapshot metadata
  total_items INTEGER NOT NULL DEFAULT 0,
  train_count INTEGER NOT NULL DEFAULT 0,
  validation_count INTEGER NOT NULL DEFAULT 0,
  test_count INTEGER NOT NULL DEFAULT 0,
  
  -- Split configuration
  split_seed INTEGER NOT NULL DEFAULT 42,
  train_ratio DECIMAL(3,2) NOT NULL DEFAULT 0.70,
  validation_ratio DECIMAL(3,2) NOT NULL DEFAULT 0.15,
  test_ratio DECIMAL(3,2) NOT NULL DEFAULT 0.15,
  
  -- Stratification settings
  stratify_by VARCHAR(50), -- e.g., 'classification', 'type'
  stratify_groups JSONB, -- Distribution of stratified groups
  
  -- Filtering criteria used
  filter_criteria JSONB,
  
  -- Checksums
  data_checksum VARCHAR(64), -- SHA-256 of all data
  manifest_checksum VARCHAR(64), -- SHA-256 of manifest
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  is_published BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  
  -- Lineage
  parent_snapshot_id UUID REFERENCES snapshots(id),
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL,
  published_at TIMESTAMP,
  archived_at TIMESTAMP,
  
  CONSTRAINT check_split_ratios CHECK (
    train_ratio + validation_ratio + test_ratio = 1.0
  ),
  CONSTRAINT check_snapshot_status CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  )
);

-- Create snapshot_items table for individual data points
CREATE TABLE IF NOT EXISTS snapshot_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id),
  
  -- Split assignment
  split data_split NOT NULL,
  split_index INTEGER NOT NULL, -- Order within split
  
  -- Data at time of snapshot
  data JSONB NOT NULL, -- Immutable copy of task data
  
  -- Metadata
  item_checksum VARCHAR(64), -- SHA-256 of this item
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(snapshot_id, task_id)
);

-- Create export_manifests table
CREATE TABLE IF NOT EXISTS export_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  
  -- Manifest content
  version VARCHAR(20) NOT NULL,
  schema_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  
  -- Ontology and schema definitions
  ontology JSONB NOT NULL, -- Classification enums, field definitions
  schema JSONB NOT NULL, -- JSON Schema or similar
  
  -- Dataset metadata
  dataset_name VARCHAR(255),
  dataset_description TEXT,
  license VARCHAR(100),
  authors JSONB, -- Array of author objects
  
  -- Statistics
  statistics JSONB NOT NULL, -- Class distribution, quality metrics
  
  -- Lineage
  lineage JSONB NOT NULL, -- Source systems, processing steps
  
  -- Export history
  exports JSONB, -- Array of export records with format, date, checksum
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create exports table for tracking generated files
CREATE TABLE IF NOT EXISTS exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES snapshots(id),
  
  -- Export details
  format export_format NOT NULL,
  split data_split, -- NULL means all splits
  
  -- File information
  file_path VARCHAR(500),
  file_size_bytes BIGINT,
  file_checksum VARCHAR(64), -- SHA-256
  row_count INTEGER,
  
  -- Compression
  is_compressed BOOLEAN DEFAULT FALSE,
  compression_type VARCHAR(20), -- 'gzip', 'zip', 'bz2'
  
  -- URLs
  download_url VARCHAR(500),
  expires_at TIMESTAMP,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255),
  
  CONSTRAINT check_export_status CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'expired')
  )
);

-- Indexes for snapshots
CREATE INDEX idx_snapshots_version_id ON snapshots(version_id);
CREATE INDEX idx_snapshots_status ON snapshots(status);
CREATE INDEX idx_snapshots_is_published ON snapshots(is_published);
CREATE INDEX idx_snapshots_created_at ON snapshots(created_at DESC);
CREATE INDEX idx_snapshots_parent ON snapshots(parent_snapshot_id) WHERE parent_snapshot_id IS NOT NULL;

-- Indexes for snapshot_items
CREATE INDEX idx_snapshot_items_snapshot_id ON snapshot_items(snapshot_id);
CREATE INDEX idx_snapshot_items_task_id ON snapshot_items(task_id);
CREATE INDEX idx_snapshot_items_split ON snapshot_items(split);
CREATE INDEX idx_snapshot_items_split_index ON snapshot_items(snapshot_id, split, split_index);

-- Indexes for exports
CREATE INDEX idx_exports_snapshot_id ON exports(snapshot_id);
CREATE INDEX idx_exports_format ON exports(format);
CREATE INDEX idx_exports_status ON exports(status);
CREATE INDEX idx_exports_created_at ON exports(created_at DESC);

-- Function to generate version_id
CREATE OR REPLACE FUNCTION generate_version_id()
RETURNS VARCHAR AS $$
DECLARE
  major_version INTEGER;
  minor_version INTEGER;
  patch_version INTEGER;
  date_suffix VARCHAR;
BEGIN
  -- Get latest version
  SELECT 
    COALESCE(MAX(CAST(SPLIT_PART(SPLIT_PART(version_id, '.', 1), 'v', 2) AS INTEGER)), 0),
    COALESCE(MAX(CAST(SPLIT_PART(version_id, '.', 2) AS INTEGER)), 0),
    COALESCE(MAX(CAST(SPLIT_PART(SPLIT_PART(version_id, '.', 3), '-', 1) AS INTEGER)), 0)
  INTO major_version, minor_version, patch_version
  FROM snapshots
  WHERE created_at >= CURRENT_DATE;
  
  -- Increment patch version for same day
  patch_version := patch_version + 1;
  
  -- Generate date suffix
  date_suffix := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  RETURN 'v' || major_version || '.' || minor_version || '.' || patch_version || '-' || date_suffix;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate data checksum
CREATE OR REPLACE FUNCTION calculate_snapshot_checksum(snapshot_uuid UUID)
RETURNS VARCHAR AS $$
DECLARE
  checksum_value VARCHAR;
BEGIN
  SELECT MD5(
    STRING_AGG(
      item_checksum,
      '' ORDER BY split, split_index
    )
  ) INTO checksum_value
  FROM snapshot_items
  WHERE snapshot_id = snapshot_uuid;
  
  RETURN checksum_value;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update snapshot counts
CREATE OR REPLACE FUNCTION update_snapshot_counts()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE snapshots
  SET 
    total_items = (
      SELECT COUNT(*) FROM snapshot_items WHERE snapshot_id = NEW.snapshot_id
    ),
    train_count = (
      SELECT COUNT(*) FROM snapshot_items WHERE snapshot_id = NEW.snapshot_id AND split = 'train'
    ),
    validation_count = (
      SELECT COUNT(*) FROM snapshot_items WHERE snapshot_id = NEW.snapshot_id AND split = 'validation'
    ),
    test_count = (
      SELECT COUNT(*) FROM snapshot_items WHERE snapshot_id = NEW.snapshot_id AND split = 'test'
    )
  WHERE id = NEW.snapshot_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_snapshot_counts
AFTER INSERT OR UPDATE OR DELETE ON snapshot_items
FOR EACH ROW
EXECUTE FUNCTION update_snapshot_counts();

-- Comments
COMMENT ON TABLE snapshots IS 'Immutable versioned snapshots of finalized task data';
COMMENT ON TABLE snapshot_items IS 'Individual data items within a snapshot with split assignment';
COMMENT ON TABLE export_manifests IS 'Metadata manifests describing snapshot ontology and lineage';
COMMENT ON TABLE exports IS 'Generated export files from snapshots';
COMMENT ON COLUMN snapshots.version_id IS 'Semantic version with date suffix (e.g., v1.0.0-20240115)';
COMMENT ON COLUMN snapshots.split_seed IS 'Random seed for reproducible train/val/test splits';
COMMENT ON COLUMN snapshot_items.data IS 'Immutable copy of task data at snapshot time';
COMMENT ON COLUMN export_manifests.ontology IS 'Classification categories and field definitions';
COMMENT ON COLUMN export_manifests.lineage IS 'Data provenance and processing history';