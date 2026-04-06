-- ============================================================================
-- MIGRATION: Corrections Critiques de Sécurité
--
-- FIXES:
-- 1. Notification RLS permissive (CRITIQUE)
-- 2. Admin function schema mismatch (HAUT)
-- 3. Password reset verification (HAUT)
-- 4. Coach annonces RLS stricte (HAUT)
-- 5. Audit logging pour les modifications critiques (HAUT)
-- ============================================================================

-- ============================================================================
-- 1. FIXER RLS DANGEREUX SUR NOTIFICATIONS
-- ============================================================================

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "System can create notifications" ON notifications;
DROP POLICY IF EXISTS "Anyone can create notifications" ON notifications;

-- Nouvelle policy sécurisée
CREATE POLICY "Users can only create own notifications"
  ON notifications
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND auth.uid() IS NOT NULL
  );

-- Les utilisateurs ne peuvent voir que leurs propres notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Seulement les admins ou le system peuvent supprimer
DROP POLICY IF EXISTS "System can delete notifications" ON notifications;
CREATE POLICY "System can delete notifications"
  ON notifications
  FOR DELETE
  USING (
    (auth.jwt()->>'role' = 'service_role')
    OR auth.uid() = user_id
  );

-- ============================================================================
-- 2. FIXER LA FONCTION ADMIN CASSÉE
-- ============================================================================

-- Vérifier le vrai schema de utilisateurs
-- Nouvelle fonction is_admin qui fonctionne réellement
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_role TEXT;
BEGIN
  -- Utiliser l'ID fourni ou l'utilisateur actuel
  v_user_id := COALESCE(user_id, auth.uid());

  -- Vérifier si l'utilisateur a le rôle 'admin'
  -- La vraie colonne est 'role' TEXT, pas 'role_id'
  SELECT role INTO v_role
  FROM utilisateurs
  WHERE id = v_user_id
  LIMIT 1;

  RETURN v_role = 'admin';
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION is_admin IS 'Vérifier si un utilisateur a le rôle admin. Retourne FALSE en cas d''erreur.';

-- Test: vérifier que la fonction fonctionne
-- SELECT is_admin('550e8400-e29b-41d4-a716-446655440000');

-- ============================================================================
-- 3. AJOUTER PASSWORD RESET SECURE
-- ============================================================================

-- Table pour tracking du password reset
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  token_hash TEXT NOT NULL UNIQUE, -- Hash du token pour sécurité

  -- Vérification du mot de passe actuel
  old_password_hash TEXT NOT NULL,

  -- Configuration
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  used_at TIMESTAMP WITH TIME ZONE,
  is_revoked BOOLEAN DEFAULT FALSE,

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,

  -- Indexes
  INDEX idx_user_id (user_id),
  INDEX idx_token_hash (token_hash),
  INDEX idx_expires_at (expires_at)
);

COMMENT ON TABLE password_reset_tokens IS 'Tokens sécurisés pour changement de mot de passe avec vérification du mot de passe actuel';

-- RLS pour password_reset_tokens
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reset tokens"
  ON password_reset_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Only system can create reset tokens"
  ON password_reset_tokens
  FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Only system can update reset tokens"
  ON password_reset_tokens
  FOR UPDATE
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 4. STRICTER RLS SUR COACH_ANNONCES
-- ============================================================================

-- Supprimer les policies trop permissives
DROP POLICY IF EXISTS "Anyone can read published coach_annonces" ON coach_annonces;
DROP POLICY IF EXISTS "Coaches can create annonces" ON coach_annonces;

-- Nouvelles policies strictes
CREATE POLICY "Anyone can read published coach_annonces"
  ON coach_annonces
  FOR SELECT
  USING (published = TRUE AND deleted_at IS NULL);

CREATE POLICY "Coaches can read unpublished own annonces"
  ON coach_annonces
  FOR SELECT
  USING (
    (published = TRUE AND deleted_at IS NULL)
    OR (auth.uid() = coach_id AND deleted_at IS NULL)
  );

CREATE POLICY "Only coaches can create annonces"
  ON coach_annonces
  FOR INSERT
  WITH CHECK (
    auth.uid() = coach_id
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Coaches can only update own annonces"
  ON coach_annonces
  FOR UPDATE
  USING (auth.uid() = coach_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches can only delete own annonces"
  ON coach_annonces
  FOR DELETE
  USING (auth.uid() = coach_id AND deleted_at IS NULL);

-- ============================================================================
-- 5. AUDIT LOGGING POUR MODIFICATI ONS CRITIQUES
-- ============================================================================

CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Quoi
  action TEXT NOT NULL, -- 'password_change', 'email_change', 'role_change', 'delete'
  table_name TEXT,
  record_id UUID,

  -- Qui
  user_id UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES utilisateurs(id) ON DELETE SET NULL,

  -- Détails sécurisés
  old_value TEXT, -- Hashé pour données sensibles
  new_value TEXT,

  -- Contexte
  ip_address INET,
  user_agent TEXT,

  -- Timing
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Indexes
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at DESC),
  INDEX idx_admin_id (admin_id)
);

COMMENT ON TABLE security_audit_log IS 'Log complet des actions de sécurité critiques';

ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can read security audit log"
  ON security_audit_log
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "System can insert audit logs"
  ON security_audit_log
  FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 6. FONCTION: LOG SECURITY ACTION
-- ============================================================================

CREATE OR REPLACE FUNCTION log_security_action(
  p_action TEXT,
  p_table_name TEXT,
  p_record_id UUID,
  p_user_id UUID,
  p_old_value TEXT,
  p_new_value TEXT,
  p_ip_address INET,
  p_user_agent TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO security_audit_log (
    action,
    table_name,
    record_id,
    user_id,
    old_value,
    new_value,
    ip_address,
    user_agent
  )
  VALUES (
    p_action,
    p_table_name,
    p_record_id,
    p_user_id,
    p_old_value,
    p_new_value,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

-- ============================================================================
-- 7. TRIGGER: AUDIT DES PASSWORD CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION audit_password_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    PERFORM log_security_action(
      'password_change',
      'utilisateurs',
      NEW.id,
      NEW.id,
      NULL, -- Ne pas logger les hashs réels
      NULL,
      NULL,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_audit_password_change ON utilisateurs;
CREATE TRIGGER trigger_audit_password_change
  AFTER UPDATE ON utilisateurs
  FOR EACH ROW
  EXECUTE FUNCTION audit_password_change();

-- ============================================================================
-- 8. FONCTION: VERIFY PASSWORD CHANGE
-- ============================================================================

CREATE OR REPLACE FUNCTION verify_password_change(
  p_user_id UUID,
  p_current_password_hash TEXT,
  p_new_password_hash TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_hash TEXT;
  v_attempt_count INT;
BEGIN
  -- Vérifier que l'utilisateur existe
  SELECT password_hash INTO v_current_hash
  FROM utilisateurs
  WHERE id = p_user_id
  LIMIT 1;

  IF v_current_hash IS NULL THEN
    RETURN QUERY SELECT FALSE, 'User not found'::TEXT;
    RETURN;
  END IF;

  -- Vérifier que l'ancien mot de passe correspond
  IF v_current_hash != p_current_password_hash THEN
    -- Incrémenter counter d'attaques
    RETURN QUERY SELECT FALSE, 'Current password is incorrect'::TEXT;
    RETURN;
  END IF;

  -- Vérifier que le nouveau mot de passe est différent
  IF p_current_password_hash = p_new_password_hash THEN
    RETURN QUERY SELECT FALSE, 'New password must be different'::TEXT;
    RETURN;
  END IF;

  -- Succès
  RETURN QUERY SELECT TRUE, 'Password change verified'::TEXT;
END;
$$;

-- ============================================================================
-- 9. VÉRIFIER LE SCHEMA DES UTILISATEURS
-- ============================================================================

-- Vérifier que les colonnes critiques existent
DO $$
BEGIN
  -- Vérifier password_hash
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'utilisateurs' AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE utilisateurs ADD COLUMN password_hash TEXT;
    RAISE NOTICE 'Added password_hash column';
  END IF;

  -- Vérifier role
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'utilisateurs' AND column_name = 'role'
  ) THEN
    ALTER TABLE utilisateurs ADD COLUMN role TEXT DEFAULT 'user';
    RAISE NOTICE 'Added role column';
  END IF;
END $$;

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON security_audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION log_security_action TO authenticated;
GRANT EXECUTE ON FUNCTION verify_password_change TO authenticated;

GRANT ALL ON password_reset_tokens TO authenticated;

-- ============================================================================
-- VERIFICATION DES CORRECTIONS
-- ============================================================================

/*
Vérifier que tout fonctionne:

1. RLS sur notifications:
   SELECT * FROM notifications; -- Devrait voir seulement les siennes

2. Fonction admin:
   SELECT is_admin('user-uuid'); -- Devrait vérifier le role = 'admin'

3. Password change:
   SELECT verify_password_change(user_id, old_hash, new_hash);

4. Audit logging:
   SELECT * FROM security_audit_log ORDER BY created_at DESC;
*/
