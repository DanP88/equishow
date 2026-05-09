-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) POLICIES - EQUISHOW
-- ═══════════════════════════════════════════════════════════════════════════
--
-- These policies enforce data access control at the database level
-- ensuring users can only access their own data based on their role
--

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. USERS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
ON users FOR SELECT
USING (auth.uid() = id);

-- Admins can read all users
CREATE POLICY "Admins can read all users"
ON users FOR SELECT
USING (auth.jwt() ->> 'email' IN (SELECT email FROM users WHERE id = auth.uid()));

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Only authenticated users can insert (during signup)
CREATE POLICY "Authenticated users can create profile"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. CHEVAUX TABLE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE chevaux ENABLE ROW LEVEL SECURITY;

-- Users can read their own horses
CREATE POLICY "Users can read own horses"
ON chevaux FOR SELECT
USING (auth.uid() = proprietaire_id);

-- Users can create horses for themselves
CREATE POLICY "Users can create own horses"
ON chevaux FOR INSERT
WITH CHECK (auth.uid() = proprietaire_id);

-- Users can update their own horses
CREATE POLICY "Users can update own horses"
ON chevaux FOR UPDATE
USING (auth.uid() = proprietaire_id)
WITH CHECK (auth.uid() = proprietaire_id);

-- Users can delete their own horses
CREATE POLICY "Users can delete own horses"
ON chevaux FOR DELETE
USING (auth.uid() = proprietaire_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CONCOURS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE concours ENABLE ROW LEVEL SECURITY;

-- Everyone can read published concours
CREATE POLICY "Anyone can read published concours"
ON concours FOR SELECT
USING (statut != 'brouillon' OR auth.uid() = organisateur_id);

-- Organisateurs can read their own draft concours
CREATE POLICY "Organisateurs can read own draft concours"
ON concours FOR SELECT
USING (auth.uid() = organisateur_id AND statut = 'brouillon');

-- Organisateurs can create concours
CREATE POLICY "Organisateurs can create concours"
ON concours FOR INSERT
WITH CHECK (auth.uid() = organisateur_id);

-- Organisateurs can update their own concours
CREATE POLICY "Organisateurs can update own concours"
ON concours FOR UPDATE
USING (auth.uid() = organisateur_id)
WITH CHECK (auth.uid() = organisateur_id);

-- Organisateurs can delete their own concours
CREATE POLICY "Organisateurs can delete own concours"
ON concours FOR DELETE
USING (auth.uid() = organisateur_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. COACH_ANNONCES TABLE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE coach_annonces ENABLE ROW LEVEL SECURITY;

-- Everyone can read published coach annonces
CREATE POLICY "Anyone can read coach annonces"
ON coach_annonces FOR SELECT
USING (true);

-- Coaches can create annonces
CREATE POLICY "Coaches can create annonces"
ON coach_annonces FOR INSERT
WITH CHECK (auth.uid() = auteur_id);

-- Coaches can read their own annonces
CREATE POLICY "Coaches can read own annonces"
ON coach_annonces FOR SELECT
USING (auth.uid() = auteur_id);

-- Coaches can update their own annonces
CREATE POLICY "Coaches can update own annonces"
ON coach_annonces FOR UPDATE
USING (auth.uid() = auteur_id)
WITH CHECK (auth.uid() = auteur_id);

-- Coaches can delete their own annonces
CREATE POLICY "Coaches can delete own annonces"
ON coach_annonces FOR DELETE
USING (auth.uid() = auteur_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. DISPONIBILITES TABLE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE disponibilites ENABLE ROW LEVEL SECURITY;

-- Everyone can read availabilities
CREATE POLICY "Anyone can read disponibilites"
ON disponibilites FOR SELECT
USING (true);

-- Coaches can create availabilities for their annonces
CREATE POLICY "Coaches can create disponibilites"
ON disponibilites FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT auteur_id FROM coach_annonces WHERE id = annonce_id
  )
);

-- Coaches can update their own availabilities
CREATE POLICY "Coaches can update own disponibilites"
ON disponibilites FOR UPDATE
USING (
  auth.uid() IN (
    SELECT auteur_id FROM coach_annonces WHERE id = annonce_id
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT auteur_id FROM coach_annonces WHERE id = annonce_id
  )
);

-- Coaches can delete their own availabilities
CREATE POLICY "Coaches can delete own disponibilites"
ON disponibilites FOR DELETE
USING (
  auth.uid() IN (
    SELECT auteur_id FROM coach_annonces WHERE id = annonce_id
  )
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. TRANSPORT_ANNONCES TABLE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE transport_annonces ENABLE ROW LEVEL SECURITY;

-- Everyone can read transport annonces
CREATE POLICY "Anyone can read transport annonces"
ON transport_annonces FOR SELECT
USING (true);

-- Users can create transport annonces
CREATE POLICY "Users can create transport annonces"
ON transport_annonces FOR INSERT
WITH CHECK (auth.uid() = auteur_id);

-- Users can update their own annonces
CREATE POLICY "Users can update own transport annonces"
ON transport_annonces FOR UPDATE
USING (auth.uid() = auteur_id)
WITH CHECK (auth.uid() = auteur_id);

-- Users can delete their own annonces
CREATE POLICY "Users can delete own transport annonces"
ON transport_annonces FOR DELETE
USING (auth.uid() = auteur_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. BOX_ANNONCES TABLE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE box_annonces ENABLE ROW LEVEL SECURITY;

-- Everyone can read box annonces
CREATE POLICY "Anyone can read box annonces"
ON box_annonces FOR SELECT
USING (true);

-- Users can create box annonces
CREATE POLICY "Users can create box annonces"
ON box_annonces FOR INSERT
WITH CHECK (auth.uid() = auteur_id);

-- Users can update their own annonces
CREATE POLICY "Users can update own box annonces"
ON box_annonces FOR UPDATE
USING (auth.uid() = auteur_id)
WITH CHECK (auth.uid() = auteur_id);

-- Users can delete their own annonces
CREATE POLICY "Users can delete own box annonces"
ON box_annonces FOR DELETE
USING (auth.uid() = auteur_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. NOTIFICATIONS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

-- System can create notifications (via Edge Function)
CREATE POLICY "System can create notifications"
ON notifications FOR INSERT
WITH CHECK (true);

-- Users can update their own notifications
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
ON notifications FOR DELETE
USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════════════

-- Auth-based indexes for fast RLS filtering
CREATE INDEX IF NOT EXISTS idx_chevaux_proprietaire_id ON chevaux(proprietaire_id);
CREATE INDEX IF NOT EXISTS idx_concours_organisateur_id ON concours(organisateur_id);
CREATE INDEX IF NOT EXISTS idx_coach_annonces_auteur_id ON coach_annonces(auteur_id);
CREATE INDEX IF NOT EXISTS idx_transport_annonces_auteur_id ON transport_annonces(auteur_id);
CREATE INDEX IF NOT EXISTS idx_box_annonces_auteur_id ON box_annonces(auteur_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_disponibilites_annonce_id ON disponibilites(annonce_id);

-- Status-based indexes
CREATE INDEX IF NOT EXISTS idx_concours_statut ON concours(statut);
CREATE INDEX IF NOT EXISTS idx_notifications_est_lue ON notifications(est_lue);

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! RLS is now enabled and enforced at database level
-- ═══════════════════════════════════════════════════════════════════════════
