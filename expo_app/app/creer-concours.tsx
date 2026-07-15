import { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  TextInput, Modal, Switch, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../constants/theme';
import { DatePickerModal, DateButton } from '../components/DatePickerModal';
import { AlertModal } from '../components/AlertModal';
import { useAuth } from '../hooks/useAuth';
import { createConcours, updateConcours, fetchConcoursForEdit } from '../hooks/useConcours';
import { validateConcoursForm, parseLocalDate } from '../lib/concoursValidation';
import { MultiDisciplineEpreuvePicker } from '../components/MultiDisciplineEpreuvePicker';
import { ConfirmModal } from '../components/ConfirmModal';
import { DISCIPLINES_CATALOGUE, EPREUVES_PAR_DISCIPLINE, resolveEditDisciplines } from '../lib/epreuves';

const TYPES_CAVALIERS = ['Poney', 'Loisir', 'Amateur', 'Pro', 'Elite'];

function MultiSelectChip({ options, selected, onChange }: {
  options: string[]; selected: string[]; onChange: (s: string[]) => void;
}) {
  return (
    <View style={s.chipsRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[s.chip, selected.includes(opt) && s.chipActive]}
          onPress={() => {
            if (selected.includes(opt)) {
              onChange(selected.filter(x => x !== opt));
            } else {
              onChange([...selected, opt]);
            }
          }}
        >
          <Text style={[s.chipText, selected.includes(opt) && s.chipTextActive]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function CreerConcoursScreen() {
  const { profile, session } = useAuth();
  // Mode édition si un `id` est passé en paramètre → on charge le brouillon
  // existant et `submit()` fait un UPDATE (aucune nouvelle ligne créée).
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!editId;
  const [loadingDraft, setLoadingDraft] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  // Verrou SYNCHRONE anti double-submit : `submitting` (état React) ne se met à
  // jour qu'au re-render, donc deux taps dans la même frame passeraient la garde.
  // Le ref est lu/écrit immédiatement → il bloque le 2e submit avant tout await.
  // (L'état `submitting` reste la source de vérité UX : loading + bouton disabled.)
  const submitLock = useRef(false);
  // Mode édition : on garde le jsonb complet et la région stockée pour ne pas
  // les écraser avec des valeurs dérivées du profil courant ou reconstruites à vide.
  const originalInfosRef = useRef<Record<string, any> | null>(null);
  const originalRegionRef = useRef<string | null>(null);
  const [nom, setNom] = useState('');
  const [dateDebut, setDateDebut] = useState<Date | undefined>();
  const [dateFin, setDateFin] = useState<Date | undefined>();
  const [lieu, setLieu] = useState('');
  const [adresse, setAdresse] = useState('');
  const [codePostal, setCodePostal] = useState('');
  const [ville, setVille] = useState('');
  // Disciplines explicitement choisies par l'organisateur (source de vérité de infos.disciplines).
  // La discipline de compatibilité (type_concours) est dérivée de selectedDisciplines[0].
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [epreuves, setEpreuves] = useState<string[]>([]);
  // Confirmation avant retrait d'une discipline qui a des épreuves sélectionnées.
  const [confirmRemoveDisc, setConfirmRemoveDisc] = useState<{ disc: string; epreuvesToRemove: string[] } | null>(null);
  const [typesCavaliers, setTypesCavaliers] = useState<string[]>([]);
  const [nbPlaces, setNbPlaces] = useState('');
  const [prix, setPrix] = useState('');
  const [horaireDebut, setHoraireDebut] = useState('09:00');
  const [horaireFin, setHoraireFin] = useState('18:00');
  const [description, setDescription] = useState('');
  const [restauration, setRestauration] = useState('');
  const [parking, setParking] = useState('');
  const [coaching, setCoaching] = useState(false);
  const [securite, setSecurite] = useState('');
  const [veterinaire, setVeterinaire] = useState(false);
  const [soins, setSoins] = useState(false);
  const [douches, setDouches] = useState(false);
  const [wifi, setWifi] = useState(false);
  const [autre, setAutre] = useState('');
  const [showDateDebut, setShowDateDebut] = useState(false);
  const [showDateFin, setShowDateFin] = useState(false);
  const [alertState, setAlertState] = useState<{ title: string; message: string; variant: 'info' | 'error'; onClose?: () => void } | null>(null);

  function showErr(title: string, message: string) {
    setAlertState({ title, message, variant: 'error' });
  }

  // Édition : charge le brouillon/concours existant et repeuple le formulaire.
  // Le mapping reflète la structure `infos jsonb` écrite par createConcours.
  useEffect(() => {
    if (!editId) return;
    let active = true;
    (async () => {
      const row = await fetchConcoursForEdit(editId);
      if (!active) return;
      if (!row) {
        setLoadingDraft(false);
        setAlertState({
          title: 'Concours introuvable',
          message: "Ce concours n'existe pas ou ne t'appartient pas.",
          variant: 'error',
          onClose: () => { setAlertState(null); router.replace('/(tabs)/org-concours' as any); },
        });
        return;
      }
      const infos = row.infos ?? {};
      originalInfosRef.current = row.infos ?? null;
      originalRegionRef.current = (infos as any).region ?? null;
      setNom(row.nom ?? '');
      setDateDebut(row.date_debut ? parseLocalDate(row.date_debut) : undefined);
      setDateFin(row.date_fin ? parseLocalDate(row.date_fin) : undefined);
      setLieu(row.lieu ?? '');
      setAdresse(row.adresse ?? '');
      setCodePostal(infos.code_postal ?? '');
      setVille(infos.ville ?? '');
      setSelectedDisciplines(resolveEditDisciplines(infos, row.liste_epreuves, row.type_concours));
      setEpreuves(Array.isArray(row.liste_epreuves) ? row.liste_epreuves : []);
      setTypesCavaliers(Array.isArray(infos.types_cavaliers) ? infos.types_cavaliers : []);
      setNbPlaces(infos.nb_places != null ? String(infos.nb_places) : '');
      setPrix(infos.prix != null ? String(infos.prix) : '');
      setHoraireDebut(infos.horaire_debut ?? '09:00');
      setHoraireFin(infos.horaire_fin ?? '18:00');
      setDescription(infos.description ?? '');
      setRestauration(infos.restauration ?? '');
      setParking(infos.parking ?? '');
      setCoaching(!!infos.coaching);
      setSecurite(infos.securite ?? '');
      setVeterinaire(!!infos.veterinaire);
      setSoins(!!infos.soins_chevaux);
      setDouches(!!infos.douches);
      setWifi(!!infos.wifi);
      setAutre(infos.autre ?? '');
      setLoadingDraft(false);
    })();
    return () => { active = false; };
  }, [editId]);

  async function submit() {
    if (submitLock.current) return; // garde synchrone double-submit

    // Garde session : organisateur_id vient UNIQUEMENT de l'utilisateur authentifié.
    const userId = session?.user?.id;
    if (!userId) {
      showErr('Session expirée', 'Reconnecte-toi pour gérer un concours.');
      return;
    }
    if (profile?.role !== 'organisateur') {
      showErr('Compte non organisateur', 'Seul un compte organisateur peut gérer un concours.');
      return;
    }

    // Discipline de compatibilité (type_concours) = première discipline sélectionnée.
    const disciplineCompat = selectedDisciplines[0] ?? '';

    // Validation métier PARTAGÉE (identique création/édition, cf. lib/concoursValidation).
    const invalid = validateConcoursForm({ nom, dateDebut, dateFin, lieu, discipline: disciplineCompat, nbPlaces, prix }, { allowPastDate: isEdit });
    if (invalid) { showErr(invalid.title, invalid.message); return; }
    const placesNum = parseInt(nbPlaces, 10);

    // Acquisition du verrou JUSTE avant l'async : toute validation ci-dessus a
    // pu sortir (return) sans jamais verrouiller → le formulaire reste utilisable.
    submitLock.current = true;
    setSubmitting(true);
    try {
      const payload = {
        organisateurId: userId,
        nom,
        dateDebut: dateDebut!,
        dateFin: dateFin!,
        lieu,
        adresse,
        codePostal,
        ville,
        discipline: disciplineCompat,   // type_concours (compat)
        disciplines: selectedDisciplines, // infos.disciplines (valeur explicite)
        epreuves,
        typesCavaliers,
        nbPlaces: placesNum,
        prix: prix ? parseInt(prix, 10) : undefined,
        horaireDebut,
        horaireFin,
        description,
        region: isEdit ? originalRegionRef.current : ((profile as any)?.region ?? null),
        existingInfos: isEdit ? originalInfosRef.current : undefined,
        infos: {
          restauration: restauration.trim() || null,
          parking: parking.trim() || null,
          coaching,
          securite: securite.trim() || null,
          veterinaire,
          soins_chevaux: soins,
          douches,
          wifi,
          autre: autre.trim() || null,
        },
      };

      if (isEdit && editId) {
        const { ok, error } = await updateConcours(editId, payload);
        if (!ok) { showErr('Enregistrement impossible', error ?? 'Une erreur est survenue. Réessaie.'); return; }
        setAlertState({
          title: 'Modifications enregistrées ✅',
          message: `"${nom.trim()}" a été mis à jour.`,
          variant: 'info',
          onClose: () => { setAlertState(null); router.replace('/(tabs)/org-concours' as any); },
        });
      } else {
        const { id, error } = await createConcours(payload);
        if (error || !id) { showErr('Création impossible', error ?? 'Une erreur est survenue. Réessaie.'); return; }
        // Navigation UNIQUEMENT après succès réel de l'insert.
        setAlertState({
          title: 'Concours créé 🏆',
          message: `"${nom.trim()}" a été enregistré en brouillon.`,
          variant: 'info',
          onClose: () => { setAlertState(null); router.replace('/(tabs)/org-concours' as any); },
        });
      }
    } finally {
      // Libération sur TOUS les chemins (succès, erreur retournée, exception).
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEdit ? 'Modifier le concours' : 'Créer un concours'}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loadingDraft ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={s.loadingTxt}>Chargement du concours…</Text>
        </View>
      ) : (
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {/* INFORMATIONS GÉNÉRALES */}
        <Text style={s.sectionTitle}>📝 Informations générales</Text>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Nom du concours *</Text>
          <TextInput
            style={[f.input, !!nom && f.inputFilled]}
            value={nom}
            onChangeText={setNom}
            placeholder="Grand Prix de Lyon"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.datesRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Début *</Text>
            <DateButton label="Date début" value={dateDebut} onPress={() => setShowDateDebut(true)} />
          </View>
          <Text style={s.dateSep}>→</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Fin *</Text>
            <DateButton label="Date fin" value={dateFin} onPress={() => setShowDateFin(true)} />
          </View>
        </View>

        <View style={s.horaireRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Heure début</Text>
            <TextInput
              style={[f.input, f.smallInput]}
              value={horaireDebut}
              onChangeText={setHoraireDebut}
              placeholder="09:00"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
          <View style={{ width: Spacing.md }} />
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Heure fin</Text>
            <TextInput
              style={[f.input, f.smallInput]}
              value={horaireFin}
              onChangeText={setHoraireFin}
              placeholder="18:00"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
        </View>

        {/* LIEU */}
        <Text style={s.sectionTitle}>📍 Lieu</Text>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Nom du lieu *</Text>
          <TextInput
            style={[f.input, !!lieu && f.inputFilled]}
            value={lieu}
            onChangeText={setLieu}
            placeholder="Haras de Lyon"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Adresse complète</Text>
          <TextInput
            style={[f.input, !!adresse && f.inputFilled]}
            value={adresse}
            onChangeText={setAdresse}
            placeholder="123 Rue du Cheval"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.locationRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Code postal</Text>
            <TextInput
              style={[f.input, !!codePostal && f.inputFilled]}
              value={codePostal}
              onChangeText={setCodePostal}
              placeholder="69000"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
          <View style={{ width: Spacing.md }} />
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Ville</Text>
            <TextInput
              style={[f.input, !!ville && f.inputFilled]}
              value={ville}
              onChangeText={setVille}
              placeholder="Lyon"
              placeholderTextColor={Colors.textTertiary}
            />
          </View>
        </View>

        {/* DISCIPLINES & ÉPREUVES */}
        <Text style={s.sectionTitle}>🎯 Disciplines & Épreuves</Text>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Disciplines proposées *</Text>
          <Text style={s.fieldHint}>La première discipline sélectionnée sera la discipline principale.</Text>
          <View style={s.chipsRow}>
            {DISCIPLINES_CATALOGUE.map((disc) => {
              const active = selectedDisciplines.includes(disc);
              return (
                <TouchableOpacity
                  key={disc}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => {
                    if (active) {
                      // Retrait : vérifier si des épreuves de cette discipline sont sélectionnées.
                      const catalogue = EPREUVES_PAR_DISCIPLINE[disc] as readonly string[] | undefined;
                      const toRemove = catalogue ? epreuves.filter(ep => catalogue.includes(ep)) : [];
                      if (toRemove.length > 0) {
                        setConfirmRemoveDisc({ disc, epreuvesToRemove: toRemove });
                      } else {
                        setSelectedDisciplines(prev => prev.filter(d => d !== disc));
                      }
                    } else {
                      // Ajout : maintenir l'ordre DISCIPLINES_CATALOGUE.
                      setSelectedDisciplines(prev => {
                        const next = new Set([...prev, disc]);
                        return [
                          ...DISCIPLINES_CATALOGUE.filter(d => next.has(d)),
                          ...prev.filter(d => !DISCIPLINES_CATALOGUE.includes(d)),
                        ];
                      });
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>{disc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Épreuves</Text>
          <MultiDisciplineEpreuvePicker
            disciplines={selectedDisciplines}
            selected={epreuves}
            onChange={setEpreuves}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Types de cavaliers</Text>
          <MultiSelectChip options={TYPES_CAVALIERS} selected={typesCavaliers} onChange={setTypesCavaliers} />
        </View>

        {/* PLACES & PRIX */}
        <Text style={s.sectionTitle}>💰 Places & Tarifs</Text>

        <View style={s.priceRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Nombre de places *</Text>
            <TextInput
              style={[f.input, !!nbPlaces && f.inputFilled]}
              value={nbPlaces}
              onChangeText={setNbPlaces}
              placeholder="60"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ width: Spacing.md }} />
          <View style={{ flex: 1 }}>
            <Text style={s.fieldLabel}>Prix d'inscription</Text>
            <TextInput
              style={[f.input, !!prix && f.inputFilled]}
              value={prix}
              onChangeText={setPrix}
              placeholder="45"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* INFOS COMPLÉMENTAIRES */}
        <Text style={s.sectionTitle}>ℹ️ Infos complémentaires</Text>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Restauration</Text>
          <TextInput
            style={[f.input, !!restauration && f.inputFilled]}
            value={restauration}
            onChangeText={setRestauration}
            placeholder="Sandwichs, bar, restaurant"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Parking</Text>
          <TextInput
            style={[f.input, !!parking && f.inputFilled]}
            value={parking}
            onChangeText={setParking}
            placeholder="Gratuit, sécurisé, capacité..."
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Sécurité</Text>
          <TextInput
            style={[f.input, !!securite && f.inputFilled]}
            value={securite}
            onChangeText={setSecurite}
            placeholder="Pompiers, infirmerie..."
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

        <View style={s.togglesRow}>
          <View style={s.toggleItem}>
            <Text style={s.toggleLabel}>Coaching disponible</Text>
            <Switch value={coaching} onValueChange={setCoaching} />
          </View>
          <View style={s.toggleItem}>
            <Text style={s.toggleLabel}>Vétérinaire</Text>
            <Switch value={veterinaire} onValueChange={setVeterinaire} />
          </View>
        </View>

        <View style={s.togglesRow}>
          <View style={s.toggleItem}>
            <Text style={s.toggleLabel}>Soins chevaux</Text>
            <Switch value={soins} onValueChange={setSoins} />
          </View>
          <View style={s.toggleItem}>
            <Text style={s.toggleLabel}>Douches</Text>
            <Switch value={douches} onValueChange={setDouches} />
          </View>
        </View>

        <View style={s.toggleItem}>
          <Text style={s.toggleLabel}>Wi-Fi</Text>
          <Switch value={wifi} onValueChange={setWifi} />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Autre info</Text>
          <TextInput
            style={[f.input, f.inputMultiline, !!autre && f.inputFilled]}
            value={autre}
            onChangeText={setAutre}
            placeholder="Infos supplémentaires..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Description</Text>
          <TextInput
            style={[f.input, f.inputMultiline, !!description && f.inputFilled]}
            value={description}
            onChangeText={setDescription}
            placeholder="Décrivez votre concours..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={[s.submitBtn, submitting && s.submitBtnDisabled]}
          onPress={submit}
          activeOpacity={0.85}
          disabled={submitting}
        >
          <Text style={s.submitText}>
            {submitting
              ? (isEdit ? 'Enregistrement…' : 'Création…')
              : (isEdit ? 'Enregistrer les modifications' : 'Créer le concours')}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
      )}

      <DatePickerModal visible={showDateDebut} value={dateDebut} onConfirm={setDateDebut} onClose={() => setShowDateDebut(false)} title="Date de début" />
      <DatePickerModal visible={showDateFin} value={dateFin} onConfirm={setDateFin} onClose={() => setShowDateFin(false)} title="Date de fin" />

      <ConfirmModal
        visible={!!confirmRemoveDisc}
        title={`Retirer ${confirmRemoveDisc?.disc ?? ''} ?`}
        message={
          `${confirmRemoveDisc?.epreuvesToRemove.length ?? 0} épreuve${(confirmRemoveDisc?.epreuvesToRemove.length ?? 0) > 1 ? 's' : ''} associée${(confirmRemoveDisc?.epreuvesToRemove.length ?? 0) > 1 ? 's' : ''} seront aussi retirée${(confirmRemoveDisc?.epreuvesToRemove.length ?? 0) > 1 ? 's' : ''} :\n${(confirmRemoveDisc?.epreuvesToRemove ?? []).join(', ')}`
        }
        cancelLabel="Annuler"
        confirmLabel="Retirer"
        destructive
        onCancel={() => setConfirmRemoveDisc(null)}
        onConfirm={() => {
          if (!confirmRemoveDisc) return;
          const { disc, epreuvesToRemove } = confirmRemoveDisc;
          setSelectedDisciplines(prev => prev.filter(d => d !== disc));
          setEpreuves(prev => prev.filter(ep => !epreuvesToRemove.includes(ep)));
          setConfirmRemoveDisc(null);
        }}
      />

      <AlertModal
        visible={!!alertState}
        title={alertState?.title ?? ''}
        message={alertState?.message}
        variant={alertState?.variant ?? 'info'}
        onClose={alertState?.onClose ?? (() => setAlertState(null))}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: Colors.textPrimary, lineHeight: 28 },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  container: { padding: Spacing.lg, gap: Spacing.lg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingTxt: { fontSize: FontSize.sm, color: Colors.textSecondary },
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary, marginTop: Spacing.lg },
  field: { gap: Spacing.xs },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldHint: { fontSize: FontSize.xs, color: Colors.textTertiary, fontStyle: 'italic', marginTop: -2, marginBottom: Spacing.xs },
  datesRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
  dateSep: { color: Colors.primary, fontSize: FontSize.sm, marginBottom: Spacing.xs + 8 },
  horaireRow: { flexDirection: 'row', gap: Spacing.sm },
  locationRow: { flexDirection: 'row', gap: Spacing.sm },
  priceRow: { flexDirection: 'row', gap: Spacing.sm },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  chipTextActive: { color: Colors.textInverse },
  togglesRow: { flexDirection: 'row', gap: Spacing.md },
  toggleItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  toggleLabel: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 4, alignItems: 'center', marginTop: Spacing.lg, ...Shadow.fab },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
});

const f = StyleSheet.create({
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  inputFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  smallInput: { paddingVertical: Spacing.sm },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
});
