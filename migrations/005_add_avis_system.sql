-- Create avis (reviews) table
CREATE TABLE avis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auteur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auteur_nom VARCHAR(255),
  destinataire_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note INTEGER NOT NULL CHECK (note >= 1 AND note <= 5),
  commentaire TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast queries
CREATE INDEX idx_avis_destinataire ON avis(destinataire_id);
CREATE INDEX idx_avis_auteur ON avis(auteur_id);
CREATE INDEX idx_avis_created ON avis(created_at DESC);

-- RLS Policies for avis table
ALTER TABLE avis ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view avis written about them
CREATE POLICY "Users can view their own avis"
  ON avis FOR SELECT
  USING (destinataire_id = auth.uid());

-- Policy: Users can view avis they wrote
CREATE POLICY "Users can view avis they wrote"
  ON avis FOR SELECT
  USING (auteur_id = auth.uid());

-- Policy: Authenticated users can create avis
CREATE POLICY "Authenticated users can create avis"
  ON avis FOR INSERT
  WITH CHECK (auteur_id = auth.uid());

-- Policy: Users can update their own avis
CREATE POLICY "Users can update their own avis"
  ON avis FOR UPDATE
  USING (auteur_id = auth.uid())
  WITH CHECK (auteur_id = auth.uid());

-- Policy: Users can delete their own avis
CREATE POLICY "Users can delete their own avis"
  ON avis FOR DELETE
  USING (auteur_id = auth.uid());

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_avis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_avis_timestamp
BEFORE UPDATE ON avis
FOR EACH ROW
EXECUTE FUNCTION update_avis_updated_at();
