-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (all roles)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  pseudo VARCHAR(100),
  role VARCHAR(50) CHECK (role IN ('cavalier', 'coach', 'organisateur')),
  plan VARCHAR(50) DEFAULT 'Gratuit',
  region VARCHAR(100),
  disciplines TEXT[] DEFAULT '{}',
  bio TEXT,
  avatar_color VARCHAR(7),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chevaux table
CREATE TABLE IF NOT EXISTS chevaux (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proprietaire_id UUID NOT NULL REFERENCES users(id),
  nom VARCHAR(100) NOT NULL,
  type VARCHAR(50) CHECK (type IN ('cheval', 'poney')),
  race VARCHAR(100),
  robe VARCHAR(100),
  annee_naissance INT,
  photo_url TEXT,
  photo_color VARCHAR(7),
  temperament TEXT[] DEFAULT '{}',
  disciplines TEXT[] DEFAULT '{}',
  niveau_pratique VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Concours table
CREATE TABLE IF NOT EXISTS concours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom VARCHAR(255) NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  lieu VARCHAR(255) NOT NULL,
  adresse_complete TEXT,
  code_postal VARCHAR(10),
  ville VARCHAR(100),
  discipline VARCHAR(100),
  disciplines TEXT[] DEFAULT '{}',
  epreuves TEXT[] DEFAULT '{}',
  types_cavaliers TEXT[] DEFAULT '{}',
  organisateur_id UUID NOT NULL REFERENCES users(id),
  organisateur_nom VARCHAR(255),
  statut VARCHAR(50) CHECK (statut IN ('ouvert', 'complet', 'ferme', 'termine', 'brouillon')),
  nb_places INT,
  nb_inscrits INT DEFAULT 0,
  prix DECIMAL(10,2),
  description TEXT,
  photo_url TEXT,
  horaire_debut VARCHAR(5),
  horaire_fin VARCHAR(5),
  en_live BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Coach Annonces table
CREATE TABLE IF NOT EXISTS coach_annonces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auteur_id UUID NOT NULL REFERENCES users(id),
  auteur_nom VARCHAR(255),
  titre VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) CHECK (type IN ('concours', 'regulier')),
  discipline VARCHAR(100),
  niveau VARCHAR(50),
  prix_heure DECIMAL(10,2),
  places INT,
  places_disponibles INT,
  date_debut DATE,
  date_fin DATE,
  concours_nom VARCHAR(255),
  region VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Disponibilites table
CREATE TABLE IF NOT EXISTS disponibilites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  annonce_id UUID REFERENCES coach_annonces(id),
  jour DATE NOT NULL,
  heure_debut VARCHAR(5) NOT NULL,
  heure_fin VARCHAR(5) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transport Annonces table
CREATE TABLE IF NOT EXISTS transport_annonces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auteur_id UUID NOT NULL REFERENCES users(id),
  auteur_nom VARCHAR(255),
  titre VARCHAR(255) NOT NULL,
  description TEXT,
  prix_km DECIMAL(10,2),
  rayon_km INT,
  zones TEXT[],
  date_debut DATE,
  date_fin DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Box Annonces table
CREATE TABLE IF NOT EXISTS box_annonces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auteur_id UUID NOT NULL REFERENCES users(id),
  auteur_nom VARCHAR(255),
  titre VARCHAR(255) NOT NULL,
  prix_mois DECIMAL(10,2),
  adresse TEXT,
  code_postal VARCHAR(10),
  lieu VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(100),
  titre VARCHAR(255),
  message TEXT,
  est_lue BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chevaux_proprietaire ON chevaux(proprietaire_id);
CREATE INDEX IF NOT EXISTS idx_coach_annonces_auteur ON coach_annonces(auteur_id);
CREATE INDEX IF NOT EXISTS idx_concours_organisateur ON concours(organisateur_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_concours_statut ON concours(statut);
CREATE INDEX IF NOT EXISTS idx_concours_date ON concours(date_debut);
CREATE INDEX IF NOT EXISTS idx_coach_annonces_type ON coach_annonces(type);
CREATE INDEX IF NOT EXISTS idx_notifications_lue ON notifications(est_lue);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chevaux_updated_at BEFORE UPDATE ON chevaux FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_concours_updated_at BEFORE UPDATE ON concours FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_coach_annonces_updated_at BEFORE UPDATE ON coach_annonces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transport_annonces_updated_at BEFORE UPDATE ON transport_annonces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_box_annonces_updated_at BEFORE UPDATE ON box_annonces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
