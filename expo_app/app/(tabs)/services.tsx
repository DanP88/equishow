import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  Modal, TextInput, Alert,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { transportsStore, boxesStore, coachesStore, coachAnnoncesStore, userStore } from '../../data/store';
import { useUserRole } from '../../hooks/useUserRole';
import { prixTTC, TransportAnnonce, BoxAnnonce, CoachProfil, CoachAnnonce, Disponibilite } from '../../types/service';

type Tab = 'transport' | 'box' | 'coach';

/* ─── Filtres ──────────────────────────────────────────────────────────────── */

type SortT = 'date_asc' | 'date_desc' | 'prix_asc' | 'prix_desc' | 'places_desc';
type SortB = 'date_asc' | 'date_desc' | 'prix_asc' | 'prix_desc' | 'boxes_desc';
type SortC = 'note_desc' | 'prix_asc' | 'prix_desc';

interface FiltersTransport {
  sort: SortT;
  concours: string;
  villeDepart: string;
  placesMin: number;
}
interface FiltersBox {
  sort: SortB;
  concours: string;
  boxesMin: number;
}
interface FiltersCoach {
  sort: SortC;
  discipline: string;
  niveau: string;
  prixMax: number;
  disponibleSeulement: boolean;
}

const DEFAULT_FT: FiltersTransport = { sort: 'date_asc', concours: '', villeDepart: '', placesMin: 0 };
const DEFAULT_FB: FiltersBox = { sort: 'date_asc', concours: '', boxesMin: 0 };
const DEFAULT_FC: FiltersCoach = { sort: 'note_desc', discipline: '', niveau: '', prixMax: 999, disponibleSeulement: false };

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function unique(arr: string[]) { return [...new Set(arr.filter(Boolean))]; }

function applyTransportFilters(list: TransportAnnonce[], f: FiltersTransport) {
  let out = [...list];
  if (f.concours) out = out.filter((t) => t.concours === f.concours);
  if (f.villeDepart) out = out.filter((t) => t.villeDepart.toLowerCase().includes(f.villeDepart.toLowerCase()));
  if (f.placesMin > 0) out = out.filter((t) => t.nbPlacesDisponibles >= f.placesMin);
  if (f.sort === 'date_asc') out.sort((a, b) => a.dateTrajet.getTime() - b.dateTrajet.getTime());
  if (f.sort === 'date_desc') out.sort((a, b) => b.dateTrajet.getTime() - a.dateTrajet.getTime());
  if (f.sort === 'prix_asc') out.sort((a, b) => a.prixHT - b.prixHT);
  if (f.sort === 'prix_desc') out.sort((a, b) => b.prixHT - a.prixHT);
  if (f.sort === 'places_desc') out.sort((a, b) => b.nbPlacesDisponibles - a.nbPlacesDisponibles);
  return out;
}

function applyBoxFilters(list: BoxAnnonce[], f: FiltersBox) {
  let out = [...list];
  if (f.concours) out = out.filter((b) => b.concours === f.concours);
  if (f.boxesMin > 0) out = out.filter((b) => b.nbBoxesDisponibles >= f.boxesMin);
  if (f.sort === 'date_asc') out.sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime());
  if (f.sort === 'date_desc') out.sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime());
  if (f.sort === 'prix_asc') out.sort((a, b) => a.prixNuitHT - b.prixNuitHT);
  if (f.sort === 'prix_desc') out.sort((a, b) => b.prixNuitHT - a.prixNuitHT);
  if (f.sort === 'boxes_desc') out.sort((a, b) => b.nbBoxesDisponibles - a.nbBoxesDisponibles);
  return out;
}

function applyCoachFilters(list: CoachProfil[], f: FiltersCoach) {
  let out = [...list];
  if (f.discipline) out = out.filter((c) => c.disciplines.includes(f.discipline));
  if (f.niveau) out = out.filter((c) => c.niveaux.includes(f.niveau));
  if (f.prixMax < 999) out = out.filter((c) => c.tarifHeure <= f.prixMax);
  if (f.disponibleSeulement) out = out.filter((c) => c.disponible);
  if (f.sort === 'note_desc') out.sort((a, b) => b.note - a.note);
  if (f.sort === 'prix_asc') out.sort((a, b) => a.tarifHeure - b.tarifHeure);
  if (f.sort === 'prix_desc') out.sort((a, b) => b.tarifHeure - a.tarifHeure);
  return out;
}

/* ─── Screen ───────────────────────────────────────────────────────────────── */

export default function ServicesScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const role = useUserRole() as 'cavalier' | 'coach' | 'organisateur';
  const [tab, setTab] = useState<Tab>((params.tab as Tab) ?? 'transport');
  const [transports, setTransports] = useState(transportsStore.list);
  const [boxes, setBoxes] = useState(boxesStore.list);
  const [coachAnnonces, setCoachAnnonces] = useState(coachAnnoncesStore.list);

  const [filtersT, setFiltersT] = useState<FiltersTransport>(DEFAULT_FT);
  const [filtersB, setFiltersB] = useState<FiltersBox>(DEFAULT_FB);
  const [filtersC, setFiltersC] = useState<FiltersCoach>(DEFAULT_FC);
  const [showFilters, setShowFilters] = useState(false);

  // Refresh quand on revient sur l'écran (après publication ou modification)
  useFocusEffect(useCallback(() => {
    setTransports([...transportsStore.list]);
    setBoxes([...boxesStore.list]);
    setCoachAnnonces([...coachAnnoncesStore.list]);
    if (params.tab) setTab(params.tab as Tab);
  }, [params.tab]));

  function handleCancelTransport(id: string) {
    Alert.alert('Retirer l\'annonce', 'Êtes-vous sûr(e) de vouloir retirer ce trajet ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer', style: 'destructive',
        onPress: () => {
          transportsStore.list = transportsStore.list.filter((t) => t.id !== id);
          setTransports([...transportsStore.list]);
        },
      },
    ]);
  }

  function handleCancelBox(id: string) {
    Alert.alert('Retirer l\'annonce', 'Êtes-vous sûr(e) de vouloir retirer cette annonce de boxes ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer', style: 'destructive',
        onPress: () => {
          boxesStore.list = boxesStore.list.filter((b) => b.id !== id);
          setBoxes([...boxesStore.list]);
        },
      },
    ]);
  }

  const filteredT = applyTransportFilters(transports, filtersT);
  const filteredB = applyBoxFilters(boxes, filtersB);
  const filteredC = applyCoachFilters(coachesStore.list, filtersC);

  const concoursTransport = unique(transports.map((t) => t.concours ?? ''));
  const concoursBoxes = unique(boxes.map((b) => b.concours ?? ''));
  const disciplinesCoachs = unique(coachesStore.list.flatMap((c) => c.disciplines));
  const niveauxCoachs = unique(coachesStore.list.flatMap((c) => c.niveaux));

  const activeFiltersT = filtersT.concours || filtersT.villeDepart || filtersT.placesMin > 0 || filtersT.sort !== 'date_asc';
  const activeFiltersB = filtersB.concours || filtersB.boxesMin > 0 || filtersB.sort !== 'date_asc';
  const activeFiltersC = filtersC.discipline || filtersC.niveau || filtersC.prixMax < 999 || filtersC.disponibleSeulement || filtersC.sort !== 'note_desc';
  const hasActiveFilter = tab === 'transport' ? activeFiltersT : tab === 'box' ? activeFiltersB : activeFiltersC;

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Services</Text>
          <Text style={s.headerSub}>Transport · Box · Coaching</Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity
            style={[s.filterBtn, hasActiveFilter && s.filterBtnActive]}
            onPress={() => setShowFilters(true)}
            activeOpacity={0.8}
          >
            <Text style={s.filterIcon}>⚙️</Text>
            <Text style={[s.filterLabel, hasActiveFilter && s.filterLabelActive]}>Filtres</Text>
            {hasActiveFilter && <View style={s.filterDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={s.msgBtn} onPress={() => router.push('/messagerie')} activeOpacity={0.8}>
            <Text style={s.msgBtnIcon}>💬</Text>
            <View style={s.msgBadge}><Text style={s.msgBadgeText}>3</Text></View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stripe */}
      <View style={s.stripeBar}>
        <Text style={s.stripeIcon}>🔒</Text>
        <Text style={s.stripeText}>Paiements sécurisés via Stripe — commission 9%</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        <TabBtn label="🚐 Transport" count={filteredT.length} active={tab === 'transport'} onPress={() => setTab('transport')} />
        <TabBtn label="🏠 Box" count={filteredB.length} active={tab === 'box'} onPress={() => setTab('box')} />
        <TabBtn label="🎓 Coachs" count={filteredC.length} active={tab === 'coach'} onPress={() => setTab('coach')} />
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {tab === 'transport' && (
          <>
            <BannerAdd icon="🚐" text="Vous avez des places dans votre van ?" hint="Recommandé : 0,8€/km" cta="Proposer un trajet" route="/proposer-transport" />
            {filteredT.length === 0 && <EmptyState text="Aucun trajet ne correspond à vos filtres." />}
            {filteredT.map((t) => (
              <TransportCard
                key={t.id}
                item={t}
                onCancel={() => handleCancelTransport(t.id)}
                onModify={() => router.push(`/proposer-transport?editId=${t.id}` as any)}
              />
            ))}
          </>
        )}
        {tab === 'box' && (
          <>
            <BannerAdd icon="🏠" text="Vous avez des boxes disponibles ?" hint="Recommandé : 45–80€/nuit" cta="Proposer des boxes" route="/proposer-box" />
            {filteredB.length === 0 && <EmptyState text="Aucun box ne correspond à vos filtres." />}
            {filteredB.map((b) => (
              <BoxCard
                key={b.id}
                item={b}
                onCancel={() => handleCancelBox(b.id)}
                onModify={() => router.push(`/proposer-box?editId=${b.id}` as any)}
              />
            ))}
          </>
        )}
        {tab === 'coach' && (
          <>
            {role === 'coach' && (
              <>
                <BannerAdd icon="🎓" text="Vous êtes coach ?" hint="Proposez vos services" cta="Ajouter un profil" route="/proposer-coach" />
              </>
            )}
            {coachAnnonces.length > 0 && (
              <>
                <Text style={s.sectionTitle}>📢 Annonces des coachs</Text>
                {coachAnnonces.map((ca) => <CoachAnnonceCard key={ca.id} item={ca} />)}
              </>
            )}
            {filteredC.length > 0 && (
              <>
                <Text style={s.sectionTitle}>🎓 Profils des coachs</Text>
                {filteredC.map((c) => (
                  <CoachCard
                    key={c.id}
                    item={c}
                    onModify={role === 'coach' && c.auteurId === userStore.id ? () => router.push(`/editer-coach?coachId=${c.id}` as any) : undefined}
                  />
                ))}
              </>
            )}
            {filteredC.length === 0 && coachAnnonces.length === 0 && <EmptyState text="Aucun coach ne correspond à vos filtres." />}
          </>
        )}
      </ScrollView>

      {/* Filtres modal */}
      <Modal visible={showFilters} transparent animationType="slide">
        <TouchableOpacity style={s.filtersBackdrop} activeOpacity={1} onPress={() => setShowFilters(false)}>
          <TouchableOpacity activeOpacity={1} style={s.filtersSheet}>
            <View style={s.filtersHandle} />
            <Text style={s.filtersTitle}>Filtres & Tri — {tab === 'transport' ? 'Transport' : tab === 'box' ? 'Box' : 'Coachs'}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {tab === 'transport' && (
                <FiltersTransportPanel
                  filters={filtersT}
                  onChange={setFiltersT}
                  concoursOptions={concoursTransport}
                />
              )}
              {tab === 'box' && (
                <FiltersBoxPanel
                  filters={filtersB}
                  onChange={setFiltersB}
                  concoursOptions={concoursBoxes}
                />
              )}
              {tab === 'coach' && (
                <FiltersCoachPanel
                  filters={filtersC}
                  onChange={setFiltersC}
                  disciplines={disciplinesCoachs}
                  niveaux={niveauxCoachs}
                />
              )}
            </ScrollView>

            <View style={s.filtersFooter}>
              <TouchableOpacity
                style={s.resetBtn}
                onPress={() => {
                  if (tab === 'transport') setFiltersT(DEFAULT_FT);
                  if (tab === 'box') setFiltersB(DEFAULT_FB);
                  if (tab === 'coach') setFiltersC(DEFAULT_FC);
                }}
              >
                <Text style={s.resetText}>Réinitialiser</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.applyBtn} onPress={() => setShowFilters(false)}>
                <Text style={s.applyText}>Appliquer</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

/* ─── Filter panels ────────────────────────────────────────────────────────── */

function FiltersTransportPanel({ filters, onChange, concoursOptions }: {
  filters: FiltersTransport; onChange: (f: FiltersTransport) => void; concoursOptions: string[];
}) {
  const f = filters;
  return (
    <View style={fp.container}>
      <FilterSection title="Trier par">
        <ChipGroup
          options={[
            { label: '📅 Date ↑', value: 'date_asc' },
            { label: '📅 Date ↓', value: 'date_desc' },
            { label: '💰 Prix ↑', value: 'prix_asc' },
            { label: '💰 Prix ↓', value: 'prix_desc' },
            { label: '🐴 Places ↓', value: 'places_desc' },
          ]}
          value={f.sort}
          onSelect={(v) => onChange({ ...f, sort: v as SortT })}
        />
      </FilterSection>

      <FilterSection title="Concours associé">
        <ChipGroup
          options={[{ label: 'Tous', value: '' }, ...concoursOptions.map((c) => ({ label: c, value: c }))]}
          value={f.concours}
          onSelect={(v) => onChange({ ...f, concours: v })}
        />
      </FilterSection>

      <FilterSection title="Ville de départ">
        <TextInput
          style={fp.input}
          value={f.villeDepart}
          onChangeText={(v) => onChange({ ...f, villeDepart: v })}
          placeholder="ex: Lyon, Grenoble..."
          placeholderTextColor={Colors.textTertiary}
        />
      </FilterSection>

      <FilterSection title="Places disponibles (min)">
        <ChipGroup
          options={[
            { label: 'Tout', value: '0' },
            { label: '1+', value: '1' },
            { label: '2+', value: '2' },
            { label: '3+', value: '3' },
          ]}
          value={String(f.placesMin)}
          onSelect={(v) => onChange({ ...f, placesMin: parseInt(v) })}
        />
      </FilterSection>
    </View>
  );
}

function FiltersBoxPanel({ filters, onChange, concoursOptions }: {
  filters: FiltersBox; onChange: (f: FiltersBox) => void; concoursOptions: string[];
}) {
  const f = filters;
  return (
    <View style={fp.container}>
      <FilterSection title="Trier par">
        <ChipGroup
          options={[
            { label: '📅 Date ↑', value: 'date_asc' },
            { label: '📅 Date ↓', value: 'date_desc' },
            { label: '💰 Prix ↑', value: 'prix_asc' },
            { label: '💰 Prix ↓', value: 'prix_desc' },
            { label: '🏠 Boxes ↓', value: 'boxes_desc' },
          ]}
          value={f.sort}
          onSelect={(v) => onChange({ ...f, sort: v as SortB })}
        />
      </FilterSection>

      <FilterSection title="Concours associé">
        <ChipGroup
          options={[{ label: 'Tous', value: '' }, ...concoursOptions.map((c) => ({ label: c, value: c }))]}
          value={f.concours}
          onSelect={(v) => onChange({ ...f, concours: v })}
        />
      </FilterSection>

      <FilterSection title="Boxes disponibles (min)">
        <ChipGroup
          options={[
            { label: 'Tout', value: '0' },
            { label: '1+', value: '1' },
            { label: '2+', value: '2' },
            { label: '4+', value: '4' },
          ]}
          value={String(f.boxesMin)}
          onSelect={(v) => onChange({ ...f, boxesMin: parseInt(v) })}
        />
      </FilterSection>
    </View>
  );
}

function FiltersCoachPanel({ filters, onChange, disciplines, niveaux }: {
  filters: FiltersCoach; onChange: (f: FiltersCoach) => void; disciplines: string[]; niveaux: string[];
}) {
  const f = filters;
  return (
    <View style={fp.container}>
      <FilterSection title="Trier par">
        <ChipGroup
          options={[
            { label: '⭐ Note', value: 'note_desc' },
            { label: '💰 Prix ↑', value: 'prix_asc' },
            { label: '💰 Prix ↓', value: 'prix_desc' },
          ]}
          value={f.sort}
          onSelect={(v) => onChange({ ...f, sort: v as SortC })}
        />
      </FilterSection>

      <FilterSection title="Spécialité / Discipline">
        <ChipGroup
          options={[{ label: 'Toutes', value: '' }, ...disciplines.map((d) => ({ label: d, value: d }))]}
          value={f.discipline}
          onSelect={(v) => onChange({ ...f, discipline: v })}
        />
      </FilterSection>

      <FilterSection title="Niveau cavaliers acceptés">
        <ChipGroup
          options={[{ label: 'Tous', value: '' }, ...niveaux.map((n) => ({ label: n, value: n }))]}
          value={f.niveau}
          onSelect={(v) => onChange({ ...f, niveau: v })}
        />
      </FilterSection>

      <FilterSection title="Prix max / heure HT">
        <ChipGroup
          options={[
            { label: 'Tous', value: '999' },
            { label: '≤ 50€', value: '50' },
            { label: '≤ 70€', value: '70' },
            { label: '≤ 100€', value: '100' },
          ]}
          value={String(f.prixMax)}
          onSelect={(v) => onChange({ ...f, prixMax: parseInt(v) })}
        />
      </FilterSection>

      <FilterSection title="Disponibilité">
        <TouchableOpacity
          style={[fp.toggleBtn, f.disponibleSeulement && fp.toggleBtnActive]}
          onPress={() => onChange({ ...f, disponibleSeulement: !f.disponibleSeulement })}
        >
          <Text style={[fp.toggleText, f.disponibleSeulement && fp.toggleTextActive]}>
            {f.disponibleSeulement ? '✓ Disponibles seulement' : 'Tous les coachs'}
          </Text>
        </TouchableOpacity>
      </FilterSection>
    </View>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={fp.section}>
      <Text style={fp.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ChipGroup({ options, value, onSelect }: {
  options: { label: string; value: string }[];
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={fp.chipRow}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.value}
          style={[fp.chip, value === o.value && fp.chipActive]}
          onPress={() => onSelect(o.value)}
        >
          <Text style={[fp.chipText, value === o.value && fp.chipTextActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/* ─── Card components ──────────────────────────────────────────────────────── */

function TabBtn({ label, count, active, onPress }: {
  label: string; count: number; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[s.tabBtn, active && s.tabBtnActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[s.tabLabel, active && s.tabLabelActive]}>{label}</Text>
      <View style={[s.tabCount, active && s.tabCountActive]}>
        <Text style={[s.tabCountText, active && s.tabCountTextActive]}>{count}</Text>
      </View>
    </TouchableOpacity>
  );
}

function BannerAdd({ icon, text, hint, cta, route }: {
  icon: string; text: string; hint: string; cta: string; route: string;
}) {
  return (
    <View style={s.banner}>
      <Text style={s.bannerIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={s.bannerText}>{text}</Text>
        <Text style={s.bannerHint}>{hint}</Text>
      </View>
      <TouchableOpacity style={s.bannerBtn} onPress={() => router.push(route as any)} activeOpacity={0.8}>
        <Text style={s.bannerBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={s.emptyState}>
      <Text style={s.emptyIcon}>🔍</Text>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );
}

function AuthorRow({ initiales, couleur, pseudo, nom, onPress }: {
  initiales: string; couleur: string; pseudo: string; nom: string; onPress?: () => void;
}) {
  const Component = onPress ? TouchableOpacity : View;
  return (
    <Component
      style={s.authorRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <TouchableOpacity
        style={[s.authorAvatar, { backgroundColor: couleur }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Text style={s.authorInitiales}>{initiales}</Text>
      </TouchableOpacity>
      <View>
        <Text style={s.authorPseudo}>@{pseudo}</Text>
        <Text style={s.authorNom}>{nom}</Text>
      </View>
    </Component>
  );
}

function Tag({ icon, label, color }: { icon?: string; label: string; color?: string }) {
  return (
    <View style={s.tag}>
      {icon && <Text style={s.tagIcon}>{icon}</Text>}
      <Text style={[s.tagText, color ? { color } : {}]}>{label}</Text>
    </View>
  );
}

function TransportCard({ item, onCancel, onModify }: {
  item: TransportAnnonce; onCancel?: () => void; onModify?: () => void;
}) {
  const isOwner = item.auteurId === userStore.id;
  const date = item.dateTrajet.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
  const ttc = prixTTC(item.prixHT);
  const left = item.nbPlacesDisponibles;
  return (
    <View style={s.card}>
      {isOwner && <View style={s.ownerBadge}><Text style={s.ownerBadgeText}>Mon annonce</Text></View>}
      <View style={s.routeRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.routeDepart}>{item.villeDepart}</Text>
          <Text style={s.routeArrow}>→</Text>
          <Text style={s.routeArrivee}>{item.villeArrivee}</Text>
        </View>
        <View style={s.priceBadge}>
          <Text style={s.priceHT}>{item.prixHT}€ HT</Text>
          <Text style={s.priceTTC}>{ttc}€ TTC</Text>
        </View>
      </View>
      <View style={s.tagRow}>
        <Tag icon="📅" label={date} />
        <Tag icon="🐴" label={`${left}/${item.nbPlacesTotal} place${item.nbPlacesTotal > 1 ? 's' : ''}`} color={left > 0 ? Colors.success : Colors.urgent} />
        {item.concours && <Tag icon="🏆" label={item.concours} />}
      </View>
      {item.description && <Text style={s.description}>{item.description}</Text>}
      <View style={s.cardFooter}>
        <AuthorRow
          initiales={item.auteurInitiales}
          couleur={item.auteurCouleur}
          pseudo={item.auteurPseudo}
          nom={item.auteurNom}
          onPress={() => {
            console.log('🖱️ Transport author tapped - ID:', item.auteurId);
            router.push(`/user-profile/${item.auteurNom}` as any);
          }}
        />
        {isOwner ? (
          <View style={s.footerBtns}>
            <TouchableOpacity style={s.ownerModifyBtn} onPress={onModify}>
              <Text style={s.ownerModifyText}>✏️ Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.ownerCancelBtn} onPress={onCancel}>
              <Text style={s.ownerCancelText}>🗑 Retirer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.footerBtns}>
            <TouchableOpacity style={s.msgContactBtn} onPress={() => router.push('/messagerie')}>
              <Text style={s.msgContactText}>💬</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.ctaBtn, left === 0 && s.ctaBtnDisabled]} disabled={left === 0} onPress={() => router.push(`/reserver-transport?id=${item.id}` as any)}>
              <Text style={s.ctaText}>{left > 0 ? 'Réserver' : 'Complet'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function BoxCard({ item, onCancel, onModify }: {
  item: BoxAnnonce; onCancel?: () => void; onModify?: () => void;
}) {
  const isOwner = item.auteurId === userStore.id;
  const debut = item.dateDebut.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const fin = item.dateFin.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const ttc = prixTTC(item.prixNuitHT);
  const nbJ = Math.max(1, Math.round((item.dateFin.getTime() - item.dateDebut.getTime()) / (1000 * 60 * 60 * 24)));
  const left = item.nbBoxesDisponibles;
  return (
    <View style={s.card}>
      {isOwner && <View style={s.ownerBadge}><Text style={s.ownerBadgeText}>Mon annonce</Text></View>}
      <View style={s.routeRow}>
        <Text style={[s.routeDepart, { flex: 1 }]}>{item.lieu}</Text>
        <View style={s.priceBadge}>
          <Text style={s.priceHT}>{item.prixNuitHT}€/nuit HT</Text>
          <Text style={s.priceTTC}>{ttc}€ TTC</Text>
        </View>
      </View>
      <View style={s.tagRow}>
        <Tag icon="📅" label={`${debut} → ${fin}`} />
        <Tag icon="🌙" label={`${nbJ}j`} />
        <Tag icon="🏠" label={`${left}/${item.nbBoxes} dispo`} color={left > 0 ? Colors.success : Colors.urgent} />
        {item.concours && <Tag icon="🏆" label={item.concours} />}
      </View>
      {item.description && <Text style={s.description} numberOfLines={2}>{item.description}</Text>}
      <View style={s.cardFooter}>
        <AuthorRow
          initiales={item.auteurInitiales}
          couleur={item.auteurCouleur}
          pseudo={item.auteurPseudo}
          nom={item.auteurNom}
          onPress={() => {
            console.log('🖱️ Box author tapped - ID:', item.auteurId);
            router.push(`/user-profile/${item.auteurNom}` as any);
          }}
        />
        {isOwner ? (
          <View style={s.footerBtns}>
            <TouchableOpacity style={s.ownerModifyBtn} onPress={onModify}>
              <Text style={s.ownerModifyText}>✏️ Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.ownerCancelBtn} onPress={onCancel}>
              <Text style={s.ownerCancelText}>🗑 Retirer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.footerBtns}>
            <TouchableOpacity style={s.msgContactBtn} onPress={() => router.push('/messagerie')}>
              <Text style={s.msgContactText}>💬</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.ctaBtn, left === 0 && s.ctaBtnDisabled]} disabled={left === 0} onPress={() => router.push(`/reserver-box?id=${item.id}` as any)}>
              <Text style={s.ctaText}>{left > 0 ? 'Réserver' : 'Complet'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function CoachCard({ item, onModify }: { item: CoachProfil; onModify?: () => void }) {
  const ttc = prixTTC(item.tarifHeure);

  const handleProfilePress = () => {
    console.log('🖱️ Coach tapped - ID:', item.id);
    router.push(`/view-coach/${item.id}` as any);
  };

  return (
    <View style={s.card}>
      {/* Clickable Header Section */}
      <TouchableOpacity
        style={[s.coachHeader, { paddingVertical: 12, paddingHorizontal: 12, marginHorizontal: -12, marginTop: -12, marginBottom: 0 }]}
        onPress={handleProfilePress}
        activeOpacity={0.6}
      >
        <TouchableOpacity
          style={[s.coachAvatar, { backgroundColor: item.couleur }]}
          onPress={handleProfilePress}
          activeOpacity={0.7}
        >
          <Text style={s.coachInitiales}>{item.initiales}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={s.coachNameRow}>
            <Text style={s.coachName}>{item.prenom} {item.nom}</Text>
            {!item.disponible && <View style={s.indispoBadge}><Text style={s.indispoText}>Indisponible</Text></View>}
          </View>
          <Text style={s.coachPseudo}>@{item.pseudo}</Text>
          <View style={s.ratingRow}>
            <Text style={s.stars}>{'★'.repeat(Math.round(item.note))}</Text>
            <Text style={s.ratingNum}>{item.note.toFixed(1)}</Text>
            <Text style={s.ratingCount}>({item.nbAvis} avis)</Text>
          </View>
        </View>
        <View style={s.priceBadge}>
          <Text style={s.priceHT}>{item.tarifHeure}€/h HT</Text>
          <Text style={s.priceTTC}>{ttc}€ TTC</Text>
        </View>
      </TouchableOpacity>
      <View style={s.tagRow}>
        {item.disciplines.map((d) => <Tag key={d} label={d} color={Colors.primary} />)}
        {item.niveaux.map((n) => <Tag key={n} label={n} />)}
        <Tag icon="📍" label={item.region} />
      </View>
      <View style={s.specialiteRow}>
        {item.specialites.map((sp) => (
          <View key={sp} style={s.specialiteChip}>
            <Text style={s.specialiteText}>{sp}</Text>
          </View>
        ))}
      </View>
      <Text style={s.bio} numberOfLines={2}>{item.bio}</Text>
      <View style={s.footerBtns}>
        <TouchableOpacity style={[s.msgContactBtn, { flex: 1 }]} onPress={() => router.push('/messagerie')}>
          <Text style={s.msgContactText}>💬 Discuter</Text>
        </TouchableOpacity>
        {onModify ? (
          <TouchableOpacity style={[s.ctaBtn, { flex: 2 }]} onPress={onModify}>
            <Text style={s.ctaText}>✏️ Éditer</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[s.ctaBtn, { flex: 2 }, !item.disponible && s.ctaBtnDisabled]}
            disabled={!item.disponible}
            onPress={() => router.push(`/reserver-coach?coachId=${item.id}` as any)}
          >
            <Text style={s.ctaText}>{item.disponible ? 'Réserver une séance' : 'Indisponible'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function CoachAnnonceCard({ item }: { item: CoachAnnonce }) {
  const ttc = prixTTC(item.prixHeure);
  const heures = Math.ceil((item.dateFin.getTime() - item.dateDebut.getTime()) / (1000 * 60 * 60));
  const dateStr = item.dateDebut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' });
  const left = item.placesDisponibles;

  const handleAuthorPress = () => {
    console.log('🖱️ Coach annonce author tapped - ID:', item.auteurId);
    router.push(`user-profile/${item.auteurId}` as any);
  };

  return (
    <View style={s.card}>
      <TouchableOpacity
        style={s.annonceHeader}
        onPress={handleAuthorPress}
        activeOpacity={0.7}
      >
        <TouchableOpacity
          style={[s.coachAvatar, { backgroundColor: item.auteurCouleur }]}
          onPress={handleAuthorPress}
          activeOpacity={0.8}
        >
          <Text style={s.coachInitiales}>{item.auteurInitiales}</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.annonceTitre}>{item.titre}</Text>
          <Text style={s.annonceAuteur}>par @{item.auteurPseudo}</Text>
        </View>
      </TouchableOpacity>

      <View style={s.tagRow}>
        <Tag label={item.discipline} color={Colors.primary} />
        <Tag label={item.niveau} />
        {item.type === 'concours' && item.concours ? (
          <Tag icon="🏆" label={item.concours} />
        ) : (
          <Tag icon="📅" label={dateStr} />
        )}
      </View>

      <Text style={s.description} numberOfLines={2}>{item.description}</Text>

      {item.type === 'regulier' && item.disponibilites && item.disponibilites.length > 0 && (
        <View style={s.disponibilitesSection}>
          <Text style={s.disponibilitesTitle}>📅 Disponibilités</Text>
          <View style={s.disponibilitesGrid}>
            {item.disponibilites.map((d, idx) => (
              <View key={idx} style={s.disponibiliteTag}>
                <Text style={s.disponibiliteTagText}>
                  {d.jour.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                </Text>
                <Text style={s.disponibiliteTagHeure}>
                  {d.debut}-{d.fin}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={s.annonceDetails}>
        <View style={s.detailItem}>
          <Text style={s.detailLabel}>Tarif</Text>
          <Text style={s.detailValue}>{item.prixHeure}€/h</Text>
          <Text style={s.detailSmall}>{ttc}€ TTC</Text>
        </View>
        <View style={s.detailDivider} />
        <View style={s.detailItem}>
          <Text style={s.detailLabel}>Durée</Text>
          <Text style={s.detailValue}>{heures}h</Text>
        </View>
        <View style={s.detailDivider} />
        <View style={s.detailItem}>
          <Text style={s.detailLabel}>Places</Text>
          <Text style={[s.detailValue, left === 0 && s.detailValueFull]}>{left}/{item.places}</Text>
        </View>
      </View>

      <View style={s.footerBtns}>
        <TouchableOpacity style={[s.msgContactBtn, { flex: 1 }]} onPress={() => router.push('/messagerie')}>
          <Text style={s.msgContactText}>💬 Contacter</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.ctaBtn, { flex: 1 }, left === 0 && s.ctaBtnDisabled]}
          disabled={left === 0}
          onPress={() => router.push(`/reserver-coach?annonceId=${item.id}` as any)}
        >
          <Text style={s.ctaText}>{left > 0 ? 'Réserver' : 'Complet'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, paddingBottom: Spacing.sm },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.xs, color: Colors.textTertiary },
  headerRight: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  filterBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  filterIcon: { fontSize: 14 },
  filterLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  filterLabelActive: { color: Colors.primary },
  filterDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  msgBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  msgBtnIcon: { fontSize: 18 },
  msgBadge: { position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.urgent, alignItems: 'center', justifyContent: 'center' },
  msgBadgeText: { fontSize: 8, color: Colors.textInverse, fontWeight: FontWeight.bold },
  stripeBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, backgroundColor: Colors.surfaceVariant, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border },
  stripeIcon: { fontSize: 11 },
  stripeText: { fontSize: 10, color: Colors.textTertiary },
  tabBar: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg, paddingBottom: Spacing.sm },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  tabLabelActive: { color: Colors.textInverse },
  tabCount: { backgroundColor: Colors.border, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabCountActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  tabCountText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  tabCountTextActive: { color: Colors.textInverse },
  list: { padding: Spacing.lg, paddingTop: Spacing.xs, gap: Spacing.md, paddingBottom: 100 },
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.primaryBorder, gap: Spacing.sm },
  bannerIcon: { fontSize: 22 },
  bannerText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  bannerHint: { fontSize: FontSize.xs, color: Colors.primary, fontStyle: 'italic' },
  bannerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  bannerBtnText: { color: Colors.textInverse, fontSize: FontSize.xl, fontWeight: FontWeight.bold, lineHeight: 36 },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyIcon: { fontSize: 32 },
  emptyText: { fontSize: FontSize.sm, color: Colors.textTertiary, textAlign: 'center' },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, gap: Spacing.sm },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  routeDepart: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  routeArrow: { fontSize: FontSize.xs, color: Colors.primary },
  routeArrivee: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  priceBadge: { alignItems: 'flex-end' },
  priceHT: { fontSize: FontSize.xs, color: Colors.textTertiary },
  priceTTC: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.primary },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.surfaceVariant, borderRadius: 20, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderWidth: 1, borderColor: Colors.border },
  tagIcon: { fontSize: 10 },
  tagText: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  description: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  authorAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  authorInitiales: { color: Colors.textInverse, fontSize: 10, fontWeight: FontWeight.bold },
  authorPseudo: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  authorNom: { fontSize: 10, color: Colors.textTertiary },
  footerBtns: { flexDirection: 'row', gap: Spacing.xs },
  msgContactBtn: { borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 2, alignItems: 'center', justifyContent: 'center' },
  msgContactText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  ctaBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, alignItems: 'center' },
  ctaBtnDisabled: { backgroundColor: Colors.borderMedium },
  ctaText: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.xs },
  ownerBadge: { alignSelf: 'flex-start', backgroundColor: Colors.primaryLight, borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: Colors.primaryBorder, marginBottom: Spacing.xs },
  ownerBadgeText: { fontSize: 10, color: Colors.primary, fontWeight: FontWeight.bold },
  ownerModifyBtn: { borderWidth: 1, borderColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 2, alignItems: 'center', justifyContent: 'center' },
  ownerModifyText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  ownerCancelBtn: { borderWidth: 1, borderColor: Colors.urgent, borderRadius: Radius.md, paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 2, alignItems: 'center', justifyContent: 'center' },
  ownerCancelText: { fontSize: FontSize.xs, color: Colors.urgent, fontWeight: FontWeight.semibold },
  coachHeader: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  coachAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  coachInitiales: { color: Colors.textInverse, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  coachNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  coachName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  coachPseudo: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  stars: { color: Colors.gold, fontSize: FontSize.sm },
  ratingNum: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  ratingCount: { fontSize: FontSize.xs, color: Colors.textTertiary },
  indispoBadge: { backgroundColor: Colors.urgentBg, borderRadius: Radius.xs, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1, borderColor: Colors.urgentBorder },
  indispoText: { fontSize: 9, color: Colors.urgent, fontWeight: FontWeight.semibold },
  specialiteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  specialiteChip: { backgroundColor: Colors.primaryLight, borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: Colors.primaryBorder },
  specialiteText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  bio: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  sectionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, marginBottom: Spacing.md, marginTop: Spacing.lg },
  annonceHeader: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  annonceTitre: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  annonceAuteur: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold, marginTop: 2 },
  disponibilitesSection: { gap: Spacing.xs },
  disponibilitesTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textSecondary, textTransform: 'uppercase' },
  disponibilitesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  disponibiliteTag: { backgroundColor: Colors.primaryLight, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderWidth: 1, borderColor: Colors.primaryBorder, alignItems: 'center' },
  disponibiliteTagText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.semibold },
  disponibiliteTagHeure: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 1 },
  annonceDetails: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryLight, borderRadius: Radius.md, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, gap: Spacing.md },
  detailItem: { flex: 1, alignItems: 'center' },
  detailLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primary, marginTop: 2 },
  detailSmall: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 1 },
  detailValueFull: { color: Colors.urgent },
  detailDivider: { width: 1, height: 30, backgroundColor: Colors.primaryBorder },

  // Filtres modal
  filtersBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  filtersSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl, paddingTop: Spacing.md, maxHeight: '85%' },
  filtersHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.borderMedium, alignSelf: 'center', marginBottom: Spacing.md },
  filtersTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary, paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  filtersFooter: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg, paddingBottom: 32, borderTopWidth: 1, borderTopColor: Colors.border },
  resetBtn: { flex: 1, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  resetText: { color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  applyBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md, alignItems: 'center' },
  applyText: { color: Colors.textInverse, fontWeight: FontWeight.bold },
});

const fp = StyleSheet.create({
  container: { paddingHorizontal: Spacing.xl, gap: Spacing.lg, paddingBottom: Spacing.lg },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { paddingVertical: Spacing.xs + 2, paddingHorizontal: Spacing.md, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  chipTextActive: { color: Colors.textInverse, fontWeight: FontWeight.bold },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surfaceVariant },
  toggleBtn: { paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, alignSelf: 'flex-start' },
  toggleBtnActive: { backgroundColor: Colors.successBg, borderColor: Colors.success },
  toggleText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  toggleTextActive: { color: Colors.success },
});
