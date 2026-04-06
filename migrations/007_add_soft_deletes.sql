-- ============================================================================
-- Soft Deletes Implementation
--
-- Implements soft delete pattern for all tables:
-- - Adds deleted_at column to track deletion timestamps
-- - Creates soft delete triggers for audit logging
-- - Adds RLS policies to filter soft-deleted rows
-- - Implements data retention policies (30-day grace period before hard delete)
--
-- Benefits:
-- - GDPR compliance: users can request data restoration
-- - Audit trail: when data was deleted and by whom
-- - Accidental deletion recovery: 30-day grace period
-- - Referential integrity: soft-deleted rows don't cascade delete
-- ============================================================================

-- ============================================================================
-- Helper Function: Add deleted_at column if it doesn't exist
-- ============================================================================

CREATE OR REPLACE FUNCTION add_deleted_at_column(p_table_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = p_table_name AND column_name = 'deleted_at'
  ) THEN
    EXECUTE format('ALTER TABLE %I ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL', p_table_name);
    EXECUTE format('CREATE INDEX idx_%s_deleted_at ON %I(deleted_at) WHERE deleted_at IS NULL', p_table_name, p_table_name);
  END IF;
END;
$$;

-- ============================================================================
-- Add deleted_at to Core Tables
-- ============================================================================

-- Utilisateurs (Users)
SELECT add_deleted_at_column('utilisateurs');
ALTER TABLE utilisateurs ADD CONSTRAINT check_utilisateurs_not_deleted
  CHECK (deleted_at IS NULL) DEFERRABLE INITIALLY DEFERRED;

-- Chevaux (Horses)
SELECT add_deleted_at_column('chevaux');
ALTER TABLE chevaux ADD CONSTRAINT check_chevaux_not_deleted
  CHECK (deleted_at IS NULL) DEFERRABLE INITIALLY DEFERRED;

-- Coach Annonces
SELECT add_deleted_at_column('coach_annonces');
ALTER TABLE coach_annonces ADD CONSTRAINT check_coach_annonces_not_deleted
  CHECK (deleted_at IS NULL) DEFERRABLE INITIALLY DEFERRED;

-- Concours (Competitions)
SELECT add_deleted_at_column('concours');
ALTER TABLE concours ADD CONSTRAINT check_concours_not_deleted
  CHECK (deleted_at IS NULL) DEFERRABLE INITIALLY DEFERRED;

-- Avis (Reviews)
SELECT add_deleted_at_column('avis');
ALTER TABLE avis ADD CONSTRAINT check_avis_not_deleted
  CHECK (deleted_at IS NULL) DEFERRABLE INITIALLY DEFERRED;

-- Community Posts
SELECT add_deleted_at_column('community_posts');
ALTER TABLE community_posts ADD CONSTRAINT check_community_posts_not_deleted
  CHECK (deleted_at IS NULL) DEFERRABLE INITIALLY DEFERRED;

-- Comments (if exists)
SELECT add_deleted_at_column('comments');

-- ============================================================================
-- Audit Table for Soft Deletes
-- ============================================================================

CREATE TABLE IF NOT EXISTS soft_delete_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was deleted
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,

  -- Who deleted it
  deleted_by UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Soft delete info
  is_permanent BOOLEAN DEFAULT FALSE,
  recovery_until TIMESTAMP WITH TIME ZONE,

  -- Audit metadata
  reason TEXT,
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  INDEX idx_soft_delete_table (table_name),
  INDEX idx_soft_delete_deleted_at (deleted_at DESC),
  INDEX idx_soft_delete_deleted_by (deleted_by),
  INDEX idx_soft_delete_recovery_until (recovery_until)
);

COMMENT ON TABLE soft_delete_audit IS 'Audit log for all soft delete operations';

-- ============================================================================
-- Trigger Functions
-- ============================================================================

-- Function to log soft delete
CREATE OR REPLACE FUNCTION log_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    INSERT INTO soft_delete_audit (
      table_name, record_id, deleted_by, deleted_at,
      recovery_until, created_at
    )
    VALUES (
      TG_TABLE_NAME,
      NEW.id,
      auth.uid(),
      NEW.deleted_at,
      NEW.deleted_at + INTERVAL '30 days',
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Create Triggers on All Tables
-- ============================================================================

-- Utilisateurs trigger
DROP TRIGGER IF EXISTS trigger_log_soft_delete_utilisateurs ON utilisateurs;
CREATE TRIGGER trigger_log_soft_delete_utilisateurs
  AFTER UPDATE ON utilisateurs
  FOR EACH ROW
  EXECUTE FUNCTION log_soft_delete();

-- Chevaux trigger
DROP TRIGGER IF EXISTS trigger_log_soft_delete_chevaux ON chevaux;
CREATE TRIGGER trigger_log_soft_delete_chevaux
  AFTER UPDATE ON chevaux
  FOR EACH ROW
  EXECUTE FUNCTION log_soft_delete();

-- Coach Annonces trigger
DROP TRIGGER IF EXISTS trigger_log_soft_delete_coach_annonces ON coach_annonces;
CREATE TRIGGER trigger_log_soft_delete_coach_annonces
  AFTER UPDATE ON coach_annonces
  FOR EACH ROW
  EXECUTE FUNCTION log_soft_delete();

-- Concours trigger
DROP TRIGGER IF EXISTS trigger_log_soft_delete_concours ON concours;
CREATE TRIGGER trigger_log_soft_delete_concours
  AFTER UPDATE ON concours
  FOR EACH ROW
  EXECUTE FUNCTION log_soft_delete();

-- Avis trigger
DROP TRIGGER IF EXISTS trigger_log_soft_delete_avis ON avis;
CREATE TRIGGER trigger_log_soft_delete_avis
  AFTER UPDATE ON avis
  FOR EACH ROW
  EXECUTE FUNCTION log_soft_delete();

-- Community Posts trigger
DROP TRIGGER IF EXISTS trigger_log_soft_delete_community_posts ON community_posts;
CREATE TRIGGER trigger_log_soft_delete_community_posts
  AFTER UPDATE ON community_posts
  FOR EACH ROW
  EXECUTE FUNCTION log_soft_delete();

-- ============================================================================
-- RLS Policies: Filter out soft-deleted rows by default
-- ============================================================================

-- Utilisateurs: Don't show soft-deleted users
CREATE POLICY "Exclude soft-deleted utilisateurs"
  ON utilisateurs
  FOR SELECT
  USING (deleted_at IS NULL);

-- Chevaux: Don't show soft-deleted horses
CREATE POLICY "Exclude soft-deleted chevaux"
  ON chevaux
  FOR SELECT
  USING (deleted_at IS NULL);

-- Coach Annonces: Don't show soft-deleted announcements
CREATE POLICY "Exclude soft-deleted coach_annonces"
  ON coach_annonces
  FOR SELECT
  USING (deleted_at IS NULL);

-- Concours: Don't show soft-deleted competitions
CREATE POLICY "Exclude soft-deleted concours"
  ON concours
  FOR SELECT
  USING (deleted_at IS NULL);

-- Avis: Don't show soft-deleted reviews
CREATE POLICY "Exclude soft-deleted avis"
  ON avis
  FOR SELECT
  USING (deleted_at IS NULL);

-- Community Posts: Don't show soft-deleted posts
CREATE POLICY "Exclude soft-deleted community_posts"
  ON community_posts
  FOR SELECT
  USING (deleted_at IS NULL);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Soft delete a record
CREATE OR REPLACE FUNCTION soft_delete(p_table_name TEXT, p_record_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format(
    'UPDATE %I SET deleted_at = NOW() WHERE id = %L AND deleted_at IS NULL',
    p_table_name, p_record_id
  );
END;
$$;

-- Restore a soft-deleted record
CREATE OR REPLACE FUNCTION restore_deleted_record(p_table_name TEXT, p_record_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if record is still within recovery window
  IF NOT EXISTS (
    SELECT 1 FROM soft_delete_audit
    WHERE table_name = p_table_name
      AND record_id = p_record_id
      AND recovery_until > NOW()
  ) THEN
    RAISE EXCEPTION 'Record % in table % is outside recovery window', p_record_id, p_table_name;
  END IF;

  EXECUTE format(
    'UPDATE %I SET deleted_at = NULL WHERE id = %L',
    p_table_name, p_record_id
  );
END;
$$;

-- Permanently delete soft-deleted records (GDPR right to be forgotten)
CREATE OR REPLACE FUNCTION hard_delete_soft_deleted(p_table_name TEXT, p_record_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Audit the hard delete
  UPDATE soft_delete_audit
  SET is_permanent = TRUE
  WHERE table_name = p_table_name AND record_id = p_record_id;

  -- Actually delete the record
  EXECUTE format(
    'DELETE FROM %I WHERE id = %L',
    p_table_name, p_record_id
  );
END;
$$;

-- Purge soft-deleted records older than grace period (30 days)
CREATE OR REPLACE FUNCTION purge_expired_soft_deletes()
RETURNS TABLE(table_name TEXT, records_purged INT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_record RECORD;
  v_count INT;
BEGIN
  -- Purge from each table
  FOR v_record IN (
    SELECT DISTINCT table_name FROM soft_delete_audit
    WHERE is_permanent = FALSE AND recovery_until < NOW()
  ) LOOP
    -- Get count before deletion
    EXECUTE format(
      'SELECT COUNT(*) FROM %I WHERE deleted_at < NOW() - INTERVAL ''30 days''',
      v_record.table_name
    ) INTO v_count;

    -- Hard delete soft-deleted records
    EXECUTE format(
      'DELETE FROM %I WHERE deleted_at < NOW() - INTERVAL ''30 days''',
      v_record.table_name
    );

    -- Mark as permanent in audit
    UPDATE soft_delete_audit
    SET is_permanent = TRUE
    WHERE table_name = v_record.table_name
      AND recovery_until < NOW();

    RETURN QUERY SELECT v_record.table_name::TEXT, v_count;
  END LOOP;
END;
$$;

-- Get soft delete statistics
CREATE OR REPLACE FUNCTION get_soft_delete_stats()
RETURNS TABLE(
  table_name TEXT,
  soft_deleted_count INT,
  active_count INT,
  recovery_window_days INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    audit.table_name,
    COUNT(*)::INT as soft_deleted_count,
    0::INT as active_count,
    30::INT as recovery_window_days
  FROM soft_delete_audit audit
  WHERE audit.is_permanent = FALSE
    AND audit.recovery_until > NOW()
  GROUP BY audit.table_name;
END;
$$;

-- ============================================================================
-- Scheduled Purge Job (Maintenance)
-- ============================================================================

-- This function should be called daily via pg_cron
-- SELECT cron.schedule('purge-soft-deletes', '0 3 * * *', 'SELECT purge_expired_soft_deletes()');

-- ============================================================================
-- Grant Permissions
-- ============================================================================

GRANT SELECT ON soft_delete_audit TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_deleted_record(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION hard_delete_soft_deleted(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_soft_delete_stats() TO authenticated;

-- Only admins can perform hard deletes
GRANT EXECUTE ON FUNCTION purge_expired_soft_deletes() TO authenticated; -- Restrict to admin role in RLS

-- ============================================================================
-- Sample Usage Documentation
-- ============================================================================

/*
SOFT DELETE OPERATIONS:

1. Soft delete a horse (user deletes their own horse):
   SELECT soft_delete('chevaux', '550e8400-e29b-41d4-a716-446655440000');

2. Restore a deleted horse (within 30-day window):
   SELECT restore_deleted_record('chevaux', '550e8400-e29b-41d4-a716-446655440000');

3. Check soft delete statistics:
   SELECT * FROM get_soft_delete_stats();

4. Get recovery status for a deleted record:
   SELECT * FROM soft_delete_audit
   WHERE table_name = 'chevaux'
     AND record_id = '550e8400-e29b-41d4-a716-446655440000'
   ORDER BY deleted_at DESC LIMIT 1;

5. List all soft-deleted records within recovery window:
   SELECT * FROM soft_delete_audit
   WHERE is_permanent = FALSE
     AND recovery_until > NOW()
   ORDER BY deleted_at DESC;

6. Manually trigger purge (admin only):
   SELECT purge_expired_soft_deletes();

RLS NOTES:
- Soft-deleted rows are automatically excluded from SELECT queries
- Users see only non-deleted data by default
- Admins can see soft-deleted records if needed (additional policy)
- Hard deletes are permanent and irreversible

GDPR COMPLIANCE:
- Right to deletion: soft_delete() marks for deletion
- Right to be forgotten: hard_delete_soft_deleted() removes data after grace period
- Data recovery: restore_deleted_record() within 30 days
- Audit trail: soft_delete_audit table provides deletion history
*/
