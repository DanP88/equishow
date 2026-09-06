import { Screen, Placeholder, H1, GhostButton } from '../../../v2/ui/kit';
import { router } from 'expo-router';
export default function Creer(){ return (<Screen><H1>Créer un concours</H1><Placeholder note="Formulaire de création réel = creer-concours (V1). Wrap V2 en lot ultérieur." v1Path="/creer-concours" v1Label="Ouvrir la création (V1)" /><GhostButton label="← Retour" onPress={() => router.back()} /></Screen>); }
