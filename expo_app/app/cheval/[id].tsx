import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Modal, TextInput, Alert, FlatList,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow, CommonStyles } from '../../constants/theme';
import { chevauxStore, userStore } from '../../data/store';
import { notificationsStore } from '../../data/notificationsStore';
import { Cheval, TypeChevalLabel, getChevalAge } from '../../types/cheval';
import { DatePickerModal, DateButton, formatDate } from '../../components/DatePickerModal';
import { PhotoAvatar } from '../../components/PhotoAvatar';

// List of available coachs
const AVAILABLE_COACHS = [
  { id: 'coach1', nom: 'Émilie Laurent', emoji: '🎓' },
  { id: 'coach2', nom: 'Marc Dubois', emoji: '🎓' },
  { id: 'coach3', nom: 'Sophie Laurent', emoji: '🎓' },
];

// ── Dropdown via Modal ────────────────────────────────────────────────────────

function Dropdown({ placeholder, value, options, onChange }: {
  placeholder: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const filled = !!value;
  return (
    <>
      <TouchableOpacity style={[dd.trigger, filled && dd.triggerFilled]} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[dd.triggerText, !filled && dd.placeholder]} numberOfLines={1}>{value || placeholder}</Text>
        <Text style={dd.arrow}>▼</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={dd.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={dd.sheet}>
            <Text style={dd.sheetTitle}>{placeholder}</Text>
            {value !== '' && (
              <TouchableOpacity style={dd.item} onPress={() => { onChange(''); setOpen(false); }}>
                <Text style={[dd.itemText, { color: Colors.textTertiary, fontStyle: 'italic' }]}>— Effacer</Text>
              </TouchableOpacity>
            )}
            {options.map((opt) => (
              <TouchableOpacity key={opt} style={[dd.item, value === opt && dd.itemActive]} onPress={() => { onChange(opt); setOpen(false); }}>
                <Text style={[dd.itemText, value === opt && dd.itemTextActive]}>{opt}</Text>
                {value === opt && <Text style={dd.check}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function MultiDropdown({ placeholder, values, options, onChange }: {
  placeholder: string; values: string[]; options: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const filled = values.length > 0;
  function toggle(opt: string) {
    if (values.includes(opt)) onChange(values.filter((v) => v !== opt));
    else onChange([...values, opt]);
  }
  return (
    <>
      <TouchableOpacity style={[dd.trigger, filled && dd.triggerFilled]} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[dd.triggerText, !filled && dd.placeholder]} numberOfLines={1}>{filled ? values.join(', ') : placeholder}</Text>
        <Text style={dd.arrow}>▼</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={dd.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={dd.sheet}>
            <Text style={dd.sheetTitle}>{placeholder}</Text>
            {options.map((opt) => {
              const sel = values.includes(opt);
              return (
                <TouchableOpacity key={opt} style={[dd.item, sel && dd.itemActive]} onPress={() => toggle(opt)}>
                  <Text style={[dd.itemText, sel && dd.itemTextActive]}>{opt}</Text>
                  {sel && <Text style={dd.check}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={dd.doneBtn} onPress={() => setOpen(false)}>
              <Text style={dd.doneBtnText}>Valider ({values.length} sélectionné{values.length > 1 ? 's' : ''})</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ── Listes options ────────────────────────────────────────────────────────────

const RACES = ['Selle Français', 'KWPN', 'Anglo-Arabe', 'Pur-Sang', 'Lusitanien', 'Andalou', 'Hanovrien', 'Oldenbourg', 'Trakehner', 'BWP', 'Connemara', 'Welsh', 'Haflinger', 'Appaloosa', 'Quarter Horse', 'Frison', 'Camargue', 'Autre'];
const ROBES = ['Bai', 'Bai brun', 'Bai clair', 'Alezan', 'Alezan brûlé', 'Gris', 'Gris pommelé', 'Noir', 'Isabelle', 'Palomino', 'Pie bai', 'Pie alezan', 'Pie noir', 'Rouan', 'Aubère', 'Louvet', 'Autre'];
const TAILLES = ['1.40 m', '1.42 m', '1.44 m', '1.46 m', '1.48 m', '1.50 m', '1.52 m', '1.54 m', '1.56 m', '1.58 m', '1.60 m', '1.62 m', '1.64 m', '1.65 m', '1.66 m', '1.67 m', '1.68 m', '1.69 m', '1.70 m', '1.72 m', '1.74 m', '1.75 m', '1.78 m', '1.80 m', '1.82 m', '1.85 m'];
const ANNEES = Array.from({ length: 35 }, (_, i) => String(2024 - i));

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

type EditSection = 'identite' | 'sante' | 'sport' | null;

function EditModal({ cheval, section: initSection = 'identite', onSave, onClose }: {
  cheval: Cheval; section?: EditSection; onSave: (c: Cheval) => void; onClose: () => void;
}) {
  // Identité
  const [nom, setNom] = useState(cheval.nom);
  const [type, setType] = useState<'cheval' | 'poney'>(cheval.type);
  const [race, setRace] = useState(cheval.race ?? '');
  const [robe, setRobe] = useState(cheval.robe ?? '');
  const [taille, setTaille] = useState(cheval.taille ?? '');
  const [sexe, setSexe] = useState(cheval.sexe ?? '');
  const [annee, setAnnee] = useState(cheval.anneeNaissance?.toString() ?? '');
  const [sire, setSire] = useState(cheval.numeroSire ?? '');
  const [avatarColor, setAvatarColor] = useState(cheval.photoColor ?? Colors.primaryDark);
  const [avatarEmoji, setAvatarEmoji] = useState('🐴');

  // Santé
  const [dateGrippe, setDateGrippe] = useState<Date | undefined>(cheval.sante?.dateVaccinGrippe);
  const [dateRhino, setDateRhino] = useState<Date | undefined>(cheval.sante?.dateVaccinRhino);
  const [autreVaccinNom, setAutreVaccinNom] = useState('');
  const [autreVaccinDate, setAutreVaccinDate] = useState<Date | undefined>();
  const [autresVaccins, setAutresVaccins] = useState<{ nom: string; date?: Date }[]>([]);
  const [dateVermifuge, setDateVermifuge] = useState<Date | undefined>(cheval.sante?.dateVermifuge);
  const [dateMarechal, setDateMarechal] = useState<Date | undefined>(cheval.sante?.dateMarechal);
  const [dateDentiste, setDateDentiste] = useState<Date | undefined>(cheval.sante?.dateDentiste);
  const [dateOsteo, setDateOsteo] = useState<Date | undefined>(cheval.sante?.dateOsteo);

  // Sport & comportement
  const [disciplines, setDisciplines] = useState<string[]>(cheval.disciplines);
  const [niveauPratique, setNiveauPratique] = useState(cheval.niveauPratique ? capitalize(cheval.niveauPratique) : '');
  const [transport, setTransport] = useState(cheval.comportementTransport ? transportLabel(cheval.comportementTransport) : '');
  const [litiere, setLitiere] = useState(cheval.gestion?.typeLitiere ? capitalize(cheval.gestion.typeLitiere) : '');
  const [sociabilite, setSociabilite] = useState(cheval.sociabilite ? sociabiliteLabel(cheval.sociabilite) : '');
  const [coachNom, setCoachNom] = useState(cheval.gestion?.responsable?.nom ?? '');
  const [coachPseudo, setCoachPseudo] = useState(cheval.gestion?.responsable?.userId ?? '');

  // Date pickers open states
  const [pickerOpen, setPickerOpen] = useState<string | null>(null);

  const [activeSection, setActiveSection] = useState<EditSection>(initSection);

  // Tag coach modal
  const [tagCoachModalVisible, setTagCoachModalVisible] = useState(false);
  const [coachSearchQuery, setCoachSearchQuery] = useState('');

  const filteredCoachs = AVAILABLE_COACHS.filter(coach =>
    coach.nom.toLowerCase().includes(coachSearchQuery.toLowerCase()) ||
    coach.id.toLowerCase().includes(coachSearchQuery.toLowerCase())
  );

  function tagCoach(coach: typeof AVAILABLE_COACHS[0]) {
    setCoachNom(coach.nom);
    setCoachPseudo(coach.id);

    // Send notification to coach
    notificationsStore.addNotification({
      type: 'mention',
      title: `🏇 ${userStore.prenom} ${userStore.nom} vous a assigné son cheval`,
      message: `Vous avez été assigné comme coach pour ${cheval.nom}`,
      author: `${userStore.prenom} ${userStore.nom}`,
      authorRole: 'Cavalier',
      relatedId: cheval.id,
    });

    setTagCoachModalVisible(false);
    setCoachSearchQuery('');
  }

  function save() {
    if (!nom.trim()) return;
    onSave({
      ...cheval,
      nom: nom.trim(), type,
      race: race || undefined, robe: robe || undefined,
      taille: taille || undefined, sexe: sexe || undefined,
      anneeNaissance: annee ? parseInt(annee, 10) : undefined,
      numeroSire: sire || undefined,
      photoColor: avatarColor,
      disciplines,
      niveauPratique: (niveauPratique.toLowerCase() as any) || undefined,
      comportementTransport: (transportKey(transport) as any) || undefined,
      sociabilite: (sociabiliteKey(sociabilite) as any) || undefined,
      sante: {
        ...cheval.sante,
        dateVaccinGrippe: dateGrippe,
        dateVaccinRhino: dateRhino,
        dateVermifuge, dateMarechal, dateDentiste, dateOsteo,
      },
      gestion: {
        ...cheval.gestion,
        typeLitiere: (litiere.toLowerCase() as any) || undefined,
        responsable: coachNom ? { nom: coachNom, userId: coachPseudo || undefined } : undefined,
      },
    });
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.editModal}>
        <View style={styles.editHeader}>
          <View>
            <Text style={styles.editTitle}>Modifier la fiche</Text>
            <Text style={styles.editSubtitle}>{cheval.nom}</Text>
          </View>
          <TouchableOpacity style={styles.saveBtn} onPress={save}>
            <Text style={styles.saveBtnText}>Enregistrer</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs sections */}
        <View style={styles.sectionTabs}>
          {(['identite', 'sante', 'sport'] as EditSection[]).map((s) => (
            <TouchableOpacity
              key={s!}
              style={[styles.sectionTab, activeSection === s && styles.sectionTabActive]}
              onPress={() => setActiveSection(s)}
            >
              <Text style={[styles.sectionTabText, activeSection === s && styles.sectionTabTextActive]}>
                {s === 'identite' ? '🪪 Identité' : s === 'sante' ? '🛡️ Santé' : '🏆 Sport'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.editBody} keyboardShouldPersistTaps="handled">

          {/* ── IDENTITÉ ── */}
          {activeSection === 'identite' && (
            <>
              {/* Photo avatar */}
              <View style={styles.avatarRow}>
                <PhotoAvatar
                  color={avatarColor}
                  emoji={avatarEmoji}
                  size={64}
                  onEdit={(c, e) => { setAvatarColor(c); setAvatarEmoji(e); }}
                />
                <Text style={styles.avatarHint}>Appuyez sur l'avatar pour le personnaliser</Text>
              </View>

              <FieldLabel label="Type" />
              <View style={[styles.typeToggle, { marginBottom: Spacing.sm }]}>
                {(['cheval', 'poney'] as const).map((t) => (
                  <TouchableOpacity key={t} style={[styles.typeBtn, type === t && styles.typeBtnActive]} onPress={() => setType(t)} activeOpacity={0.8}>
                    <Text style={styles.typeEmoji}>{t === 'cheval' ? '🐴' : '🦄'}</Text>
                    <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>{t === 'cheval' ? 'Cheval' : 'Poney'}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FieldLabel label="Nom *" />
              <TextInput style={[styles.fieldInput, { marginBottom: Spacing.sm }]} value={nom} onChangeText={setNom} placeholder="ex: Éclipse du Vent" placeholderTextColor={Colors.textTertiary} />

              <FieldLabel label="Race" />
              <View style={{ marginBottom: Spacing.sm }}><Dropdown placeholder="Sélectionner une race" value={race} options={RACES} onChange={setRace} /></View>

              <FieldLabel label="Robe" />
              <View style={{ marginBottom: Spacing.sm }}><Dropdown placeholder="Sélectionner une robe" value={robe} options={ROBES} onChange={setRobe} /></View>

              <FieldLabel label="Taille" />
              <View style={{ marginBottom: Spacing.sm }}><Dropdown placeholder="Sélectionner une taille" value={taille} options={TAILLES} onChange={setTaille} /></View>

              <FieldLabel label="Sexe" />
              <View style={{ marginBottom: Spacing.sm }}><Dropdown placeholder="Sélectionner le sexe" value={sexe} options={['Hongre', 'Jument', 'Étalon']} onChange={setSexe} /></View>

              <FieldLabel label="Année de naissance" />
              <View style={{ marginBottom: Spacing.sm }}><Dropdown placeholder="Sélectionner une année" value={annee} options={ANNEES} onChange={setAnnee} /></View>

              <FieldLabel label="Numéro SIRE" />
              <TextInput style={[styles.fieldInput, { marginBottom: Spacing.sm }]} value={sire} onChangeText={setSire} placeholder="ex: 01234567890A" placeholderTextColor={Colors.textTertiary} />
            </>
          )}

          {/* ── SANTÉ ── */}
          {activeSection === 'sante' && (
            <>
              <FieldLabel label="Vaccin Grippe — dernière injection" />
              <DateButton label="Sélectionner une date" value={dateGrippe} onPress={() => setPickerOpen('grippe')} />
              <View style={{ height: Spacing.sm }} />

              <FieldLabel label="Vaccin Rhino — dernière injection" />
              <DateButton label="Sélectionner une date" value={dateRhino} onPress={() => setPickerOpen('rhino')} />
              <View style={{ height: Spacing.sm }} />

              {/* Autres vaccins */}
              <FieldLabel label="Autres vaccins" />
              {autresVaccins.map((v, i) => (
                <View key={i} style={styles.vaccinAdded}>
                  <Text style={styles.vaccinAddedText}>💉 {v.nom}</Text>
                  <Text style={styles.vaccinAddedDate}>{v.date ? formatDate(v.date) : '—'}</Text>
                  <TouchableOpacity onPress={() => setAutresVaccins((prev) => prev.filter((_, j) => j !== i))}>
                    <Text style={styles.vaccinRemove}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.newVaccinBlock}>
                <TextInput style={[styles.fieldInput, { flex: 1 }]} value={autreVaccinNom} onChangeText={setAutreVaccinNom} placeholder="Nom du vaccin" placeholderTextColor={Colors.textTertiary} />
                <View style={{ width: Spacing.sm }} />
                <TouchableOpacity style={styles.datePickBtn} onPress={() => setPickerOpen('autreVaccin')}>
                  <Text style={styles.datePickBtnText}>{autreVaccinDate ? formatDate(autreVaccinDate) : '📅 Date'}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.vaccinValidateBtn}
                onPress={() => {
                  if (!autreVaccinNom.trim()) return;
                  setAutresVaccins((prev) => [...prev, { nom: autreVaccinNom.trim(), date: autreVaccinDate }]);
                  setAutreVaccinNom(''); setAutreVaccinDate(undefined);
                }}
              >
                <Text style={styles.vaccinValidateBtnText}>+ Ajouter ce vaccin</Text>
              </TouchableOpacity>

              <View style={{ height: Spacing.md }} />
              <FieldLabel label="Vermifuge — dernière date" />
              <DateButton label="Sélectionner une date" value={dateVermifuge} onPress={() => setPickerOpen('vermifuge')} />
              <View style={{ height: Spacing.sm }} />

              <FieldLabel label="Maréchal — dernière visite" />
              <DateButton label="Sélectionner une date" value={dateMarechal} onPress={() => setPickerOpen('marechal')} />
              <View style={{ height: Spacing.sm }} />

              <FieldLabel label="Dentiste — dernière visite" />
              <DateButton label="Sélectionner une date" value={dateDentiste} onPress={() => setPickerOpen('dentiste')} />
              <View style={{ height: Spacing.sm }} />

              <FieldLabel label="Ostéopathe — dernière visite" />
              <DateButton label="Sélectionner une date" value={dateOsteo} onPress={() => setPickerOpen('osteo')} />
            </>
          )}

          {/* ── SPORT & COMPORTEMENT ── */}
          {activeSection === 'sport' && (
            <>
              <FieldLabel label="Discipline(s)" />
              <View style={{ marginBottom: Spacing.sm }}>
                <MultiDropdown placeholder="Sélectionner les disciplines" values={disciplines} options={['CSO', 'Dressage', 'CCE', 'Hunter', 'Équitation de Travail', 'Autre']} onChange={setDisciplines} />
              </View>

              <FieldLabel label="Niveau de pratique" />
              <View style={{ marginBottom: Spacing.sm }}>
                <Dropdown placeholder="Sélectionner un niveau" value={niveauPratique} options={['Poney', 'Club', 'Amateur', 'Pro']} onChange={setNiveauPratique} />
              </View>

              <FieldLabel label="Comportement au transport" />
              <View style={{ marginBottom: Spacing.sm }}>
                <Dropdown placeholder="Sélectionner un comportement" value={transport} options={['Calme', 'Stressé', 'Chargement difficile']} onChange={setTransport} />
              </View>

              <FieldLabel label="Type de litière" />
              <View style={{ marginBottom: Spacing.sm }}>
                <Dropdown placeholder="Sélectionner un type" value={litiere} options={['Paille', 'Copeaux', 'Paillettes', 'Autre']} onChange={setLitiere} />
              </View>

              <FieldLabel label="Sociabilité avec les congénères" />
              <View style={{ marginBottom: Spacing.sm }}>
                <Dropdown placeholder="Comportement avec les autres chevaux" value={sociabilite} options={['Sociable — se mélange bien', 'Dominant', 'Solitaire', 'Variable selon congénères']} onChange={setSociabilite} />
              </View>

              {/* Coach attitré */}
              <View style={styles.coachTagSection}>
                <Text style={styles.coachTagTitle}>🎓 Coach attitré</Text>
                <Text style={styles.coachTagHint}>Coach qui accompagne ce cheval au quotidien (doit être inscrit sur Equishow)</Text>
                <FieldLabel label="Nom du coach" />
                <TouchableOpacity
                  style={[styles.fieldInput, { marginBottom: Spacing.sm, paddingHorizontal: 0 }]}
                  onPress={() => setTagCoachModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <View style={styles.nomInputWrapper}>
                    <TextInput
                      style={styles.nomInput}
                      value={coachNom}
                      onChangeText={setCoachNom}
                      placeholder="ex: Émilie Laurent"
                      placeholderTextColor={Colors.textTertiary}
                      editable={false}
                    />
                    <Text style={styles.searchIconRight}>🔍</Text>
                  </View>
                </TouchableOpacity>
                <FieldLabel label="Pseudo Equishow (@)" />
                <TouchableOpacity
                  style={[styles.fieldInput, { marginBottom: Spacing.sm, paddingHorizontal: 0 }]}
                  onPress={() => setTagCoachModalVisible(true)}
                  activeOpacity={0.8}
                >
                  <View style={styles.pseudoInputWrapper}>
                    <TextInput
                      style={styles.pseudoInput}
                      value={coachPseudo}
                      onChangeText={setCoachPseudo}
                      placeholder="ex: EmilieLaurent_Pro"
                      placeholderTextColor={Colors.textTertiary}
                      autoCapitalize="none"
                      editable={false}
                    />
                    <Text style={styles.searchIconRight}>🔍</Text>
                  </View>
                </TouchableOpacity>

                {coachNom ? (
                  <View style={styles.coachTagPreview}>
                    <Text style={styles.coachTagPreviewIcon}>🎓</Text>
                    <View>
                      <Text style={styles.coachTagPreviewName}>{coachNom}</Text>
                      {coachPseudo ? <Text style={styles.coachTagPreviewPseudo}>@{coachPseudo}</Text> : null}
                    </View>
                    <TouchableOpacity style={styles.coachTagRemove} onPress={() => { setCoachNom(''); setCoachPseudo(''); }}>
                      <Text style={styles.coachTagRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Annuler</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Date pickers */}
      <DatePickerModal visible={pickerOpen === 'grippe'} value={dateGrippe} title="Vaccin Grippe" onConfirm={setDateGrippe} onClose={() => setPickerOpen(null)} />
      <DatePickerModal visible={pickerOpen === 'rhino'} value={dateRhino} title="Vaccin Rhino" onConfirm={setDateRhino} onClose={() => setPickerOpen(null)} />
      <DatePickerModal visible={pickerOpen === 'autreVaccin'} value={autreVaccinDate} title="Date du vaccin" onConfirm={setAutreVaccinDate} onClose={() => setPickerOpen(null)} />
      <DatePickerModal visible={pickerOpen === 'vermifuge'} value={dateVermifuge} title="Vermifuge" onConfirm={setDateVermifuge} onClose={() => setPickerOpen(null)} />
      <DatePickerModal visible={pickerOpen === 'marechal'} value={dateMarechal} title="Maréchal" onConfirm={setDateMarechal} onClose={() => setPickerOpen(null)} />
      <DatePickerModal visible={pickerOpen === 'dentiste'} value={dateDentiste} title="Dentiste" onConfirm={setDateDentiste} onClose={() => setPickerOpen(null)} />
      <DatePickerModal visible={pickerOpen === 'osteo'} value={dateOsteo} title="Ostéopathe" onConfirm={setDateOsteo} onClose={() => setPickerOpen(null)} />

      {/* Tag Coach Modal */}
      <Modal visible={tagCoachModalVisible} transparent animationType="slide">
        <View style={styles.tagCoachBackdrop}>
          <View style={styles.tagCoachContent}>
            <View style={styles.tagCoachHeader}>
              <Text style={styles.tagCoachTitle}>Rechercher un coach</Text>
              <TouchableOpacity onPress={() => {
                setTagCoachModalVisible(false);
                setCoachSearchQuery('');
              }}>
                <Text style={styles.tagCoachClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Cherchez par nom ou @pseudo..."
                placeholderTextColor={Colors.textTertiary}
                value={coachSearchQuery}
                onChangeText={setCoachSearchQuery}
              />
              {coachSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setCoachSearchQuery('')}>
                  <Text style={styles.clearIcon}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Results */}
            {filteredCoachs.length > 0 ? (
              <FlatList
                data={filteredCoachs}
                scrollEnabled={false}
                contentContainerStyle={styles.coachListContainer}
                renderItem={({ item: coach }) => (
                  <TouchableOpacity
                    style={styles.coachListItem}
                    onPress={() => tagCoach(coach)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.coachListEmoji}>{coach.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.coachListName}>{coach.nom}</Text>
                      <Text style={styles.coachListId}>@{coach.id}</Text>
                    </View>
                    <Text style={styles.coachListArrow}>›</Text>
                  </TouchableOpacity>
                )}
                keyExtractor={(item) => item.id}
              />
            ) : (
              <View style={styles.noCoachResults}>
                <Text style={styles.noResultsIcon}>🔎</Text>
                <Text style={styles.noResultsText}>Aucun coach trouvé</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.tagCoachCancel}
              onPress={() => {
                setTagCoachModalVisible(false);
                setCoachSearchQuery('');
              }}
            >
              <Text style={styles.tagCoachCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
function transportLabel(k: string) { return { calme: 'Calme', stresse: 'Stressé', chargementDifficile: 'Chargement difficile' }[k] ?? k; }
function transportKey(l: string) { return { 'Calme': 'calme', 'Stressé': 'stresse', 'Chargement difficile': 'chargementDifficile' }[l] ?? ''; }
function sociabiliteLabel(k: string) { return { okCongeneres: 'Sociable — se mélange bien', dominant: 'Dominant', solitaire: 'Solitaire', autre: 'Variable selon congénères' }[k] ?? k; }
function sociabiliteKey(l: string) { return { 'Sociable — se mélange bien': 'okCongeneres', 'Dominant': 'dominant', 'Solitaire': 'solitaire', 'Variable selon congénères': 'autre' }[l] ?? ''; }

// ── Écran principal ───────────────────────────────────────────────────────────

export default function ChevalDetailScreen() {
  const { id, new: isNew } = useLocalSearchParams<{ id: string; new?: string }>();
  const [chevaux, setChevaux] = useState(chevauxStore.list);
  const [showEdit, setShowEdit] = useState(isNew === 'true');
  const [editSection, setEditSection] = useState<EditSection>('identite');

  const cheval = chevaux.find((c) => c.id === id);

  function handleBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/chevaux');
  }

  if (!cheval) {
    return (
      <SafeAreaView style={styles.root}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}><Text style={styles.backIcon}>←</Text></TouchableOpacity>
        <View style={styles.notFound}><Text>Cheval introuvable</Text></View>
      </SafeAreaView>
    );
  }

  function handleSave(updated: Cheval) {
    chevauxStore.list = chevauxStore.list.map((c) => (c.id === updated.id ? updated : c));
    setChevaux([...chevauxStore.list]);
    setShowEdit(false);
  }

  function openEdit(section: EditSection) {
    setEditSection(section);
    setShowEdit(true);
  }

  function handleDelete() {
    if (!cheval) return;
    Alert.alert(
      `Supprimer ${cheval.nom} ?`,
      'Cette action est irréversible. Toutes les données de ce cheval seront perdues.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer', style: 'destructive', onPress: () => {
            chevauxStore.list = chevauxStore.list.filter((c) => c.id !== id);
            handleBack();
          },
        },
      ],
    );
  }

  const hasPhoto = !!cheval.photoColor;

  return (
    <SafeAreaView style={styles.root}>
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: cheval.photoColor ?? Colors.primaryDark }]}>
        <View style={styles.heroTopBar}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>🗑</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.heroBody}>
          <PhotoAvatar color={cheval.photoColor ?? Colors.primaryDark} emoji="🐴" size={72} />
          <View style={styles.heroText}>
            <View style={styles.typePillWrap}>
              <Text style={styles.typePillText}>{TypeChevalLabel[cheval.type]}</Text>
            </View>
            <Text style={styles.heroName}>{cheval.nom}</Text>
            {cheval.race && <Text style={styles.heroSub}>{[cheval.race, cheval.robe].filter(Boolean).join(' · ')}</Text>}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>

        {/* Identité */}
        <Section title="Identité" icon="🪪" onEdit={() => openEdit('identite')}>
          <View style={styles.chips}>
            <InfoChip label="Type" value={TypeChevalLabel[cheval.type]} />
            {cheval.race && <InfoChip label="Race" value={cheval.race} />}
            {cheval.sexe && <InfoChip label="Sexe" value={cheval.sexe} color={Colors.info} />}
            {cheval.robe && <InfoChip label="Robe" value={cheval.robe} color="#7C3AED" />}
            {cheval.anneeNaissance && <InfoChip label="Âge" value={getChevalAge(cheval.anneeNaissance)} color={Colors.warning} />}
            {cheval.taille && <InfoChip label="Taille" value={cheval.taille} color={Colors.success} />}
            {cheval.numeroSire && <InfoChip label="SIRE" value={cheval.numeroSire} color={Colors.textSecondary} />}
          </View>
          {!cheval.race && !cheval.sexe && !cheval.taille && (
            <Text style={styles.emptyHint}>Appuyez sur Modifier pour compléter la fiche.</Text>
          )}
        </Section>

        {/* Santé */}
        <Section title="Santé" icon="🛡️" onEdit={() => openEdit('sante')}>
          {cheval.sante ? (
            <>
              <View style={styles.santeGrid}>
                {cheval.sante.dateVaccinGrippe && <SanteVaccinItem label="Grippe" date={cheval.sante.dateVaccinGrippe} />}
                {cheval.sante.dateVaccinRhino && <SanteVaccinItem label="Rhino" date={cheval.sante.dateVaccinRhino} />}
              </View>
              <View style={styles.santeList}>
                {cheval.sante.dateVermifuge && <SanteRow icon="💊" label="Vermifuge" date={cheval.sante.dateVermifuge} />}
                {cheval.sante.dateMarechal && <SanteRow icon="🔨" label="Maréchal" date={cheval.sante.dateMarechal} />}
                {cheval.sante.dateDentiste && <SanteRow icon="🦷" label="Dentiste" date={cheval.sante.dateDentiste} />}
                {cheval.sante.dateOsteo && <SanteRow icon="🦴" label="Ostéo" date={cheval.sante.dateOsteo} />}
              </View>
            </>
          ) : (
            <Text style={styles.emptyHint}>Aucune donnée de santé. Appuyez sur Modifier.</Text>
          )}
        </Section>

        {/* Sport & travail */}
        <Section title="Sport & Travail" icon="🏆" onEdit={() => openEdit('sport')}>
          {cheval.disciplines.length > 0 ? (
            <View style={styles.chips}>
              {cheval.disciplines.map((d) => (
                <View key={d} style={[styles.disciplineChip, { backgroundColor: Colors.successBg, borderColor: Colors.successBorder }]}>
                  <Text style={[styles.disciplineText, { color: Colors.success }]}>{d}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyHint}>Aucune discipline renseignée.</Text>
          )}
          {cheval.niveauPratique && (
            <View style={[styles.chips, { marginTop: Spacing.sm }]}>
              <InfoChip label="Niveau" value={capitalize(cheval.niveauPratique)} color={Colors.primary} />
              {cheval.comportementTransport && <InfoChip label="Transport" value={transportLabel(cheval.comportementTransport)} color={Colors.warning} />}
              {cheval.sociabilite && <InfoChip label="Sociabilité" value={sociabiliteLabel(cheval.sociabilite)} color="#7C3AED" />}
            </View>
          )}
          {/* Coach attitré */}
          {cheval.gestion?.responsable?.nom ? (
            <View style={styles.coachTag}>
              <Text style={styles.coachTagLabel}>🎓 Coach attitré</Text>
              <View style={styles.coachTagBody}>
                <View style={styles.coachTagAvatar}>
                  <Text style={styles.coachTagAvatarText}>{cheval.gestion.responsable.nom.split(' ').map(w => w[0]).join('').slice(0,2)}</Text>
                </View>
                <View>
                  <Text style={styles.coachTagName}>{cheval.gestion.responsable.nom}</Text>
                  {cheval.gestion.responsable.userId ? (
                    <Text style={styles.coachTagPseudo}>@{cheval.gestion.responsable.userId}</Text>
                  ) : null}
                </View>
                <TouchableOpacity style={styles.coachTagMsg} onPress={() => router.push('/messagerie')}>
                  <Text style={styles.coachTagMsgText}>💬</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.coachTagEmpty} onPress={() => openEdit('sport')}>
              <Text style={styles.coachTagEmptyText}>+ Tagger un coach</Text>
            </TouchableOpacity>
          )}
        </Section>

        {/* Concours à venir */}
        {cheval.concours.length > 0 && (
          <Section title="Concours à venir" icon="📅">
            {cheval.concours.map((c) => (
              <View key={c.id} style={styles.concoursItem}>
                <Text style={styles.concoursNom}>{c.nom}</Text>
                <Text style={styles.concoursInfo}>{c.date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })} · {c.lieu}</Text>
                {c.numEngagement && <Text style={styles.engagement}>Dossard #{c.numEngagement}</Text>}
              </View>
            ))}
          </Section>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* FAB Modifier */}
      <TouchableOpacity style={styles.fab} onPress={() => openEdit('identite')} activeOpacity={0.85}>
        <Text style={styles.fabIcon}>✏️</Text>
        <Text style={styles.fabText}>Modifier</Text>
      </TouchableOpacity>

      <Modal visible={showEdit} transparent animationType="fade">
        <EditModal cheval={cheval} section={editSection} onSave={handleSave} onClose={() => setShowEdit(false)} />
      </Modal>
    </SafeAreaView>
  );
}

// ── UI Helpers ────────────────────────────────────────────────────────────────

function Section({ title, icon, onEdit, children }: { title: string; icon: string; onEdit?: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={onEdit} activeOpacity={onEdit ? 0.7 : 1}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onEdit && (
          <View style={styles.sectionEditBtn}>
            <Text style={styles.sectionEditText}>✏️ Modifier</Text>
          </View>
        )}
      </TouchableOpacity>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function InfoChip({ label, value, color = Colors.primary }: { label: string; value: string; color?: string }) {
  return (
    <View style={[styles.infoChip, { borderColor: color + '40', backgroundColor: color + '15' }]}>
      <Text style={[styles.infoChipLabel, { color: Colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoChipValue, { color }]}>{value}</Text>
    </View>
  );
}

function SanteVaccinItem({ label, date }: { label: string; date: Date }) {
  return (
    <View style={styles.santeItem}>
      <View style={styles.santeStatusDot} />
      <View>
        <Text style={styles.santeLabel}>{label}</Text>
        <Text style={[styles.santeStatus, { color: Colors.success }]}>Valide</Text>
        <Text style={styles.santeDate}>{formatDate(date)}</Text>
      </View>
    </View>
  );
}

function SanteRow({ icon, label, date }: { icon: string; label: string; date: Date }) {
  return (
    <View style={styles.santeRow}>
      <Text style={styles.santeRowIcon}>{icon}</Text>
      <Text style={styles.santeRowLabel}>{label}</Text>
      <Text style={styles.santeRowDate}>{formatDate(date)}</Text>
    </View>
  );
}

// ── Styles Dropdown ───────────────────────────────────────────────────────────

const dd = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, backgroundColor: Colors.surface },
  triggerFilled: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  triggerText: { fontSize: FontSize.base, color: Colors.textPrimary, flex: 1, fontWeight: FontWeight.medium },
  placeholder: { color: Colors.textTertiary, fontWeight: '400' },
  arrow: { fontSize: 10, color: Colors.textTertiary, marginLeft: Spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, paddingBottom: 32, paddingTop: Spacing.lg, ...Shadow.modal, maxHeight: '70%' },
  sheetTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textSecondary, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemActive: { backgroundColor: Colors.primaryLight },
  itemText: { fontSize: FontSize.lg, color: Colors.textPrimary },
  itemTextActive: { color: Colors.primary, fontWeight: FontWeight.semibold },
  check: { color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.lg },
  doneBtn: { margin: Spacing.lg, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center' },
  doneBtnText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
});

// ── Styles principaux ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  hero: { paddingTop: Spacing.md, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.lg, minHeight: 160 },
  heroTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  deleteBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(220,38,38,0.35)', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { fontSize: 16 },
  heroBody: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  heroText: { flex: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: Colors.textInverse, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  typePillWrap: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.xs, marginBottom: Spacing.xs },
  typePillText: { color: Colors.textInverse, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  heroName: { fontSize: FontSize.xxxl, fontWeight: FontWeight.extrabold, color: Colors.textInverse },
  heroSub: { fontSize: FontSize.base, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  body: { padding: Spacing.lg, paddingBottom: 120 },

  section: { ...CommonStyles.card, marginBottom: Spacing.md, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sectionIcon: { fontSize: 18 },
  sectionTitle: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sectionEditBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.xs, backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primaryBorder },
  sectionEditText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  sectionBody: { padding: Spacing.lg },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  infoChip: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 1, borderRadius: Radius.sm, borderWidth: 1, minWidth: 80 },
  infoChipLabel: { fontSize: 9, fontWeight: FontWeight.semibold, textTransform: 'uppercase', marginBottom: 1 },
  infoChipValue: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  emptyHint: { fontSize: FontSize.sm, color: Colors.textTertiary, fontStyle: 'italic' },

  // Coach tag
  coachTag: { marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  coachTagLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: Spacing.sm },
  coachTagBody: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.lg, padding: Spacing.sm + 2, borderWidth: 1, borderColor: Colors.border },
  coachTagAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  coachTagAvatarText: { color: Colors.textInverse, fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  coachTagName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  coachTagPseudo: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  coachTagMsg: { marginLeft: 'auto', width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  coachTagMsgText: { fontSize: 18 },
  coachTagEmpty: { marginTop: Spacing.md, borderWidth: 1, borderColor: Colors.primaryBorder, borderRadius: Radius.md, paddingVertical: Spacing.sm, alignItems: 'center', borderStyle: 'dashed', backgroundColor: Colors.primaryLight },
  coachTagEmptyText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },

  // Edit modal coach section
  coachTagSection: { backgroundColor: Colors.surfaceVariant, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm, gap: Spacing.xs },
  coachTagTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  coachTagHint: { fontSize: FontSize.xs, color: Colors.textTertiary, marginBottom: Spacing.xs, lineHeight: 18 },
  coachTagPreview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.primaryLight, borderRadius: Radius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.primaryBorder },
  coachTagPreviewIcon: { fontSize: 20 },
  coachTagPreviewName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  coachTagPreviewPseudo: { fontSize: FontSize.xs, color: Colors.primary },
  coachTagRemove: { marginLeft: 'auto', width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.urgentBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.urgentBorder },
  coachTagRemoveText: { fontSize: 12, color: Colors.urgent, fontWeight: FontWeight.bold },
  santeGrid: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  santeItem: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md, backgroundColor: Colors.successBg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.successBorder },
  santeStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success, marginTop: 4 },
  santeLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  santeStatus: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  santeDate: { fontSize: FontSize.xs, color: Colors.textSecondary },
  santeList: { gap: Spacing.sm },
  santeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  santeRowIcon: { fontSize: 14, width: 20 },
  santeRowLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  santeRowDate: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.primary },
  disciplineChip: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 1, borderRadius: Radius.sm, borderWidth: 1 },
  disciplineText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  concoursItem: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  concoursNom: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  concoursInfo: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  engagement: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold, marginTop: 2 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', bottom: 100, right: Spacing.lg, backgroundColor: Colors.primary, borderRadius: 28, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm, ...Shadow.fab },
  fabIcon: { fontSize: 16 },
  fabText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  editModal: { backgroundColor: Colors.surface, borderRadius: Radius.xxl, width: '100%', maxHeight: '92%', ...Shadow.modal },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  editTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  editSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },
  saveBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  saveBtnText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  sectionTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  sectionTab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  sectionTabActive: { borderBottomColor: Colors.primary },
  sectionTabText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  sectionTabTextActive: { color: Colors.primary },

  editBody: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.xs, marginTop: 2 },
  fieldInput: { borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },

  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg, padding: Spacing.md, backgroundColor: Colors.surfaceVariant, borderRadius: Radius.md },
  avatarHint: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },

  typeToggle: { flexDirection: 'row', gap: Spacing.sm },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingVertical: Spacing.md, backgroundColor: Colors.surfaceVariant },
  typeBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  typeEmoji: { fontSize: 20 },
  typeBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  typeBtnTextActive: { color: Colors.primary },

  vaccinAdded: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.successBg, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs + 1, marginBottom: Spacing.xs, borderWidth: 1, borderColor: Colors.successBorder },
  vaccinAddedText: { flex: 1, fontSize: FontSize.sm, color: Colors.success, fontWeight: FontWeight.semibold },
  vaccinAddedDate: { fontSize: FontSize.xs, color: Colors.textSecondary, marginRight: Spacing.sm },
  vaccinRemove: { fontSize: FontSize.sm, color: Colors.urgent, fontWeight: FontWeight.bold, paddingHorizontal: 4 },
  newVaccinBlock: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  datePickBtn: { borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm + 2, backgroundColor: Colors.surface },
  datePickBtnText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  vaccinValidateBtn: { borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.sm, paddingVertical: Spacing.xs + 2, alignItems: 'center', backgroundColor: Colors.primaryLight, marginBottom: Spacing.md },
  vaccinValidateBtnText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },

  cancelBtn: { borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  cancelBtnText: { color: Colors.textSecondary, fontWeight: FontWeight.semibold },

  // Coach search fields
  nomInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  nomInput: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  pseudoInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  pseudoInput: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  searchIconRight: { fontSize: 16, color: Colors.textTertiary },
  tagCoachBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  tagCoachContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.lg,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  tagCoachHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  tagCoachTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, flex: 1 },
  tagCoachClose: { fontSize: FontSize.lg, color: Colors.textTertiary },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: FontSize.sm,
  },
  clearIcon: { fontSize: 16, color: Colors.textTertiary },
  coachListContainer: { gap: Spacing.sm, marginBottom: Spacing.lg },
  coachListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  coachListEmoji: { fontSize: 20 },
  coachListName: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  coachListId: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  coachListArrow: { fontSize: FontSize.lg, color: Colors.textTertiary },
  noCoachResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  noResultsIcon: { fontSize: 48, marginBottom: Spacing.md },
  noResultsText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  tagCoachCancel: {
    borderWidth: 1,
    borderColor: Colors.borderMedium,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  tagCoachCancelText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
});
