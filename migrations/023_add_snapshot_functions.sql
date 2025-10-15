-- Migration: Add utility functions for snapshot management
-- Description: Helper functions for version IDs and snapshot operations

-- Function to generate semantic version ID
CREATE OR REPLACE FUNCTION generate_version_id()
RETURNS VARCHAR(50) AS $$
DECLARE
  v_count INTEGER;
  v_date TEXT;
  v_version VARCHAR(50);
BEGIN
  -- Get count of existing snapshots
  SELECT COUNT(*) INTO v_count FROM snapshots;
  
  -- Generate date string (YYYYMMDD)
  v_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  -- Generate version: v{count+1}.0.0-{date}
  v_version := 'v' || (v_count + 1) || '.0.0-' || v_date;
  
  RETURN v_version;
END;
$$ LANGUAGE plpgsql;

-- Function to update snapshot item counts
CREATE OR REPLACE FUNCTION update_snapshot_counts(p_snapshot_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE snapshots
  SET 
    total_items = (
      SELECT COUNT(*) 
      FROM snapshot_items 
      WHERE snapshot_id = p_snapshot_id
    ),
    train_count = (
      SELECT COUNT(*) 
      FROM snapshot_items 
      WHERE snapshot_id = p_snapshot_id AND split = 'train'
    ),
    validation_count = (
      SELECT COUNT(*) 
      FROM snapshot_items 
      WHERE snapshot_id = p_snapshot_id AND split = 'validation'
    ),
    test_count = (
      SELECT COUNT(*) 
      FROM snapshot_items 
      WHERE snapshot_id = p_snapshot_id AND split = 'test'
    )
  WHERE id = p_snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get snapshot statistics
CREATE OR REPLACE FUNCTION get_snapshot_statistics(p_snapshot_id UUID)
RETURNS TABLE (
  total_items BIGINT,
  train_count BIGINT,
  validation_count BIGINT,
  test_count BIGINT,
  avg_confidence NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_items,
    COUNT(*) FILTER (WHERE split = 'train')::BIGINT as train_count,
    COUNT(*) FILTER (WHERE split = 'validation')::BIGINT as validation_count,
    COUNT(*) FILTER (WHERE split = 'test')::BIGINT as test_count,
    AVG((data->>'confidence')::NUMERIC) as avg_confidence
  FROM snapshot_items
  WHERE snapshot_id = p_snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update snapshot counts when items are added/removed
CREATE OR REPLACE FUNCTION trigger_update_snapshot_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM update_snapshot_counts(NEW.snapshot_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM update_snapshot_counts(OLD.snapshot_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to snapshot_items table
DROP TRIGGER IF EXISTS snapshot_items_count_trigger ON snapshot_items;
CREATE TRIGGER snapshot_items_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON snapshot_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_snapshot_counts();

-- Comment functions
COMMENT ON FUNCTION generate_version_id() IS 'Generates a semantic version ID for new snapshots';
COMMENT ON FUNCTION update_snapshot_counts(UUID) IS 'Updates the count columns in snapshots table';
COMMENT ON FUNCTION get_snapshot_statistics(UUID) IS 'Returns statistical information about a snapshot';
