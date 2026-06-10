// Agenda SYNCHRONISÉ par compte : coach et cavalier partagent le même écran.
// Tout est agrégé par user id dans cavalier-agenda (réservations faites + cours/
// stages animés), donc l'onglet Agenda montre la même chose quel que soit le
// rôle affiché. Ce fichier ne fait que ré-exporter l'écran unifié pour que la
// route /(tabs)/coach-agenda continue de fonctionner.
export { default } from './cavalier-agenda';
