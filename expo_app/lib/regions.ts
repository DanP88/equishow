// Régions françaises + pays/territoires francophones, pour le champ « Région »
// du profil (choix dans la liste OU saisie libre).

export const REGIONS_FR: string[] = [
  'Auvergne-Rhône-Alpes',
  'Bourgogne-Franche-Comté',
  'Bretagne',
  'Centre-Val de Loire',
  'Corse',
  'Grand Est',
  'Hauts-de-France',
  'Île-de-France',
  'Normandie',
  'Nouvelle-Aquitaine',
  'Occitanie',
  'Pays de la Loire',
  "Provence-Alpes-Côte d'Azur",
  'Guadeloupe',
  'Martinique',
  'Guyane',
  'La Réunion',
  'Mayotte',
];

export const PAYS_FRANCOPHONES: string[] = [
  'Belgique',
  'Suisse',
  'Luxembourg',
  'Monaco',
  'Québec (Canada)',
  'Andorre',
];

export interface RegionSection {
  title: string;
  items: string[];
}

export const REGION_SECTIONS: RegionSection[] = [
  { title: 'Régions françaises', items: REGIONS_FR },
  { title: 'Pays francophones', items: PAYS_FRANCOPHONES },
];
