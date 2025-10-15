-- Migration: Create exports table for tracking export jobs and files
-- Description: Tracks export operations and generated files

CREATE TABLE IF NOT EXISTS exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  
  -- Export configuration
  format VARCHAR(20) NOT NULL CHECK (format IN ('csv', 'json', 'jsonl', 'xlsx')),
  split VARCHAR(20) CHECK (split IN ('train', 'validation', 'test', 'all') OR split IS NULL),
  
  -- File information
  file_path TEXT,
  file_size_bytes BIGINT,
  file_checksum VARCHAR(64),
  row_count INTEGER,
  
  -- Compression
  is_compressed BOOLEAN DEFAULT FALSE,
  compression_type VARCHAR(20),
  
  -- Download URL and expiry
  download_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) DEFAULT 'system',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT valid_export_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_exports_snapshot ON exports(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_exports_status ON exports(status);
CREATE INDEX IF NOT EXISTS idx_exports_created_at ON exports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exports_format ON exports(format);
CREATE INDEX IF NOT EXISTS idx_exports_expires_at ON exports(expires_at) WHERE expires_at IS NOT NULL;

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_exports_updated_at 
  BEFORE UPDATE ON exports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired exports
CREATE OR REPLACE FUNCTION cleanup_expired_exports()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE exports
  SET status = 'expired'
  WHERE status = 'completed'
    AND expires_at IS NOT NULL
    AND expires_at < CURRENT_TIMESTAMP;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to cleanup expired exports
-- (Requires pg_cron extension or application-level scheduling)
COMMENT ON FUNCTION cleanup_expired_exports() IS 'Marks expired exports as expired. Should be called periodically.';
