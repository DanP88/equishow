-- ============================================================================
-- Backup Monitoring Tables
--
-- Tracks all backup operations and restoration events for audit and
-- disaster recovery procedures.
-- ============================================================================

-- Backup logs table
CREATE TABLE IF NOT EXISTS backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Backup metadata
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('daily', 'manual', 'snapshot', 'test')),
  description TEXT,

  -- Backup location
  s3_location TEXT, -- e.g., "s3://equishow-backups/daily/2026-04-06.sql.gz"
  supabase_backup_id TEXT,

  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'verified')),
  error_message TEXT,

  -- Size information
  size_bytes BIGINT,
  compressed_size_bytes BIGINT,

  -- Verification
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by TEXT,
  integrity_check_passed BOOLEAN,

  -- Metadata
  initiated_by TEXT,
  retention_days INT DEFAULT 365,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes for common queries
  INDEX idx_backup_timestamp (timestamp DESC),
  INDEX idx_backup_status (status),
  INDEX idx_backup_type (backup_type),
  INDEX idx_backup_created_at (created_at DESC),
  CONSTRAINT backup_timestamp_not_future CHECK (timestamp <= NOW())
);

-- Comment on backup_logs table
COMMENT ON TABLE backup_logs IS 'Records all backup operations for monitoring and recovery procedures';
COMMENT ON COLUMN backup_logs.backup_type IS 'Type of backup: daily automated, manual, snapshot, or test';
COMMENT ON COLUMN backup_logs.status IS 'Current status: pending, success, failed, or verified';
COMMENT ON COLUMN backup_logs.s3_location IS 'S3 path where backup is stored (if applicable)';
COMMENT ON COLUMN backup_logs.integrity_check_passed IS 'Set to true after successful restoration test';

-- Backup restoration history
CREATE TABLE IF NOT EXISTS backup_restores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Backup reference
  backup_id UUID NOT NULL REFERENCES backup_logs(id) ON DELETE CASCADE,

  -- Restoration details
  initiated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INT,

  -- Status
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'success', 'failed', 'rolled_back')),
  error_message TEXT,

  -- Environment
  source_environment TEXT, -- 'production'
  target_environment TEXT CHECK (target_environment IN ('staging', 'production')), -- Where restored
  restoration_reason TEXT NOT NULL, -- 'test', 'incident_recovery', 'manual_test', etc.

  -- Verification
  verification_passed BOOLEAN,
  verification_notes TEXT,

  -- Metadata
  initiated_by TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes
  INDEX idx_restore_backup_id (backup_id),
  INDEX idx_restore_initiated_at (initiated_at DESC),
  INDEX idx_restore_status (status),
  INDEX idx_restore_reason (restoration_reason)
);

COMMENT ON TABLE backup_restores IS 'Records all backup restoration events for audit and verification';
COMMENT ON COLUMN backup_restores.restoration_reason IS 'Purpose of restoration: test, incident_recovery, manual_test';
COMMENT ON COLUMN backup_restores.target_environment IS 'Target environment where backup is restored (usually staging for testing)';

-- Backup schedule tracking
CREATE TABLE IF NOT EXISTS backup_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Schedule details
  schedule_name TEXT NOT NULL UNIQUE, -- 'daily_full', 'hourly_incremental'
  backup_type TEXT NOT NULL REFERENCES backup_logs(backup_type),

  -- Cron schedule
  cron_expression TEXT NOT NULL, -- e.g., "0 4 * * *" for daily at 4 AM

  -- Configuration
  enabled BOOLEAN DEFAULT TRUE,
  retention_days INT DEFAULT 365,
  compression_enabled BOOLEAN DEFAULT TRUE,

  -- Last execution
  last_executed_at TIMESTAMP WITH TIME ZONE,
  last_status TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_schedule_enabled (enabled),
  INDEX idx_schedule_name (schedule_name)
);

COMMENT ON TABLE backup_schedule IS 'Configured backup schedules and their execution history';

-- Insert default backup schedules
INSERT INTO backup_schedule (schedule_name, backup_type, cron_expression, retention_days, enabled)
VALUES
  ('daily_full', 'daily', '0 4 * * *', 7, TRUE),
  ('monthly_long_term', 'snapshot', '0 2 1 * *', 365, TRUE)
ON CONFLICT (schedule_name) DO NOTHING;

-- Enable RLS on backup tables (only admins can view)
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_restores ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_schedule ENABLE ROW LEVEL SECURITY;

-- RLS policies (admin only)
CREATE POLICY "Only admins can view backup logs"
  ON backup_logs
  FOR SELECT
  USING (auth.jwt()->>'role' = 'admin' OR current_user_id() IN (SELECT id FROM utilisateurs WHERE role = 'admin'));

CREATE POLICY "Only admins can insert backup logs"
  ON backup_logs
  FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'admin');

CREATE POLICY "Only admins can view restores"
  ON backup_restores
  FOR SELECT
  USING (auth.jwt()->>'role' = 'admin' OR current_user_id() IN (SELECT id FROM utilisateurs WHERE role = 'admin'));

-- Grant permissions
GRANT SELECT ON backup_logs TO authenticated;
GRANT SELECT ON backup_restores TO authenticated;
GRANT INSERT ON backup_logs TO authenticated;
GRANT INSERT ON backup_restores TO authenticated;

-- Create indices for backup_logs table
CREATE INDEX IF NOT EXISTS idx_backup_logs_daily ON backup_logs(timestamp DESC) WHERE backup_type = 'daily';
CREATE INDEX IF NOT EXISTS idx_backup_logs_recent ON backup_logs(created_at DESC) WHERE status = 'success';
CREATE INDEX IF NOT EXISTS idx_backup_logs_size ON backup_logs(size_bytes DESC);

-- Create indices for backup_restores table
CREATE INDEX IF NOT EXISTS idx_restores_recent ON backup_restores(completed_at DESC) WHERE status = 'success';
CREATE INDEX IF NOT EXISTS idx_restores_incidents ON backup_restores(initiated_at DESC) WHERE restoration_reason LIKE '%incident%';

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to check if backup is recent
CREATE OR REPLACE FUNCTION is_recent_backup()
RETURNS TABLE(is_recent BOOLEAN, last_backup_age_hours INT)
LANGUAGE SQL
AS $$
  SELECT
    COALESCE(MAX(timestamp) > NOW() - INTERVAL '25 hours', FALSE) as is_recent,
    EXTRACT(HOUR FROM NOW() - MAX(timestamp))::INT as last_backup_age_hours
  FROM backup_logs
  WHERE status = 'success' AND backup_type = 'daily';
$$;

-- Function to get backup statistics
CREATE OR REPLACE FUNCTION get_backup_stats()
RETURNS TABLE(
  total_backups INT,
  successful_backups INT,
  failed_backups INT,
  average_size_mb NUMERIC,
  oldest_backup TIMESTAMP,
  newest_backup TIMESTAMP
)
LANGUAGE SQL
AS $$
  SELECT
    COUNT(*)::INT as total_backups,
    COUNT(*) FILTER (WHERE status = 'success')::INT as successful_backups,
    COUNT(*) FILTER (WHERE status = 'failed')::INT as failed_backups,
    ROUND(AVG(size_bytes) / 1024 / 1024, 2) as average_size_mb,
    MIN(timestamp) as oldest_backup,
    MAX(timestamp) as newest_backup
  FROM backup_logs
  WHERE created_at > NOW() - INTERVAL '90 days';
$$;

-- Function to record backup execution
CREATE OR REPLACE FUNCTION record_backup_execution(
  p_backup_type TEXT,
  p_status TEXT,
  p_size_bytes BIGINT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_s3_location TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_backup_id UUID;
BEGIN
  INSERT INTO backup_logs (
    timestamp, backup_type, status, size_bytes,
    error_message, s3_location, initiated_by
  )
  VALUES (
    NOW(), p_backup_type, p_status, p_size_bytes,
    p_error_message, p_s3_location, current_user
  )
  RETURNING id INTO v_backup_id;

  RETURN v_backup_id;
END;
$$;

-- ============================================================================
-- Security Events Integration
-- ============================================================================

-- Add backup-related events to security_events if needed
-- ALTER TABLE security_events ADD COLUMN IF NOT EXISTS backup_event BOOLEAN DEFAULT FALSE;
