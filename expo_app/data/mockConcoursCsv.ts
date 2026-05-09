import { ConcoursCSV } from '../types/concours';

const LIEUX = ['Haras de Lyon', 'Parc Équestre de Paris', 'Centre Équestre de Bordeaux', 'Haras National de Pompadour', 'Domaine de Saumur', 'Stade Équestre de Nice', 'Grand Parquet Fontainebleau', 'Équita Lyon', 'Haras du Pin', 'Poney Club de Versailles', 'Centre Équestre Deauville', 'Domaine de Camargue', 'Parc Équestre de Touraine', 'Haras de Lamballe', 'Centre Équestre de Strasbourg', 'Stade Équestre du Mans', 'Haras de Tarbes', 'Parc Expo Angers', 'Centre Équestre de Cannes', 'Haras de Chantilly'];
const DEPS = ['75', '69', '33', '19', '49', '06', '77', '74', '61', '78', '14', '13', '37', '22', '67', '72', '65', '49', '06', '60'];
const TYPES = ['CSO', 'Dressage', 'CCE', 'Hunter', 'TREC', 'Endurance', 'Pony Games', 'Voltige', 'Equitation de Travail', 'Para-Équitation'];
const CRES = ['CRE Auvergne-Rhône-Alpes', 'CRE Île-de-France', 'CRE Nouvelle-Aquitaine', 'CRE Occitanie', 'CRE Provence-Alpes-Côte d\'Azur', 'CRE Bretagne', 'CRE Normandie', 'CRE Centre-Val de Loire', 'CRE Grand Est', 'CRE Pays de la Loire'];
const ORGAS = ['Club Équestre Local', 'Association FFE Régionale', 'Haras National', 'Ecurie Pro Compétition', 'Poney Club Fédéral', 'Centre Équestre Départemental', 'Ligue Régionale d\'Équitation', 'Comité Départemental', 'Écurie de Compétition Elite', 'Club Hippique Municipal'];
const EPREUVES_POOL = [
  ['CSO Amateur 1', 'CSO Amateur 2', 'Grand Prix 1m30', 'Vitesse 1m10'],
  ['Dressage Club A', 'Dressage Amateur 1', 'Reprise Libre', 'Grand Prix Dressage'],
  ['Cross Amateur', 'Dressage CCE', 'Saut d\'obstacles CCE', 'CCE Pro'],
  ['Hunter Style', 'Hunter Équitation', 'Derby Hunter', 'Hunter Amateur'],
  ['Parcours Orientation', 'Maîtrise des Allures', 'PTV', 'TREC Loisir'],
  ['Endurance 20km', 'Endurance 40km', 'Endurance 80km'],
  ['Gymkhana', 'Pony Games Équipes', 'Pony Games Individuel'],
  ['Voltige Individuel', 'Voltige Duo', 'Voltige Équipe'],
  ['Travail en Liberté', 'Maniabilité', 'Équitation de Travail'],
  ['Para Dressage Grade I', 'Para Dressage Grade II', 'Para CSO'],
];

function addDays(base: string, n: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

const BATCH_ID = 'batch_demo_100';

export const mockConcoursCsv: ConcoursCSV[] = Array.from({ length: 100 }, (_, i) => {
  const lieu = LIEUX[i % LIEUX.length];
  const type = TYPES[i % TYPES.length];
  const dep = DEPS[i % DEPS.length];
  const cre = CRES[i % CRES.length];
  const orga = ORGAS[i % ORGAS.length];
  const epreuves = EPREUVES_POOL[i % EPREUVES_POOL.length];
  const baseDate = addDays('2026-05-01', i * 3);
  const dateDebut = baseDate;
  const dateFin = addDays(baseDate, 1 + (i % 3));
  const dateCloture = addDays(baseDate, -(7 + (i % 14)));
  const numero = `FFE${String(20000 + i).padStart(6, '0')}`;
  const etat = i % 5 === 0 ? 'Complet' : i % 7 === 0 ? 'Annulé' : 'Ouvert';

  return {
    id: `csv_demo_${i}`,
    nom_concours: `${lieu} — ${type} #${i + 1}`,
    date_debut: dateDebut,
    date_fin: dateFin,
    date_cloture: dateCloture,
    organisateur_terrain: orga,
    organisateur_financier: i % 3 === 0 ? orga : null,
    lieu,
    type_concours: type,
    departement: dep,
    cre,
    numero_concours: numero,
    etat,
    liste_epreuves: epreuves,
    adresse: `${10 + i} Route de l'Équitation, ${dep}000`,
    source_import: 'csv',
    import_batch_id: BATCH_ID,
    created_at: new Date().toISOString(),
  };
});
