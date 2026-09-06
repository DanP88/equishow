// ─────────────────────────────────────────────────────────────────────────────
// CoachOptInV2 — ajout EXPLICITE de la capacité Coach depuis « Je propose →
// Coaching » (ajustement produit validé : plus d'ajout silencieux).
//
//   Écran 1 : explication + [ Continuer ]
//   Écran 2 : uniquement les infos Coach MANQUANTES (disciplines déjà connues
//             si cavalier → non redemandées ; on demande niveaux + tarif)
//   Confirmation → useCapabilities().request('coach')  (statut 'active')
//
// PHASE 1 : simulé/local. AUCUN backend, AUCUN change_user_role.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { Screen, Card, Chip, PrimaryButton, GhostButton } from '../ui/kit';
import { useCapabilities } from '../capabilities';
import { useAuth } from '../../hooks/useAuth';

const LEVELS = ['Club', 'Amateur', 'Pro', 'Poney'];

export function CoachOptInV2() {
  const caps = useCapabilities();
  const { profile } = useAuth();
  const knownDisciplines: string[] = (profile as any)?.disciplines ?? [];
  const [step, setStep] = useState<0 | 1 | 2>(caps.has('coach') ? 2 : 0);
  const [levels, setLevels] = useState<string[]>([]);
  const [tarif, setTarif] = useState('');

  if (step === 2 || caps.has('coach')) {
    return (
      <Screen>
        <Text style={s.h1}>Activité Coach active ✓</Text>
        <Card>
          <Text style={s.body}>
            Vous pouvez maintenant publier des annonces de coaching et recevoir des
            demandes. Vos autres activités sont inchangées.
          </Text>
          <Text style={s.simTag}>PROTOTYPE — capacité ajoutée localement (aucun backend)</Text>
        </Card>
        <PrimaryButton label="Publier une annonce de coaching" onPress={() => router.replace('/(v2)/service/coach?face=propose' as any)} />
        <GhostButton label="Retour" onPress={() => router.replace('/(v2)/propose' as any)} />
      </Screen>
    );
  }

  if (step === 0) {
    return (
      <Screen>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Retour</Text></TouchableOpacity>
        <Text style={s.h1}>Proposer du coaching</Text>
        <Card>
          <Text style={s.body}>
            Pour proposer du coaching, ajoutez l’activité <Text style={s.b}>Coach</Text> à
            votre profil EquiShow.
            {'\n\n'}
            Vous conserverez toutes vos autres activités — rien n’est retiré, il n’y
            a pas de « mode » à changer.
          </Text>
        </Card>
        <PrimaryButton label="Continuer" onPress={() => setStep(1)} />
        <GhostButton label="Annuler" onPress={() => router.back()} />
      </Screen>
    );
  }

  // step 1 — infos coach manquantes uniquement
  return (
    <Screen>
      <TouchableOpacity onPress={() => setStep(0)}><Text style={s.back}>← Retour</Text></TouchableOpacity>
      <Text style={s.h1}>Informations Coach</Text>
      <Text style={s.sub}>On ne demande que ce qui manque.</Text>

      {knownDisciplines.length > 0 && (
        <Card>
          <Text style={s.field}>Disciplines (déjà renseignées)</Text>
          <Text style={s.known}>{knownDisciplines.join(', ')}</Text>
        </Card>
      )}

      <View style={s.blk}>
        <Text style={s.field}>Niveaux encadrés</Text>
        <View style={s.chips}>
          {LEVELS.map((l) => (
            <Chip key={l} label={l} on={levels.includes(l)} onPress={() => setLevels((p) => p.includes(l) ? p.filter((x) => x !== l) : [...p, l])} />
          ))}
        </View>
      </View>

      <View style={s.blk}>
        <Text style={s.field}>Tarif indicatif (€ / séance)</Text>
        <TextInput style={s.input} value={tarif} onChangeText={setTarif} keyboardType="decimal-pad" placeholder="Ex. 45" placeholderTextColor={Colors.textTertiary} />
      </View>

      <PrimaryButton
        label="Ajouter l’activité Coach"
        disabled={levels.length === 0}
        onPress={() => { caps.request('coach'); setStep(2); }}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  back: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  h1: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary },
  body: { fontSize: FontSize.base, color: Colors.textSecondary, lineHeight: 21 },
  b: { fontWeight: FontWeight.bold, color: Colors.textPrimary },
  simTag: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold, marginTop: Spacing.sm },
  blk: { gap: Spacing.xs, marginTop: Spacing.md },
  field: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  known: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
});
