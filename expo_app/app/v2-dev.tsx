// ─────────────────────────────────────────────────────────────────────────────
// /v2-dev — POINT D'ENTRÉE DEV de la V2 (LOT F1 + complément parcours d'entrée).
//
// Route ADDITIVE : ne modifie aucun écran V1. Accessible uniquement en __DEV__
// (sinon redirige vers l'accueil). Sert à visualiser/tester :
//   - le parcours d'entrée V2 (bienvenue / se connecter / créer un compte) ;
//   - le panneau Capacités (7 combinaisons) ;
//   - l'onboarding omni-activités (utilisateur déjà connecté).
//
// Naviguer vers cette page : ouvrir l'URL /v2-dev (web) ou `router.push('/v2-dev')`.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { DevCapabilitiesPanel } from '../v2/screens/DevCapabilitiesPanel';
import { OnboardingV2 } from '../v2/screens/OnboardingV2';
import { V2EntryFlow } from '../v2/screens/V2EntryFlow';
import { useCapabilities, CAPABILITY_LABEL } from '../v2/capabilities';
import { useV2Session } from '../v2/auth';

type DevView = 'menu' | 'entry' | 'panel' | 'onboarding';

export default function V2DevScreen() {
  if (!__DEV__) return <Redirect href={'/(tabs)/accueil' as any} />;
  const [view, setView] = useState<DevView>('menu');
  const c = useCapabilities();
  const session = useV2Session();

  if (view === 'entry') return <Back onBack={() => setView('menu')}><V2EntryFlow onExit={() => setView('menu')} /></Back>;
  if (view === 'panel') return <Back onBack={() => setView('menu')}><DevCapabilitiesPanel /></Back>;
  if (view === 'onboarding') return <Back onBack={() => setView('menu')}><OnboardingV2 onDone={() => setView('menu')} /></Back>;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.body}>
        <Text style={s.kicker}>EquiShow V2 · DEV · LOT F1</Text>
        <Text style={s.title}>Omni-activités</Text>

        <View style={s.summary}>
          <Text style={s.summaryLine}>
            Session : <Text style={s.b}>{session.kind === 'real' ? 'compte réel connecté' : session.kind === 'simulated' ? 'compte simulé' : 'aucune'}</Text>
            {session.identity?.email ? `  ·  ${session.identity.email}` : ''}
          </Text>
          <Text style={s.summaryLine}>
            Capacités actives : <Text style={s.b}>{c.capabilities.map((x) => CAPABILITY_LABEL[x]).join(' · ') || '—'}</Text>
          </Text>
          <Text style={s.summaryLine}>
            Source capacités : <Text style={s.b}>{c.source}</Text>   ·   Vrai rôle : <Text style={s.b}>{c.realRole}</Text>
          </Text>
          {c.isPending('organisateur') && <Text style={[s.summaryLine, { color: Colors.warning }]}>Organisateur : en attente de validation</Text>}
          {session.kind === 'simulated' && (
            <TouchableOpacity onPress={session.signOut}><Text style={s.signout}>Se déconnecter (simulé)</Text></TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={s.card} onPress={() => setView('entry')} activeOpacity={0.85}>
          <Text style={s.cardTitle}>🆕  Parcours nouvel utilisateur</Text>
          <Text style={s.cardSub}>Bienvenue → Se connecter / Créer un compte → identifiants → activités → infos complémentaires → compte créé & connecté (tout simulé).</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.card} onPress={() => setView('panel')} activeOpacity={0.85}>
          <Text style={s.cardTitle}>🎛  Panneau Capacités</Text>
          <Text style={s.cardSub}>Forcer les 7 combinaisons, toggles, approbation organisateur simulée, reset.</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.card} onPress={() => setView('onboarding')} activeOpacity={0.85}>
          <Text style={s.cardTitle}>🚀  Onboarding V2 (utilisateur déjà connecté)</Text>
          <Text style={s.cardSub}>Sélection multiple Cavalier / Coach / Organisateur, étapes adaptatives, validation organisateur simulée.</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.link} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/accueil' as any))}>
          <Text style={s.linkTxt}>← Retour à l’app</Text>
        </TouchableOpacity>

        <Text style={s.note}>
          F1 n’a modifié aucun écran V1. Le reste de l’app est inchangé
          (V2_ENABLED = false). Aucun Supabase Auth, aucun email, aucune écriture PROD.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function Back({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={s.backBar}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backTxt}>← Menu F1</Text></TouchableOpacity>
      </SafeAreaView>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { flex: 1, padding: Spacing.lg, gap: Spacing.md },
  kicker: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: FontSize.xxxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  summary: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: Spacing.md, gap: 4 },
  summaryLine: { fontSize: FontSize.sm, color: Colors.textSecondary },
  b: { fontWeight: FontWeight.bold, color: Colors.textPrimary },
  signout: { fontSize: FontSize.sm, color: Colors.urgent, fontWeight: FontWeight.bold, marginTop: 4 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, gap: 4 },
  cardTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  cardSub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  link: { paddingVertical: Spacing.sm },
  linkTxt: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.bold },
  note: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic', lineHeight: 17, marginTop: 'auto' },
  backBar: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { padding: Spacing.md },
  backTxt: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.bold },
});
