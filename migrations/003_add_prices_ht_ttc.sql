-- Migration: Add HT (Hors Taxes) and TTC (Toutes Taxes Comprises) price columns
-- TVA: 20%

-- Concours table: Replace 'prix' with 'prix_ht' and 'prix_ttc'
ALTER TABLE concours
DROP COLUMN IF EXISTS prix;

ALTER TABLE concours
ADD COLUMN IF NOT EXISTS prix_ht DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS prix_ttc DECIMAL(10,2);

-- Coach Annonces table: Replace 'prix_heure' with 'prix_heure_ht' and 'prix_heure_ttc'
ALTER TABLE coach_annonces
DROP COLUMN IF EXISTS prix_heure;

ALTER TABLE coach_annonces
ADD COLUMN IF NOT EXISTS prix_heure_ht DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS prix_heure_ttc DECIMAL(10,2);

-- Transport Annonces table: Replace 'prix_km' with 'prix_km_ht' and 'prix_km_ttc'
ALTER TABLE transport_annonces
DROP COLUMN IF EXISTS prix_km;

ALTER TABLE transport_annonces
ADD COLUMN IF NOT EXISTS prix_km_ht DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS prix_km_ttc DECIMAL(10,2);

-- Box Annonces table: Replace 'prix_mois' with 'prix_mois_ht' and 'prix_mois_ttc'
ALTER TABLE box_annonces
DROP COLUMN IF EXISTS prix_mois;

ALTER TABLE box_annonces
ADD COLUMN IF NOT EXISTS prix_mois_ht DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS prix_mois_ttc DECIMAL(10,2);

-- Create function to calculate TTC (HT * 1.20 for 20% TVA)
CREATE OR REPLACE FUNCTION calculate_ttc(prix_ht DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
  RETURN ROUND(prix_ht * 1.20, 2);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate TTC prices on concours insert/update
CREATE OR REPLACE FUNCTION concours_calculate_ttc()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.prix_ht IS NOT NULL THEN
    NEW.prix_ttc := calculate_ttc(NEW.prix_ht);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS concours_ttc_trigger ON concours;
CREATE TRIGGER concours_ttc_trigger
BEFORE INSERT OR UPDATE ON concours
FOR EACH ROW
EXECUTE FUNCTION concours_calculate_ttc();

-- Create trigger for coach_annonces
CREATE OR REPLACE FUNCTION coach_annonces_calculate_ttc()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.prix_heure_ht IS NOT NULL THEN
    NEW.prix_heure_ttc := calculate_ttc(NEW.prix_heure_ht);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS coach_annonces_ttc_trigger ON coach_annonces;
CREATE TRIGGER coach_annonces_ttc_trigger
BEFORE INSERT OR UPDATE ON coach_annonces
FOR EACH ROW
EXECUTE FUNCTION coach_annonces_calculate_ttc();

-- Create trigger for transport_annonces
CREATE OR REPLACE FUNCTION transport_annonces_calculate_ttc()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.prix_km_ht IS NOT NULL THEN
    NEW.prix_km_ttc := calculate_ttc(NEW.prix_km_ht);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transport_annonces_ttc_trigger ON transport_annonces;
CREATE TRIGGER transport_annonces_ttc_trigger
BEFORE INSERT OR UPDATE ON transport_annonces
FOR EACH ROW
EXECUTE FUNCTION transport_annonces_calculate_ttc();

-- Create trigger for box_annonces
CREATE OR REPLACE FUNCTION box_annonces_calculate_ttc()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.prix_mois_ht IS NOT NULL THEN
    NEW.prix_mois_ttc := calculate_ttc(NEW.prix_mois_ht);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS box_annonces_ttc_trigger ON box_annonces;
CREATE TRIGGER box_annonces_ttc_trigger
BEFORE INSERT OR UPDATE ON box_annonces
FOR EACH ROW
EXECUTE FUNCTION box_annonces_calculate_ttc();

-- Add comment documenting TVA
COMMENT ON COLUMN concours.prix_ht IS 'Prix HT (Hors Taxes) en euros';
COMMENT ON COLUMN concours.prix_ttc IS 'Prix TTC (Toutes Taxes Comprises) avec TVA 20% - Calculé automatiquement';
COMMENT ON COLUMN coach_annonces.prix_heure_ht IS 'Tarif horaire HT en euros';
COMMENT ON COLUMN coach_annonces.prix_heure_ttc IS 'Tarif horaire TTC avec TVA 20% - Calculé automatiquement';
COMMENT ON COLUMN transport_annonces.prix_km_ht IS 'Tarif au km HT en euros';
COMMENT ON COLUMN transport_annonces.prix_km_ttc IS 'Tarif au km TTC avec TVA 20% - Calculé automatiquement';
COMMENT ON COLUMN box_annonces.prix_mois_ht IS 'Tarif mensuel HT en euros';
COMMENT ON COLUMN box_annonces.prix_mois_ttc IS 'Tarif mensuel TTC avec TVA 20% - Calculé automatiquement';
