import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Alert, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { DatePickerModal, DateButton, formatDate } from '../components/DatePickerModal';
import { mockConcours } from '../data/mockConcours';
import { transportsStore, userStore } from '../data/store';
import { VILLES_POPULAIRES } from '../data/mockVilles';

const CONCOURS_OPTIONS = mockConcours
  .filter(c => c.statut !== 'brouillon')
  .map((c) => ({
    label: `${c.nom} — ${c.dateDebut.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · ${c.lieu}`,
    value: c.nom,
  }));

function ConcoursPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [autreMode, setAutreMode] = useState(false);
  const [autreText, setAutreText] = useState('');

  function selectOption(val: string) {
    if (val === '__autre__') {
      setAutreMode(true);
      setOpen(false);
    } else {
      onChange(val);
      setAutreMode(false);
      setOpen(false);
    }
  }

  function confirmAutre() {
    if (autreText.trim()) {
      onChange(autreText.trim());
      setAutreMode(false);
    }
  }

  const displayValue = value || '';

  return (
    <>
      <TouchableOpacity
        style={[f.input, !!value && f.inputFilled]}
        onPress={() => { setAutreMode(false); setOpen(true); }}
        activeOpacity={0.8}
      >
        <Text style={[f.inputText, !value && f.placeholder]} numberOfLines={1}>
          {displayValue || 'Sélectionner un concours'}
        </Text>
        <Text style={f.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={cp.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={cp.sheet}>
            <Text style={cp.title}>Concours associé</Text>
            <ScrollView style={cp.list} showsVerticalScrollIndicator={false}>
              {/* Option vide */}
              <TouchableOpacity style={cp.item} onPress={() => { onChange(''); setOpen(false); }}>
                <Text style={[cp.itemText, { color: Colors.textTertiary, fontStyle: 'italic' }]}>— Aucun concours</Text>
              </TouchableOpacity>
              {CONCOURS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[cp.item, value === opt.value && cp.itemActive]}
                  onPress={() => selectOption(opt.value)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[cp.itemText, value === opt.value && cp.itemTextActive]}>{opt.value}</Text>
                    <Text style={cp.itemSub}>{opt.label.split(' — ')[1]}</Text>
                  </View>
                  {value === opt.value && <Text style={cp.check}>✓</Text>}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[cp.item, cp.itemAutre]} onPress={() => selectOption('__autre__')}>
                <Text style={cp.itemAutreText}>✏️ Autre concours (saisie libre)</Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {autreMode && (
        <View style={cp.autreRow}>
          <TextInput
            style={cp.autreInput}
            value={autreText}
            onChangeText={setAutreText}
            placeholder="Nom du concours..."
            placeholderTextColor={Colors.textTertiary}
            autoFocus
          />
          <TouchableOpacity style={cp.autreConfirm} onPress={confirmAutre}>
            <Text style={cp.autreConfirmText}>OK</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

function VillesPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [autreMode, setAutreMode] = useState(false);
  const [autreText, setAutreText] = useState('');

  function selectVille(v: string) {
    if (v === '__autre__') {
      setAutreMode(true);
      setOpen(false);
    } else {
      onChange(v);
      setAutreMode(false);
      setOpen(false);
    }
  }

  function confirmAutre() {
    if (autreText.trim()) {
      onChange(autreText.trim());
      setAutreMode(false);
    }
  }

  return (
    <>
      <TouchableOpacity
        style={[f.input, !!value && f.inputFilled]}
        onPress={() => { setAutreMode(false); setOpen(true); }}
        activeOpacity={0.8}
      >
        <Text style={[f.inputText, !value && f.placeholder]} numberOfLines={1}>
          {value || 'Sélectionner une ville'}
        </Text>
        <Text style={f.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={vp.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={vp.sheet}>
            <Text style={vp.title}>Sélectionner une ville</Text>
            <ScrollView style={vp.list} showsVerticalScrollIndicator={false}>
              {VILLES_POPULAIRES.map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[vp.item, value === v && vp.itemActive]}
                  onPress={() => selectVille(v)}
                >
                  <Text style={[vp.itemText, value === v && vp.itemTextActive]}>{v}</Text>
                  {value === v && <Text style={vp.check}>✓</Text>}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[vp.item, vp.itemAutre]} onPress={() => selectVille('__autre__')}>
                <Text style={vp.itemAutreText}>✏️ Autre ville (saisie libre)</Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {autreMode && (
        <View style={vp.autreRow}>
          <TextInput
            style={vp.autreInput}
            value={autreText}
            onChangeText={setAutreText}
            placeholder="ex: Chamonix (74)"
            placeholderTextColor={Colors.textTertiary}
            autoFocus
          />
          <TouchableOpacity style={vp.autreConfirm} onPress={confirmAutre}>
            <Text style={vp.autreConfirmText}>OK</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

function Dropdown({ placeholder, value, options, onChange }: {
  placeholder: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={[f.input, !!value && f.inputFilled]} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[f.inputText, !value && f.placeholder]}>{value || placeholder}</Text>
        <Text style={f.arrow}>▼</Text>
      </TouchableOpacity>
      {open && (
        <View style={f.dropList}>
          {options.map((o) => (
            <TouchableOpacity key={o} style={[f.dropItem, value === o && f.dropItemActive]} onPress={() => { onChange(o); setOpen(false); }}>
              <Text style={[f.dropItemText, value === o && f.dropItemTextActive]}>{o}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );
}

export default function ProposerTransportScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const existing = editId ? transportsStore.list.find((t) => t.id === editId) : undefined;

  const [villeDepart, setVilleDepart] = useState(existing?.villeDepart ?? '');
  const [villeArrivee, setVilleArrivee] = useState(existing?.villeArrivee ?? '');
  const [dateTrajet, setDateTrajet] = useState<Date | undefined>(existing?.dateTrajet);
  const [nbPlaces, setNbPlaces] = useState(existing ? String(existing.nbPlacesTotal) : '');
  const [prix, setPrix] = useState(existing ? String(existing.prixHT) : '');

  // Retour
  const [proposerRetour, setProposerRetour] = useState(false);
  const [villedepartRetour, setVilledepartRetour] = useState('');
  const [villearriveeRetour, setVillearriveeRetour] = useState('');
  const [dateRetour, setDateRetour] = useState<Date | undefined>();
  const [nbPlacesRetour, setNbPlacesRetour] = useState('');

  // Propriétaire dans la voiture
  const [prendreProprietaire, setPrendreProprietaire] = useState(false);

  const [concours, setConcours] = useState(existing?.concours ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [showDate, setShowDate] = useState(false);
  const [showDateRetour, setShowDateRetour] = useState(false);


  const prixNum = parseFloat(prix);
  const prixTTC = prixNum ? Math.round(prixNum * 1.09 * 100) / 100 : null;

  function submit() {
    if (!villeDepart || !villeArrivee || !dateTrajet || !nbPlaces || !prix) {
      Alert.alert('Champs manquants', 'Veuillez remplir : ville de départ, d\'arrivée, date, nombre de places et prix.');
      return;
    }
    if (proposerRetour) {
      if (!villedepartRetour || !villearriveeRetour || !dateRetour || !nbPlacesRetour) {
        Alert.alert('Champs de retour manquants', 'Veuillez remplir tous les champs du retour.');
        return;
      }
      if (dateRetour.getTime() < dateTrajet.getTime()) {
        Alert.alert('Date invalide', 'La date du retour doit être égale ou après la date du trajet aller.');
        return;
      }
    }
    const nb = parseInt(nbPlaces, 10);

    if (editId && existing) {
      // Modification de l'annonce existante
      const idx = transportsStore.list.findIndex((t) => t.id === editId);
      if (idx !== -1) {
        transportsStore.list[idx] = {
          ...transportsStore.list[idx],
          dateTrajet,
          villeDepart: villeDepart.trim(),
          villeArrivee: villeArrivee.trim(),
          nbPlacesTotal: nb,
          nbPlacesDisponibles: nb,
          prixHT: parseFloat(prix),
          concours: concours || undefined,
          description: description || undefined,
        };
      }
      Alert.alert(
        'Annonce modifiée ! ✅',
        `Votre trajet ${villeDepart} → ${villeArrivee} a été mis à jour.`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/services?tab=transport' as any) }],
      );
    } else {
      const nouvelleAnnonce = {
        id: `t${Date.now()}`,
        auteurId: userStore.id,
        auteurNom: `${userStore.prenom} ${userStore.nom}`,
        auteurPseudo: userStore.pseudo,
        auteurInitiales: `${userStore.prenom[0]}${userStore.nom[0]}`,
        auteurCouleur: userStore.avatarColor,
        dateTrajet,
        villeDepart: villeDepart.trim(),
        villeArrivee: villeArrivee.trim(),
        nbPlacesTotal: nb,
        nbPlacesDisponibles: nb,
        prixHT: parseFloat(prix),
        concours: concours || undefined,
        description: description || undefined,
      };
      transportsStore.list = [nouvelleAnnonce, ...transportsStore.list];
      Alert.alert(
        'Annonce publiée ! 🚐',
        `Votre trajet ${villeDepart} → ${villeArrivee} est maintenant visible dans la liste.`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/services?tab=transport' as any) }],
      );
    }
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{editId ? 'Modifier le trajet' : 'Proposer un trajet'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.infoCard}>
          <Text style={s.infoIcon}>💡</Text>
          <Text style={s.infoText}>Prix recommandé : <Text style={s.infoHighlight}>0,8€ par kilomètre</Text>. Vous fixez votre tarif librement. La plateforme prélève 9% de commission sur chaque réservation.</Text>
        </View>

        <View style={s.villesRow}>
          <View style={{ flex: 1 }}>
            <Field label="Ville de départ *" required>
              <VillesPicker value={villeDepart} onChange={setVilleDepart} />
            </Field>
          </View>
          <View style={s.arrowPlaceholder} />
          <View style={{ flex: 1 }}>
            <Field label="Ville d'arrivée *" required>
              <VillesPicker value={villeArrivee} onChange={setVilleArrivee} />
            </Field>
          </View>
        </View>

        <Field label="Date du trajet *" required>
          <DateButton label="Sélectionner une date" value={dateTrajet} onPress={() => setShowDate(true)} />
        </Field>

        <Field label="Nombre de places aller (chevaux) *" required>
          <View style={s.placesRow}>
            {['1', '2', '3', '4', '5', '6'].map((n) => (
              <TouchableOpacity
                key={n}
                style={[s.placeBtn, nbPlaces === n && s.placeBtnActive]}
                onPress={() => setNbPlaces(n)}
              >
                <Text style={[s.placeBtnText, nbPlaces === n && s.placeBtnTextActive]}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Field>

        <TouchableOpacity
          style={s.proprietaireToggle}
          onPress={() => setPrendreProprietaire(!prendreProprietaire)}
          activeOpacity={0.7}
        >
          <Text style={s.proprietaireCheckbox}>{prendreProprietaire ? '☑️' : '☐'}</Text>
          <Text style={s.proprietaireLabel}>Prendre le propriétaire dans la voiture du conducteur</Text>
        </TouchableOpacity>

        {/* Section Retour */}
        <View style={s.retourSection}>
          <TouchableOpacity
            style={s.retourToggle}
            onPress={() => setProposerRetour(!proposerRetour)}
            activeOpacity={0.7}
          >
            <Text style={s.retourCheckbox}>{proposerRetour ? '☑️' : '☐'}</Text>
            <Text style={s.retourLabel}>Proposer un retour</Text>
          </TouchableOpacity>

          {proposerRetour && (
            <View style={s.retourFields}>
              <View style={s.villesRow}>
                <View style={{ flex: 1 }}>
                  <Field label="Ville de départ retour *" required>
                    <VillesPicker value={villedepartRetour} onChange={setVilledepartRetour} />
                  </Field>
                </View>
                <View style={s.arrowPlaceholder} />
                <View style={{ flex: 1 }}>
                  <Field label="Ville d'arrivée retour *" required>
                    <VillesPicker value={villearriveeRetour} onChange={setVillearriveeRetour} />
                  </Field>
                </View>
              </View>

              <Field label="Date du retour *" required>
                <DateButton label="Sélectionner une date" value={dateRetour} onPress={() => setShowDateRetour(true)} />
              </Field>

              <Field label="Nombre de places retour *" required>
                <View style={s.placesRow}>
                  {['1', '2', '3', '4', '5', '6'].map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[s.placeBtn, nbPlacesRetour === n && s.placeBtnActive]}
                      onPress={() => setNbPlacesRetour(n)}
                    >
                      <Text style={[s.placeBtnText, nbPlacesRetour === n && s.placeBtnTextActive]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Field>
            </View>
          )}
        </View>

        <Field label="Prix par place (€ HT) *" required hint={prixTTC ? `→ ${prixTTC}€ TTC avec commission 9%` : 'Recommandé : 0,8€/km'}>
          <View style={f.priceRow}>
            <TextInput
              style={[f.input, { flex: 1 }, !!prix && f.inputFilled]}
              value={prix}
              onChangeText={setPrix}
              placeholder="45"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />
            <View style={f.priceUnit}><Text style={f.priceUnitText}>€ HT</Text></View>
          </View>
        </Field>

        <Field label="Concours associé">
          <ConcoursPicker value={concours} onChange={setConcours} />
        </Field>

        <Field label="Description">
          <TextInput
            style={[f.input, f.inputMultiline, !!description && f.inputFilled]}
            value={description}
            onChangeText={setDescription}
            placeholder="Taille du van, conditions, horaires précis..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={3}
          />
        </Field>

        <View style={s.stripeNote}>
          <Text style={s.stripeIcon}>🔒</Text>
          <Text style={s.stripeText}>Les paiements sont gérés par Stripe. Vous recevrez le montant HT après déduction de la commission de 9%.</Text>
        </View>

        <TouchableOpacity style={s.submitBtn} onPress={submit} activeOpacity={0.85}>
          <Text style={s.submitText}>Publier l'annonce</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <DatePickerModal visible={showDate} value={dateTrajet} onConfirm={setDateTrajet} onClose={() => setShowDate(false)} title="Date du trajet" />
      <DatePickerModal visible={showDateRetour} value={dateRetour} onConfirm={setDateRetour} onClose={() => setShowDateRetour(false)} title="Date du retour" />
    </SafeAreaView>
  );
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <View style={s.field}>
      <View style={s.fieldLabelRow}>
        <Text style={s.fieldLabel}>{label}</Text>
        {required && <Text style={s.required}>*</Text>}
      </View>
      {children}
      {hint && <Text style={s.fieldHint}>{hint}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  container: { padding: Spacing.lg, gap: Spacing.lg },
  infoCard: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primaryBorder, alignItems: 'flex-start' },
  infoIcon: { fontSize: 16 },
  infoText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  infoHighlight: { color: Colors.primary, fontWeight: FontWeight.bold },
  field: { gap: Spacing.xs },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  required: { fontSize: FontSize.sm, color: Colors.urgent, fontWeight: FontWeight.bold },
  fieldHint: { fontSize: FontSize.xs, color: Colors.primary, fontStyle: 'italic' },
  placesRow: { flexDirection: 'row', gap: Spacing.sm },
  placeBtn: { flex: 1, paddingVertical: Spacing.sm + 2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface },
  placeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  placeBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  placeBtnTextActive: { color: Colors.textInverse },
  villesRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  arrowPlaceholder: { width: 44, height: 44 },
  proprietaireToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  proprietaireCheckbox: { fontSize: 18 },
  proprietaireLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1 },
  retourSection: { backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primaryBorder, gap: Spacing.md },
  retourToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  retourCheckbox: { fontSize: 18 },
  retourLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.primary },
  retourFields: { gap: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.primaryBorder },
  stripeNote: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, padding: Spacing.md, alignItems: 'flex-start' },
  stripeIcon: { fontSize: 14 },
  stripeText: { flex: 1, fontSize: FontSize.xs, color: Colors.textTertiary, lineHeight: 18 },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center', ...Shadow.fab },
  submitText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
});

const f = StyleSheet.create({
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  inputFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  inputText: { flex: 1, fontSize: FontSize.base, color: Colors.textPrimary },
  placeholder: { color: Colors.textTertiary },
  arrow: { fontSize: 11, color: Colors.textTertiary },
  priceRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  priceUnit: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, borderWidth: 1, borderColor: Colors.border },
  priceUnitText: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  dropList: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, maxHeight: 200, overflow: 'hidden' },
  dropItem: { paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropItemActive: { backgroundColor: Colors.primaryLight },
  dropItemText: { fontSize: FontSize.base, color: Colors.textPrimary },
  dropItemTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
});

const cp = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  sheet: { backgroundColor: Colors.surface, borderRadius: Radius.xxl, width: '100%', maxWidth: 400, maxHeight: '80%', padding: Spacing.xl, ...Shadow.modal },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md, textAlign: 'center' },
  list: { maxHeight: 380 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemActive: { backgroundColor: Colors.primaryLight },
  itemText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1 },
  itemTextActive: { color: Colors.primary },
  itemSub: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  check: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.bold },
  itemAutre: { backgroundColor: Colors.surfaceVariant, borderBottomWidth: 0, marginTop: Spacing.xs, borderRadius: Radius.md },
  itemAutreText: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  autreRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs },
  autreInput: { flex: 1, borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.primaryLight },
  autreConfirm: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2 },
  autreConfirmText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
});

const vp = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  sheet: { backgroundColor: Colors.surface, borderRadius: Radius.xxl, width: '100%', maxWidth: 400, maxHeight: '80%', padding: Spacing.xl, ...Shadow.modal },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md, textAlign: 'center' },
  list: { maxHeight: 380 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemActive: { backgroundColor: Colors.primaryLight },
  itemText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary, flex: 1 },
  itemTextActive: { color: Colors.primary },
  check: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.bold },
  itemAutre: { backgroundColor: Colors.surfaceVariant, borderBottomWidth: 0, marginTop: Spacing.xs, borderRadius: Radius.md },
  itemAutreText: { fontSize: FontSize.base, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  autreRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', marginTop: Spacing.xs },
  autreInput: { flex: 1, borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.primaryLight },
  autreConfirm: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2 },
  autreConfirmText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
});
