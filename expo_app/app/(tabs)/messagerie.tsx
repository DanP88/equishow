// Route (tabs)/messagerie → réutilise l'écran messagerie unique (backend Supabase).
// Évite le doublon avec app/messagerie.tsx (ancienne version in-memory).
export { default } from '../messagerie';
