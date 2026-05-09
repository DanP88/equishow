-- Migration: Add community posts (general, coach-only, org-only) with comments

-- Posts Community table (visible by EVERYONE)
CREATE TABLE IF NOT EXISTS posts_community (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auteur_id UUID NOT NULL REFERENCES users(id),
  auteur_nom VARCHAR(255),
  titre VARCHAR(255) NOT NULL,
  contenu TEXT NOT NULL,
  image_url TEXT,
  nb_likes INT DEFAULT 0,
  nb_commentaires INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comments for posts_community
CREATE TABLE IF NOT EXISTS com_posts_community (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts_community(id) ON DELETE CASCADE,
  auteur_id UUID NOT NULL REFERENCES users(id),
  auteur_nom VARCHAR(255),
  contenu TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Posts Coach table (visible ONLY by coaches)
CREATE TABLE IF NOT EXISTS posts_coach (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auteur_id UUID NOT NULL REFERENCES users(id),
  auteur_nom VARCHAR(255),
  titre VARCHAR(255) NOT NULL,
  contenu TEXT NOT NULL,
  image_url TEXT,
  nb_likes INT DEFAULT 0,
  nb_commentaires INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comments for posts_coach
CREATE TABLE IF NOT EXISTS com_posts_coach (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts_coach(id) ON DELETE CASCADE,
  auteur_id UUID NOT NULL REFERENCES users(id),
  auteur_nom VARCHAR(255),
  contenu TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Posts Organisateur table (visible ONLY by organisateurs)
CREATE TABLE IF NOT EXISTS posts_organisateur (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auteur_id UUID NOT NULL REFERENCES users(id),
  auteur_nom VARCHAR(255),
  titre VARCHAR(255) NOT NULL,
  contenu TEXT NOT NULL,
  image_url TEXT,
  nb_likes INT DEFAULT 0,
  nb_commentaires INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comments for posts_organisateur
CREATE TABLE IF NOT EXISTS com_posts_organisateur (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts_organisateur(id) ON DELETE CASCADE,
  auteur_id UUID NOT NULL REFERENCES users(id),
  auteur_nom VARCHAR(255),
  contenu TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on all tables
ALTER TABLE posts_community ENABLE ROW LEVEL SECURITY;
ALTER TABLE com_posts_community ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts_coach ENABLE ROW LEVEL SECURITY;
ALTER TABLE com_posts_coach ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts_organisateur ENABLE ROW LEVEL SECURITY;
ALTER TABLE com_posts_organisateur ENABLE ROW LEVEL SECURITY;

-- ========== RLS for posts_community (visible and editable by EVERYONE) ==========
CREATE POLICY "Anyone can read posts_community"
ON posts_community FOR SELECT
USING (true);

CREATE POLICY "Anyone can create posts_community"
ON posts_community FOR INSERT
WITH CHECK (auth.uid() = auteur_id);

CREATE POLICY "Users can update own posts_community"
ON posts_community FOR UPDATE
USING (auth.uid() = auteur_id);

CREATE POLICY "Users can delete own posts_community"
ON posts_community FOR DELETE
USING (auth.uid() = auteur_id);

-- RLS for com_posts_community (visible and editable by EVERYONE)
CREATE POLICY "Anyone can read com_posts_community"
ON com_posts_community FOR SELECT
USING (true);

CREATE POLICY "Anyone can create com_posts_community"
ON com_posts_community FOR INSERT
WITH CHECK (auth.uid() = auteur_id);

CREATE POLICY "Users can update own com_posts_community"
ON com_posts_community FOR UPDATE
USING (auth.uid() = auteur_id);

CREATE POLICY "Users can delete own com_posts_community"
ON com_posts_community FOR DELETE
USING (auth.uid() = auteur_id);

-- ========== RLS for posts_coach (visible and editable by COACHES ONLY) ==========
CREATE POLICY "Only coaches can read posts_coach"
ON posts_coach FOR SELECT
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'coach'
);

CREATE POLICY "Only coaches can create posts_coach"
ON posts_coach FOR INSERT
WITH CHECK (
  auth.uid() = auteur_id AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'coach'
);

CREATE POLICY "Coaches can update own posts_coach"
ON posts_coach FOR UPDATE
USING (
  auth.uid() = auteur_id AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'coach'
);

CREATE POLICY "Coaches can delete own posts_coach"
ON posts_coach FOR DELETE
USING (
  auth.uid() = auteur_id AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'coach'
);

-- RLS for com_posts_coach (visible and editable by COACHES ONLY)
CREATE POLICY "Only coaches can read com_posts_coach"
ON com_posts_coach FOR SELECT
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'coach'
);

CREATE POLICY "Only coaches can create com_posts_coach"
ON com_posts_coach FOR INSERT
WITH CHECK (
  auth.uid() = auteur_id AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'coach'
);

CREATE POLICY "Coaches can update own com_posts_coach"
ON com_posts_coach FOR UPDATE
USING (
  auth.uid() = auteur_id AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'coach'
);

CREATE POLICY "Coaches can delete own com_posts_coach"
ON com_posts_coach FOR DELETE
USING (
  auth.uid() = auteur_id AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'coach'
);

-- ========== RLS for posts_organisateur (visible and editable by ORGANISATEURS ONLY) ==========
CREATE POLICY "Only organisateurs can read posts_organisateur"
ON posts_organisateur FOR SELECT
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'organisateur'
);

CREATE POLICY "Only organisateurs can create posts_organisateur"
ON posts_organisateur FOR INSERT
WITH CHECK (
  auth.uid() = auteur_id AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'organisateur'
);

CREATE POLICY "Organisateurs can update own posts_organisateur"
ON posts_organisateur FOR UPDATE
USING (
  auth.uid() = auteur_id AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'organisateur'
);

CREATE POLICY "Organisateurs can delete own posts_organisateur"
ON posts_organisateur FOR DELETE
USING (
  auth.uid() = auteur_id AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'organisateur'
);

-- RLS for com_posts_organisateur (visible and editable by ORGANISATEURS ONLY)
CREATE POLICY "Only organisateurs can read com_posts_organisateur"
ON com_posts_organisateur FOR SELECT
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'organisateur'
);

CREATE POLICY "Only organisateurs can create com_posts_organisateur"
ON com_posts_organisateur FOR INSERT
WITH CHECK (
  auth.uid() = auteur_id AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'organisateur'
);

CREATE POLICY "Organisateurs can update own com_posts_organisateur"
ON com_posts_organisateur FOR UPDATE
USING (
  auth.uid() = auteur_id AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'organisateur'
);

CREATE POLICY "Organisateurs can delete own com_posts_organisateur"
ON com_posts_organisateur FOR DELETE
USING (
  auth.uid() = auteur_id AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'organisateur'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_community_auteur ON posts_community(auteur_id);
CREATE INDEX IF NOT EXISTS idx_posts_community_created ON posts_community(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_com_posts_community_post ON com_posts_community(post_id);
CREATE INDEX IF NOT EXISTS idx_com_posts_community_auteur ON com_posts_community(auteur_id);
CREATE INDEX IF NOT EXISTS idx_posts_coach_auteur ON posts_coach(auteur_id);
CREATE INDEX IF NOT EXISTS idx_posts_coach_created ON posts_coach(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_com_posts_coach_post ON com_posts_coach(post_id);
CREATE INDEX IF NOT EXISTS idx_com_posts_coach_auteur ON com_posts_coach(auteur_id);
CREATE INDEX IF NOT EXISTS idx_posts_organisateur_auteur ON posts_organisateur(auteur_id);
CREATE INDEX IF NOT EXISTS idx_posts_organisateur_created ON posts_organisateur(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_com_posts_organisateur_post ON com_posts_organisateur(post_id);
CREATE INDEX IF NOT EXISTS idx_com_posts_organisateur_auteur ON com_posts_organisateur(auteur_id);
