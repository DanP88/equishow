import { Screen, Placeholder, H1, GhostButton } from '../../../v2/ui/kit';
import { router } from 'expo-router';
export default function NouveauCheval(){ return (<Screen><H1>Ajouter un cheval</H1><Placeholder note="Formulaire cheval recentré (Identité / Sport / Logistique) = LOT F8. Création réelle = cheval V1." v1Path="/(tabs)/chevaux" v1Label="Chevaux (V1)" /><GhostButton label="← Retour" onPress={() => router.back()} /></Screen>); }
