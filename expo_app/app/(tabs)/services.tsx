import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
  Modal, TextInput, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { userStore } from '../../data/store';
import { useConcoursList, useConcoursAvailableBoxIds } from '../../hooks/useConcours';
import { countEpreuves } from '../../lib/epreuves';
import { displayCity } from '../../lib/address';
import { useTransportAnnonces, useMyTransportAnnonces } from '../../hooks/useTransports';
import { useBoxAnnonces, useMyBoxAnnonces } from '../../hooks/useBoxes';
import { useCoachAnnonces, useMyCoachAnnonces } from '../../hooks/useCoachAnnonces';
import { useUnreadMessagesCount } from '../../hooks/useMessaging';
import { useStages } from '../../hooks/useStages';
import { useCoachProfiles } from '../../hooks/useCoachProfiles';
import { SERVICES_DEV_SEED, MOCK_BOX_ANNONCES, MOCK_COACH_ANNONCES } from '../../data/mockServices';
import { useAvisStats } from '../../hooks/useAvis';
import { useUserRole } from '../../hooks/useUserRole';
import { prixTTC, getCommission, TransportAnnonce, BoxAnnonce, CoachProfil, CoachAnnonce, CoachStage, Disponibilite } from '../../types/service';
import { useScreenTracking } from '../../hooks/useScreenTracking';
import { trackFunnel } from '../../lib/analytics';
import { ConfirmModal } from '../../components/ConfirmModal';
import { AlertModal } from '../../components/AlertModal';

type Tab = 'transport' | 'box' | 'coach';
type TransportSubTab = 'trajets' | 'van';
type CoachTab = 'concours' | 'stages';

/* ─── Filtres ──────────────────────────────────────────────────────────────── */

type SortT = 'date_asc' | 'date_desc' | 'prix_asc' | 'prix_desc' | 'places_desc';
type SortB = 'date_asc' | 'date_desc' | 'prix_asc' | 'prix_desc' | 'boxes_desc';
type SortC = 'note_desc' | 'prix_asc' | 'prix_desc';

// `concours` = nom (affichage + fallback annonces legacy sans FK).
// `concoursId` = FK public.concours (074), clé canonique quand on arrive depuis
// une fiche concours — c'est celle qu'utilise le compteur (useConcoursCounts).
interface FiltersTransport {
  sort: SortT;
  concours: string;
  concoursId?: string;
  villeDepart: string;
  placesMin: number;
}
interface FiltersBox {
  sort: SortB;
  concours: string;
  concoursId?: string;
  boxesMin: number;
}
interface FiltersCoach {
  sort: SortC;
  concours: string;
  concoursId?: string;
  discipline: string;
  niveau: string;
  prixMax: number;
  disponibleSeulement: boolean;
}

const DEFAULT_FT: FiltersTransport = { sort: 'date_asc', concours: '', concoursId: undefined, villeDepart: '', placesMin: 0 };
const DEFAULT_FB: FiltersBox = { sort: 'date_asc', concours: '', concoursId: undefined, boxesMin: 0 };
const DEFAULT_FC: FiltersCoach = { sort: 'note_desc', concours: '', concoursId: undefined, discipline: '', niveau: '', prixMax: 999, disponibleSeulement: false };

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function unique(arr: string[]) { return [...new Set(arr.filter(Boolean))]; }

function applyTransportFilters(list: TransportAnnonce[], f: FiltersTransport) {
  let out = [...list];
  // Priorité à la clé canonique (FK). Fallback sur le nom pour les annonces
  // legacy sans concours_id et pour la sélection manuelle du filtre.
  if (f.concoursId) out = out.filter((t) => t.concoursId === f.concoursId);
  else if (f.concours) out = out.filter((t) => t.concours === f.concours);
  if (f.villeDepart) out = out.filter((t) => t.villeDepart.toLowerCase().includes(f.villeDepart.toLowerCase()));
  if (f.placesMin > 0) out = out.filter((t) => t.nbPlacesDisponibles >= f.placesMin);
  if (f.sort === 'date_asc') out.sort((a, b) => a.dateTrajet.getTime() - b.dateTrajet.getTime());
  if (f.sort === 'date_desc') out.sort((a, b) => b.dateTrajet.getTime() - a.dateTrajet.getTime());
  if (f.sort === 'prix_asc') out.sort((a, b) => a.prixHT - b.prixHT);
  if (f.sort === 'prix_desc') out.sort((a, b) => b.prixHT - a.prixHT);
  if (f.sort === 'places_desc') out.sort((a, b) => b.nbPlacesDisponibles - a.nbPlacesDisponibles);
  return out;
}

function applyBoxFilters(list: BoxAnnonce[], f: FiltersBox, availableConcoursBoxIds?: Set<string> | null) {
  let out = [...list];
  // Priorité à la clé canonique (FK).
  // - Arrivée depuis un concours : disponibilité DATE-AWARE pour les dates du
  //   concours (`availableConcoursBoxIds`, RPC fn_concours_available_box_annonce_ids).
  //   Fallback (RPC absente = mig 104 pas encore appliquée) : `nbBoxesDisponibles > 0`.
  // - Fallback nom : legacy sans concours_id + sélection manuelle.
  if (f.concoursId) {
    out = availableConcoursBoxIds
      ? out.filter((b) => b.concoursId === f.concoursId && availableConcoursBoxIds.has(b.id))
      : out.filter((b) => b.concoursId === f.concoursId && b.nbBoxesDisponibles > 0);
  } else if (f.concours) out = out.filter((b) => b.concours === f.concours);
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
  // Tri prioritaire (sort stable, n'altère pas l'ordre intra-groupe) :
  //   1. Boost payant (visibilité sponsorisée)
  //   2. Coach Certifié (mérite auto)
  //   3. Featured plan annuel (legacy)
  out.sort((a, b) => {
    const rank = (c: CoachProfil) =>
      (c.isBoosted ? 4 : 0) + (c.isCertified ? 2 : 0) + (c.featured ? 1 : 0);
    return rank(b) - rank(a);
  });
  return out;
}

/* ─── Screen ───────────────────────────────────────────────────────────────── */

export default function ServicesScreen() {
  useScreenTracking('services');
  const params = useLocalSearchParams<{ tab?: string; subTab?: string; concours?: string; concoursId?: string }>();
  const role = useUserRole() as 'cavalier' | 'coach' | 'organisateur';
  const [tab, setTab] = useState<Tab>((params.tab as Tab) ?? 'box');
  const [transportSubTab, setTransportSubTab] = useState<TransportSubTab>((params.subTab as TransportSubTab) ?? 'trajets');
  const [coachTab, setCoachTab] = useState<CoachTab>('concours');
  // Option 3 — bascule de l'écran : « Par concours » (entrée concours-first, défaut)
  // vs « Tous les services » (vue marketplace classique à onglets). Non destructif :
  // le mode « tous » conserve exactement le parcours Box/Transport/Coach existant.
  const [viewMode, setViewMode] = useState<'concours' | 'tous'>('concours');
  const { transports, isLoading: transportsLoading } = useTransportAnnonces();
  const { deleteAnnonce: deleteTransportAnnonce } = useMyTransportAnnonces();
  const { boxes: boxesReal, isLoading: boxesLoading } = useBoxAnnonces();
  const { deleteAnnonce: deleteBoxAnnonce } = useMyBoxAnnonces();
  const { annonces: coachAnnoncesReal, isLoading: coachAnnoncesLoading } = useCoachAnnonces();
  // SEED DEV (front-only, __DEV__) : ajoute des offres d'exemple (box + coaching)
  // pour « CSO de Saumur » afin de tester l'atterrissage depuis l'accueil. Cf. data/mockServices.
  const boxes = (__DEV__ && SERVICES_DEV_SEED) ? [...MOCK_BOX_ANNONCES, ...boxesReal] : boxesReal;
  const coachAnnonces = (__DEV__ && SERVICES_DEV_SEED) ? [...MOCK_COACH_ANNONCES, ...coachAnnoncesReal] : coachAnnoncesReal;
  const { deleteAnnonce: deleteCoachAnnonce } = useMyCoachAnnonces();
  const { stages } = useStages();
  const { coaches, isLoading: coachesLoading } = useCoachProfiles();
  // Concours = table public.concours (DB, plus de mock concoursStore). Sert au coach
  // pour rattacher une annonce à un concours réel (concours_id FK valide) + ouvrir
  // la fiche concours DB (épreuves importées). Filtré « à venir » côté rendu.
  const { concours: dbConcours } = useConcoursList();

  const [filtersT, setFiltersT] = useState<FiltersTransport>(DEFAULT_FT);
  const [filtersB, setFiltersB] = useState<FiltersBox>(DEFAULT_FB);
  const [filtersC, setFiltersC] = useState<FiltersCoach>(DEFAULT_FC);
  const [showFilters, setShowFilters] = useState(false);
  const [showConcoursDropdown, setShowConcoursDropdown] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<{
    kind: 'transport' | 'box' | 'coach';
    id: string;
  } | null>(null);
  // Compteur messages non lus (badge cloche dans le header) — Supabase realtime.
  const msgUnreadCount = useUnreadMessagesCount();

  // Plus de gating d'abonnement cavalier : box et transport sont accessibles
  // gratuitement à tous les cavaliers.
  function handleTabPress(target: Tab) {
    setTab(target);
  }

  // Tous les hooks marketplace ont leur propre realtime — pas besoin de refetch
  // manuel ici. On lit juste les params URL.
  useFocusEffect(useCallback(() => {
    // Deep-link vers un service précis (accueil/fiche concours) → on bascule en vue
    // « Tous les services » pour montrer DIRECTEMENT la liste filtrée (pas le sélecteur).
    if (params.tab) { setTab(params.tab as Tab); setViewMode('tous'); }
    // subTab pilote le sous-onglet transport (trajets/van) OU le sous-onglet coach
    // (stages). On n'affecte chaque état que pour une valeur qui le concerne →
    // non régressif. LOT 2 : CTA #stage du fil concours → tab=coach&subTab=stages.
    if (params.subTab === 'trajets' || params.subTab === 'van') setTransportSubTab(params.subTab);
    if (params.tab === 'coach' && params.subTab === 'stages') setCoachTab('stages');
    // Pré-filtrage par concours depuis la fiche concours (ou l'accueil).
    // `concoursId` (FK) = clé canonique, alignée sur le compteur useConcoursCounts.
    // `concours` (nom) reste posé pour l'affichage du filtre + fallback legacy.
    if (params.concours || params.concoursId) {
      const c = (params.concours as string) ?? '';
      const cid = (params.concoursId as string) || undefined;
      setFiltersT((f) => ({ ...f, concours: c, concoursId: cid }));
      setFiltersB((f) => ({ ...f, concours: c, concoursId: cid }));
      setFiltersC((f) => ({ ...f, concours: c, concoursId: cid }));
    }
  }, [params.tab, params.subTab, params.concours, params.concoursId]));

  function handleCancelTransport(id: string) { setPendingCancel({ kind: 'transport', id }); }
  function handleCancelBox(id: string)       { setPendingCancel({ kind: 'box', id }); }
  function handleCancelCoachAnnonce(id: string) { setPendingCancel({ kind: 'coach', id }); }

  async function confirmCancel() {
    if (!pendingCancel) return;
    const { kind, id } = pendingCancel;
    setPendingCancel(null);
    const action =
      kind === 'transport' ? deleteTransportAnnonce :
      kind === 'box'       ? deleteBoxAnnonce :
                             deleteCoachAnnonce;
    const { error } = await action(id);
    if (error) {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(`Erreur\n\n${error}`);
      else Alert.alert('Erreur', error);
    }
  }

  const cancelLabels: Record<'transport' | 'box' | 'coach', { title: string; msg: string }> = {
    transport: { title: 'Retirer ce trajet ?',           msg: 'Cette annonce ne sera plus visible par les autres utilisateurs.' },
    box:       { title: 'Retirer cette annonce de boxes ?', msg: 'Cette annonce ne sera plus visible par les autres utilisateurs.' },
    coach:     { title: 'Retirer cette annonce de coaching ?', msg: 'Cette annonce ne sera plus visible par les autres utilisateurs.' },
  };

  // Filtrer les transports par type
  const transportsFiltered = transports.filter(t =>
    transportSubTab === 'trajets' ? t.typeTransport === 'trajet' : t.typeTransport === 'location'
  );

  // L2 — masquer les trajets COMPLETS (nb_places_disponibles <= 0) côté cavalier.
  // Exceptions : (1) les locations ne sont jamais masquées (logique de dispo
  // différente) ; (2) l'AUTEUR continue de voir sa propre annonce complète
  // (badge « Mon annonce » + Modifier/Retirer). L'annonce n'est PAS supprimée en base.
  const transportsVisible = transportsFiltered.filter(t =>
    !(t.typeTransport === 'trajet' && t.nbPlacesDisponibles <= 0 && t.auteurId !== userStore.id)
  );

  const filteredT = applyTransportFilters(transportsVisible, filtersT);
  // Arrivée depuis un concours → ids des box réellement dispo pour SES dates
  // (mig 104). null tant que la RPC n'existe pas → applyBoxFilters retombe sur
  // le filtre `nbBoxesDisponibles > 0`.
  const concoursAvailableBoxIds = useConcoursAvailableBoxIds(filtersB.concoursId || undefined);
  const filteredB = applyBoxFilters(boxes, filtersB, concoursAvailableBoxIds);
  const filteredC = applyCoachFilters(coaches, filtersC);

  // Liste complète des concours pour les filtres : tous les concours de la table
  // public.concours (dbConcours) + ceux référencés par les annonces existantes.
  // Avant : seuls les concours présents sur les annonces apparaissaient (liste
  // partielle). On unionne avec la liste DB pour offrir TOUS les concours dispo.
  const dbConcoursNames = (dbConcours ?? []).map((c) => c.nom).filter(Boolean);
  const concoursTransport = unique([...dbConcoursNames, ...transports.map((t) => t.concours ?? '')].filter(Boolean));
  const concoursBoxes = unique([...dbConcoursNames, ...boxes.map((b) => b.concours ?? '')].filter(Boolean));
  const concoursCoaches = unique([...dbConcoursNames, ...coachAnnonces.map((ca) => ca.concours ?? '')].filter(Boolean));
  const disciplinesCoachs = unique(coaches.flatMap((c) => c.disciplines));
  const niveauxCoachs = unique(coaches.flatMap((c) => c.niveaux));

  // Filtrer les annonces et coachs par concours. Priorité à la clé canonique
  // (concours_id, alignée sur le compteur useConcoursCounts) ; fallback sur le
  // nom pour le legacy sans FK et la sélection manuelle du filtre.
  const coachConcoursActive = filtersC.concoursId || filtersC.concours;
  const filteredCoachAnnonces = coachConcoursActive
    ? coachAnnonces.filter((ca) =>
        filtersC.concoursId
          // Parité stricte avec le compteur (concours_id + places_disponibles > 0).
          ? ca.concoursId === filtersC.concoursId && ca.placesDisponibles > 0
          : ca.concours === filtersC.concours)
    : coachAnnonces;

  const coachIdsWithSelectedConcours = coachConcoursActive
    ? new Set(filteredCoachAnnonces.map((ca) => ca.auteurId))
    : new Set();

  const filteredCoaches = coachConcoursActive
    ? filteredC.filter((c) => coachIdsWithSelectedConcours.has(c.auteurId))
    : filteredC;

  const activeFiltersT = filtersT.concours || filtersT.concoursId || filtersT.villeDepart || filtersT.placesMin > 0 || filtersT.sort !== 'date_asc';
  const activeFiltersB = filtersB.concours || filtersB.concoursId || filtersB.boxesMin > 0 || filtersB.sort !== 'date_asc';
  const activeFiltersC = filtersC.concours || filtersC.concoursId || filtersC.discipline || filtersC.niveau || filtersC.prixMax < 999 || filtersC.disponibleSeulement || filtersC.sort !== 'note_desc';
  const hasActiveFilter = tab === 'transport' ? activeFiltersT : tab === 'box' ? activeFiltersB : activeFiltersC;

  return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Services</Text>
          <Text style={s.headerSub}>Box · Transport · Coaching</Text>
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
            {msgUnreadCount > 0 && (
              <View style={s.msgBadge}>
                <Text style={s.msgBadgeText}>{msgUnreadCount > 9 ? '9+' : msgUnreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Option 3 — bascule Par concours / Tous les services */}
      <View style={s.modeToggle}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => setViewMode('concours')} style={[s.modeBtn, viewMode === 'concours' && s.modeBtnOn]}>
          <Text style={[s.modeTxt, viewMode === 'concours' && s.modeTxtOn]}>🏆 Par concours</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} onPress={() => setViewMode('tous')} style={[s.modeBtn, viewMode === 'tous' && s.modeBtnOn]}>
          <Text style={[s.modeTxt, viewMode === 'tous' && s.modeTxtOn]}>Tous les services</Text>
        </TouchableOpacity>
      </View>

      {/* MODE « PAR CONCOURS » — entrée concours-first (jamais obligatoire : bouton bascule) */}
      {viewMode === 'concours' && (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/(tabs)/concours-hub' as any)} style={s.protoConcoursBanner}>
            <LinearGradient colors={['#FB923C', '#EA580C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.protoConcoursGrad}>
              <Text style={s.protoConcoursKick}>POUR QUEL CONCOURS ?</Text>
              <Text style={s.protoConcoursTitle}>Je prépare mon concours</Text>
              <Text style={s.protoConcoursSub}>Box, transport & coach réunis autour de votre concours.</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={s.concoursListLbl}>VOS CONCOURS À VENIR</Text>
          {dbConcours.length === 0 ? (
            <View style={s.concoursEmpty}>
              <Text style={s.concoursEmptyIcon}>🏆</Text>
              <Text style={s.concoursEmptyTxt}>Aucun concours pour le moment.</Text>
              <TouchableOpacity onPress={() => setViewMode('tous')}><Text style={s.concoursEscapeTxt}>Parcourir tous les services →</Text></TouchableOpacity>
            </View>
          ) : (
            <>
              {dbConcours.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.85}
                  style={s.concoursRow}
                  onPress={() => {
                    // Sélection d'un concours → pré-filtre les 3 modules (clé canonique
                    // concours_id, nom conservé pour l'affichage) + bascule en vue services.
                    setFiltersB((f) => ({ ...f, concours: c.nom, concoursId: c.id }));
                    setFiltersT((f) => ({ ...f, concours: c.nom, concoursId: c.id }));
                    setFiltersC((f) => ({ ...f, concours: c.nom, concoursId: c.id }));
                    setTab('box');
                    setViewMode('tous');
                  }}
                >
                  <View style={s.concoursBar} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.concoursRowName}>🏆 {c.nom}</Text>
                    <Text style={s.concoursMeta}>
                      {c.dateLabel}{c.departement ? ` · ${c.departement}` : ''}{c.lieu ? ` · ${c.lieu}` : ''}
                    </Text>
                  </View>
                  <Text style={s.concoursArrow}>›</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setViewMode('tous')} style={s.concoursEscape}>
                <Text style={s.concoursEscapeTxt}>ou parcourir tous les services →</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}

      {/* MODE « TOUS LES SERVICES » — vue marketplace classique (inchangée) */}
      {viewMode === 'tous' && (
      <>
      {/* Tabs */}
      <View style={s.tabBar}>
        <TabBtn label="Box" count={filteredB.length} loading={boxesLoading} active={tab === 'box'} onPress={() => handleTabPress('box')} />
        <TabBtn label="Transport" count={filteredT.length} loading={transportsLoading} active={tab === 'transport'} onPress={() => handleTabPress('transport')} />
        <TabBtn label="Coachs" count={filteredCoachAnnonces.length + filteredCoaches.length} loading={coachAnnoncesLoading || coachesLoading} active={tab === 'coach'} onPress={() => handleTabPress('coach')} />
      </View>

      {/* Transport Sub-Tabs */}
      {tab === 'transport' && (
        <View style={s.subTabBar}>
          <TouchableOpacity
            style={[s.subTabBtn, transportSubTab === 'trajets' && s.subTabBtnActive]}
            onPress={() => setTransportSubTab('trajets')}
          >
            <Text style={[s.subTabLabel, transportSubTab === 'trajets' && s.subTabLabelActive]}>
              🚐 Trajets
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.subTabBtn, transportSubTab === 'van' && s.subTabBtnActive]}
            onPress={() => setTransportSubTab('van')}
          >
            <Text style={[s.subTabLabel, transportSubTab === 'van' && s.subTabLabelActive]}>
              🔑 Transport seul
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={s.list}>
        {tab === 'transport' && (
          <>
            <BannerAdd
              icon="🚐"
              text={transportSubTab === 'trajets' ? "Vous avez des places dans votre van ? Louez-le" : "Vous voulez louer votre van à la journée ? Louez-le"}
              hint={transportSubTab === 'trajets' ? "Recommandé : 0,8€/km" : "Recommandé : 200-220€/jour"}
              cta="Proposer une annonce"
              route={transportSubTab === 'trajets' ? '/proposer-transport?type=trajet' : '/proposer-transport?type=location'}
            />
            {filteredT.length === 0 && <EmptyState text={`Aucun ${transportSubTab === 'trajets' ? 'trajet' : 'van'} ne correspond à vos filtres.`} />}
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
            <BannerAdd icon="🏠" text="Vous avez des boxes disponibles ? Louez-le" hint="Recommandé : 45–80€/nuit" cta="Proposer des boxes" route="/proposer-box" />
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
            {/* SECTION COACH */}
            {role === 'coach' && (
              <>
                <BannerAdd icon="🎓" text="Vous êtes coach ?" hint="Proposez vos services" cta="Ajouter un profil" route="/proposer-coach" />

                {/* Concours disponibles — source DB (public.concours), « à venir » seulement.
                    Le coach rattache son annonce à un concours réel (concours_id FK) et
                    peut ouvrir la fiche concours DB (épreuves importées). */}
                {(() => {
                  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
                  const dispo = dbConcours.filter((c) => {
                    const d = c.date_fin ?? c.date_debut;
                    return !d || new Date(`${d}T00:00:00`) >= today0;
                  });
                  if (dispo.length === 0) return null;
                  return (
                    <>
                      <Text style={s.sectionTitle}>🏆 Concours disponibles</Text>
                      {dispo.map((concours) => {
                        const nbEpreuves = countEpreuves(concours.liste_epreuves);
                        return (
                          <View key={concours.id} style={s.concoursCard}>
                            <TouchableOpacity
                              style={s.concoursInfo}
                              activeOpacity={0.7}
                              onPress={() => router.push(`/concours/${concours.id}` as any)}
                            >
                              <Text style={s.concoursName}>{concours.nom}</Text>
                              <Text style={s.concoursDate}>
                                📅 {concours.dateLabel}{concours.lieu ? ` · ${concours.lieu}` : ''}
                              </Text>
                              {!!concours.type_concours && (
                                <Text style={s.concoursDetail}>🎯 {concours.type_concours}</Text>
                              )}
                              {nbEpreuves > 0 && (
                                <Text style={s.concoursDetail}>🏆 {nbEpreuves} épreuve{nbEpreuves > 1 ? 's' : ''}</Text>
                              )}
                            </TouchableOpacity>
                            <View style={{ gap: 8 }}>
                              <TouchableOpacity
                                style={s.concoursCreateBtn}
                                onPress={() => router.push(`/proposer-coach-annonce?concoursId=${concours.id}` as any)}
                              >
                                <Text style={s.concoursCreateBtnText}>Créer une annonce</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[s.concoursCreateBtn, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD', borderWidth: 1 }]}
                                onPress={() => router.push(`/concours/${concours.id}` as any)}
                              >
                                <Text style={[s.concoursCreateBtnText, { color: '#1D4ED8' }]}>Voir le concours</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </>
                  );
                })()}
              </>
            )}

            {/* SECTION CAVALIER */}
            {role === 'cavalier' && (
              <>
                {/* Onglets Concours / Stages — Contact concours déplacé dans Communauté */}
                <View style={s.coachTabBar}>
                  <TouchableOpacity
                    style={[s.coachTabBtn, coachTab === 'concours' && s.coachTabBtnActive]}
                    onPress={() => setCoachTab('concours')}
                  >
                    <Text style={[s.coachTabLabel, coachTab === 'concours' && s.coachTabLabelActive]}>🏆 Concours</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.coachTabBtn, coachTab === 'stages' && s.coachTabBtnActive]}
                    onPress={() => setCoachTab('stages')}
                  >
                    <Text style={[s.coachTabLabel, coachTab === 'stages' && s.coachTabLabelActive]}>📚 Stages</Text>
                  </TouchableOpacity>
                </View>

                {/* Onglet CONCOURS */}
                {coachTab === 'concours' && (
                  <>
                    {/* Filtre concours */}
                    {concoursCoaches.length > 0 && (
                      <View style={s.concoursFilterContainer}>
                        <Text style={s.concoursFilterLabel}>Filtrer par concours</Text>
                        <TouchableOpacity
                          style={s.concoursDropdown}
                          activeOpacity={0.7}
                          onPress={() => setShowConcoursDropdown(true)}
                        >
                          <Text style={s.concoursDropdownText}>
                            {filtersC.concours || 'Tous les concours'}
                          </Text>
                          <Text style={s.concoursDropdownIcon}>▼</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {filteredCoachAnnonces.length > 0 && (
                      <>
                        <Text style={s.sectionTitle}>📢 Annonces des coachs</Text>
                        {filteredCoachAnnonces.map((ca) => (
                          <CoachAnnonceCard
                            key={ca.id}
                            item={ca}
                            onCancel={() => handleCancelCoachAnnonce(ca.id)}
                          />
                        ))}
                      </>
                    )}
                    {filteredCoaches.length > 0 && (
                      <>
                        <Text style={s.sectionTitle}>🎓 Profils des coachs</Text>
                        {filteredCoaches.map((c) => (
                          <CoachCard
                            key={c.id}
                            item={c}
                            onModify={undefined}
                          />
                        ))}
                      </>
                    )}
                    {filteredCoaches.length === 0 && filteredCoachAnnonces.length === 0 && <EmptyState text="Aucun coach ne correspond à vos filtres." />}
                  </>
                )}
              </>
            )}

            {/* Onglet STAGES */}
            {role === 'cavalier' && coachTab === 'stages' && (
              <>
                {stages.length === 0 ? (
                  <EmptyState text="Aucun stage disponible pour le moment." />
                ) : (
                  <>
                    <Text style={s.sectionTitle}>📚 Stages des coachs</Text>
                    {stages.map((stage) => <StageCard key={stage.id} item={stage} />)}
                  </>
                )}
              </>
            )}

          </>
        )}

      </ScrollView>
      </>
      )}

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
                  concours={concoursCoaches}
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

      {/* Modal dropdown concours */}
      <Modal visible={showConcoursDropdown} transparent animationType="fade">
        <TouchableOpacity
          style={s.dropdownBackdrop}
          activeOpacity={1}
          onPress={() => setShowConcoursDropdown(false)}
        >
          <TouchableOpacity activeOpacity={1} style={s.dropdownMenu}>
            <TouchableOpacity
              style={s.dropdownItem}
              onPress={() => {
                setFiltersC({ ...filtersC, concours: '', concoursId: undefined });
                setShowConcoursDropdown(false);
              }}
            >
              <Text style={[s.dropdownItemText, !filtersC.concours && s.dropdownItemTextActive]}>
                Tous les concours
              </Text>
              {!filtersC.concours && <Text style={s.dropdownCheckmark}>✓</Text>}
            </TouchableOpacity>

            {concoursCoaches.map((c) => (
              <TouchableOpacity
                key={c}
                style={s.dropdownItem}
                onPress={() => {
                  setFiltersC({ ...filtersC, concours: c, concoursId: undefined });
                  setShowConcoursDropdown(false);
                }}
              >
                <Text style={[s.dropdownItemText, filtersC.concours === c && s.dropdownItemTextActive]}>
                  {c}
                </Text>
                {filtersC.concours === c && <Text style={s.dropdownCheckmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <ConfirmModal
        visible={!!pendingCancel}
        title={pendingCancel ? cancelLabels[pendingCancel.kind].title : ''}
        message={pendingCancel ? cancelLabels[pendingCancel.kind].msg : undefined}
        cancelLabel="Annuler"
        confirmLabel="Retirer"
        destructive
        onCancel={() => setPendingCancel(null)}
        onConfirm={confirmCancel}
      />

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
          onSelect={(v) => onChange({ ...f, concours: v, concoursId: undefined })}
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
          onSelect={(v) => onChange({ ...f, concours: v, concoursId: undefined })}
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

function FiltersCoachPanel({ filters, onChange, concours, disciplines, niveaux }: {
  filters: FiltersCoach; onChange: (f: FiltersCoach) => void; concours: string[]; disciplines: string[]; niveaux: string[];
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

      <FilterSection title="Concours">
        <ChipGroup
          options={[{ label: 'Tous', value: '' }, ...concours.map((c) => ({ label: c, value: c }))]}
          value={f.concours}
          onSelect={(v) => onChange({ ...f, concours: v, concoursId: undefined })}
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

function TabBtn({ label, count, active, locked, loading, onPress }: {
  label: string; count: number; active: boolean; locked?: boolean; loading?: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.tabBtn, active && s.tabBtnActive, locked && s.tabBtnLocked]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[s.tabLabel, active && s.tabLabelActive, locked && s.tabLabelLocked]}>
        {locked ? `🔒 ${label}` : label}
      </Text>
      {!locked && (
        <View style={[s.tabCount, active && s.tabCountActive]}>
          {/* '…' seulement au 1er chargement (count encore inconnu). Pendant un
              refetch au focus la liste reste peuplée → on garde le chiffre
              (stale-while-revalidate) au lieu de flasher '…' à chaque visite. */}
          <Text style={[s.tabCountText, active && s.tabCountTextActive]}>{loading && count === 0 ? '…' : count}</Text>
        </View>
      )}
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
  const { average: rating } = useAvisStats(item.auteurId);
  const villeDep = displayCity(item.villeDepart, item.adresseVan);
  const villeArr = displayCity(item.villeArrivee, item.adresseArrivee);
  return (
    <View style={s.card}>
      {isOwner && <View style={s.ownerBadge}><Text style={s.ownerBadgeText}>Mon annonce</Text></View>}
      <View style={s.routeRow}>
        <View style={{ flex: 1 }}>
          {item.typeTransport === 'trajet' ? (
            <>
              <Text style={s.routeDepart}>{villeDep}</Text>
              <Text style={s.routeArrow}>→</Text>
              <Text style={s.routeArrivee}>{villeArr}</Text>
            </>
          ) : (
            <Text style={s.routeDepart}>📍 {villeDep}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4, maxWidth: '52%' }}>
          {!!item.concours && (
            <Text style={s.cardConcours} numberOfLines={2}>🏆 {item.concours}</Text>
          )}
          <View style={s.priceBadge}>
            {item.typeTransport === 'location' ? (
              <>
                <Text style={s.priceHT}>{item.prixHT}€</Text>
                <Text style={s.priceTTC}>par jour</Text>
              </>
            ) : (
              <Text style={s.priceKmLine} numberOfLines={1}>
                <Text style={s.priceKmValue}>{item.pricePerKm ?? item.prixHT}€/km</Text>
                <Text style={s.priceKmLabel}> · prix au kilomètre</Text>
              </Text>
            )}
          </View>
          {rating > 0 && <Text style={s.ratingMini}>⭐ {rating.toFixed(1)}</Text>}
        </View>
      </View>
      <View style={s.tagRow}>
        {item.typeTransport === 'trajet' ? (
          <>
            <Tag icon="📅" label={date} />
            <Tag icon="🐴" label={`${left}/${item.nbPlacesTotal} place${item.nbPlacesTotal > 1 ? 's' : ''}`} color={left > 0 ? Colors.success : Colors.urgent} />
            {item.allerRetour ? (
              <Tag icon="↔️" label="Aller retour" color={Colors.primary} />
            ) : (
              <Tag icon="→" label="Aller simple" />
            )}
          </>
        ) : (
          <>
            <Tag icon="📅" label={`${item.datesDisponibles?.length ?? 0} jour(s)`} />
            <Tag icon="💳" label={`Caution: ${item.cautionRéparation}€`} color={Colors.warning} />
          </>
        )}
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
            router.push(`/user-profile/${item.auteurId}` as any);
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
            <TouchableOpacity style={s.msgContactBtn} onPress={() => router.push({ pathname: '/messagerie', params: { otherId: item.auteurId, otherNom: item.auteurNom, otherPseudo: item.auteurPseudo, otherInitiales: item.auteurInitiales, otherCouleur: item.auteurCouleur, annonceType: 'transport', sujet: '🚚 Transport' } } as any)}>
              <Text style={s.msgContactText}>💬</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.ctaBtn, (item.typeTransport === 'trajet' && left === 0) && s.ctaBtnDisabled]}
              disabled={item.typeTransport === 'trajet' && left === 0}
              onPress={() => {
                trackFunnel('payment', 'open_listing', { module: 'transport', listing_id: item.id, seller_id: item.auteurId });
                router.push(`/reserver-transport?id=${item.id}` as any);
              }}
            >
              <Text style={s.ctaText}>{item.typeTransport === 'trajet' ? (left > 0 ? 'Réserver' : 'Complet') : 'Louer'}</Text>
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
  const nbJ = Math.max(1, Math.round((item.dateFin.getTime() - item.dateDebut.getTime()) / (1000 * 60 * 60 * 24)));
  const left = item.nbBoxesDisponibles;
  const { average: rating } = useAvisStats(item.auteurId);
  return (
    <View style={s.card}>
      {isOwner && <View style={s.ownerBadge}><Text style={s.ownerBadgeText}>Mon annonce</Text></View>}
      <View style={s.routeRow}>
        <Text style={[s.routeDepart, { flex: 1 }]}>{item.lieu}</Text>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={s.priceBadge}>
            <Text style={s.priceHT}>{item.prixNuitHT}€/nuit</Text>
          </View>
          {rating > 0 && <Text style={s.ratingMini}>⭐ {rating.toFixed(1)}</Text>}
        </View>
      </View>
      <View style={s.tagRow}>
        <Tag icon="📅" label={`${debut} → ${fin}`} />
        <Tag icon="🌙" label={`${nbJ}j disponibles`} color={Colors.success} />
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
            router.push(`/user-profile/${item.auteurId}` as any);
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
            <TouchableOpacity style={s.msgContactBtn} onPress={() => router.push({ pathname: '/messagerie', params: { otherId: item.auteurId, otherNom: item.auteurNom, otherPseudo: item.auteurPseudo, otherInitiales: item.auteurInitiales, otherCouleur: item.auteurCouleur, annonceType: 'box', sujet: '📦 Box' } } as any)}>
              <Text style={s.msgContactText}>💬</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.ctaBtn, left === 0 && s.ctaBtnDisabled]} disabled={left === 0} onPress={() => {
              trackFunnel('payment', 'open_listing', { module: 'box', listing_id: item.id, seller_id: item.auteurId });
              router.push(`/reserver-box?id=${item.id}` as any);
            }}>
              <Text style={s.ctaText}>{left > 0 ? 'Réserver' : 'Complet'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function CoachCard({ item, onModify }: { item: CoachProfil; onModify?: () => void }) {
  const handleProfilePress = () => {
    console.log('🖱️ Coach tapped - ID:', item.id);
    router.push(`/view-coach/${item.id}` as any);
  };

  return (
    <View style={[s.card, (item.isBoosted || item.featured) && s.cardFeatured]}>
      <View style={s.badgeRow}>
        {item.isBoosted && (
          <View style={s.boostBadge}>
            <Text style={s.boostBadgeText}>⭐ Boost</Text>
          </View>
        )}
        {item.isCertified && (
          <View style={s.certifiedBadge}>
            <Text style={s.certifiedBadgeText}>✓ Coach Certifié</Text>
          </View>
        )}
        {item.featured && !item.isBoosted && (
          <View style={s.featuredBadge}>
            <Text style={s.featuredBadgeText}>⭐ Mis en avant</Text>
          </View>
        )}
      </View>
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
          <Text style={s.priceHT}>{item.tarifHeure}€ / h</Text>
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
        <TouchableOpacity style={[s.msgContactBtn, { flex: 1 }]} onPress={() => router.push({ pathname: '/messagerie', params: { otherId: item.id, otherNom: `${item.prenom} ${item.nom}`, otherPseudo: item.pseudo, otherInitiales: item.initiales, otherCouleur: item.couleur, annonceType: 'coach', sujet: '🎓 Coaching' } } as any)}>
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
            onPress={() => {
              trackFunnel('payment', 'open_listing', { module: 'course', listing_id: item.id, seller_id: item.id });
              router.push(`/reserver-coach?coachId=${item.id}` as any);
            }}
          >
            <Text style={s.ctaText}>{item.disponible ? 'Réserver une séance' : 'Indisponible'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function CoachAnnonceCard({ item, onCancel }: { item: CoachAnnonce; onCancel?: () => void }) {
  const isOwner = item.auteurId === userStore.id;
  const dateStr = item.dateDebut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' });

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
        {item.concours && <Tag icon="🏆" label={item.concours} />}
        <Tag icon="📅" label={dateStr} />
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
          <Text style={s.detailValue}>{item.prixHeure}€</Text>
        </View>
      </View>

      {isOwner ? (
        <View style={s.footerBtns}>
          <TouchableOpacity style={[s.ownerCancelBtn, { flex: 1 }]} onPress={onCancel}>
            <Text style={s.ownerCancelText}>🗑 Retirer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.footerBtns}>
          <TouchableOpacity style={[s.msgContactBtn, { flex: 1 }]} onPress={() => router.push({ pathname: '/messagerie', params: { otherId: item.auteurId, otherNom: item.auteurNom, otherPseudo: item.auteurPseudo, otherInitiales: item.auteurInitiales, otherCouleur: item.auteurCouleur, annonceType: 'coach', sujet: `🎓 ${item.titre}`, annonce: item.titre } } as any)}>
            <Text style={s.msgContactText}>💬 Contacter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.ctaBtn, { flex: 1 }]}
            onPress={() => {
              trackFunnel('payment', 'open_listing', { module: 'course', listing_id: item.id, seller_id: item.auteurId });
              router.push(`/reserver-coach?annonceId=${item.id}` as any);
            }}
          >
            <Text style={s.ctaText}>Réserver</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function StageCard({ item }: { item: CoachStage }) {
  const left = item.placesDisponibles;
  const dateDebut = item.dateDebut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' });
  const dateFin = item.dateFin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' });

  const handleAuthorPress = () => {
    console.log('🖱️ Stage author tapped - ID:', item.auteurId);
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
        <Tag icon="📚" label={`${item.nbJours} jour${item.nbJours > 1 ? 's' : ''}`} />
        <Tag label={item.disciplines.join(', ')} color={Colors.primary} />
        <Tag label={item.niveaux.join(', ')} />
      </View>

      <Text style={s.description} numberOfLines={2}>{item.description}</Text>

      <View style={s.annonceDetails}>
        <View style={s.detailItem}>
          <Text style={s.detailLabel}>Dates</Text>
          <Text style={s.detailValue}>{dateDebut}</Text>
          <Text style={s.detailSmall}>à {dateFin}</Text>
        </View>
        <View style={s.detailDivider} />
        <View style={s.detailItem}>
          <Text style={s.detailLabel}>Prix</Text>
          <Text style={s.detailValue}>{item.prixTTC}€</Text>
        </View>
        <View style={s.detailDivider} />
        <View style={s.detailItem}>
          <Text style={s.detailLabel}>Places</Text>
          <Text style={[s.detailValue, left === 0 && s.detailValueFull]}>{left}/{item.places}</Text>
        </View>
      </View>

      <View style={s.footerBtns}>
        <TouchableOpacity
          style={[s.msgContactBtn, { flex: 1 }]}
          onPress={() => router.push({
            pathname: '/messagerie',
            params: {
              otherId: item.auteurId,
              otherNom: item.auteurNom,
              otherPseudo: item.auteurPseudo,
              otherInitiales: item.auteurInitiales,
              otherCouleur: item.auteurCouleur,
              annonceType: 'stage',
              sujet: `📚 ${item.titre}`,
              annonce: item.titre,
            },
          } as any)}
        >
          <Text style={s.msgContactText}>💬 Contacter</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.ctaBtn, { flex: 1 }, left === 0 && s.ctaBtnDisabled]}
          disabled={left === 0}
          onPress={() => {
            trackFunnel('payment', 'open_listing', { module: 'stage', listing_id: item.id, seller_id: item.auteurId });
            router.push(`/reserver-stage?stageId=${item.id}` as any);
          }}
        >
          <Text style={s.ctaText}>{left > 0 ? 'S\'inscrire' : 'Complet'}</Text>
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

  // PROTOTYPE — bannière concours (additive)
  modeToggle: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: Spacing.md, marginBottom: Spacing.xs, backgroundColor: Colors.backgroundSecondary, borderRadius: Radius.lg, padding: 4, gap: 4 },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: Radius.md },
  modeBtnOn: { backgroundColor: Colors.surface, ...Shadow.card },
  modeTxt: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  modeTxtOn: { color: Colors.textPrimary, fontWeight: FontWeight.bold },
  concoursListLbl: { fontSize: 10, fontWeight: FontWeight.extrabold, color: Colors.textTertiary, letterSpacing: 1, marginTop: Spacing.md, marginBottom: Spacing.xs, marginHorizontal: Spacing.xs },
  concoursRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: Spacing.sm, ...Shadow.card },
  concoursBar: { width: 5, alignSelf: 'stretch', backgroundColor: Colors.cso },
  concoursRowName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary, paddingTop: Spacing.md, paddingLeft: Spacing.md },
  concoursMeta: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 3, paddingLeft: Spacing.md, paddingBottom: Spacing.md },
  concoursArrow: { fontSize: 24, color: Colors.textTertiary, paddingHorizontal: Spacing.md },
  concoursEscape: { alignItems: 'center', paddingVertical: Spacing.md },
  concoursEscapeTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.semibold, textDecorationLine: 'underline' },
  concoursEmpty: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  concoursEmptyIcon: { fontSize: 40 },
  concoursEmptyTxt: { fontSize: FontSize.base, color: Colors.textSecondary },
  protoConcoursBanner: { marginHorizontal: Spacing.lg, marginTop: Spacing.md, marginBottom: Spacing.sm, borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.card },
  protoConcoursGrad: { paddingVertical: Spacing.xl, paddingHorizontal: Spacing.xl },
  protoConcoursKick: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: FontWeight.extrabold, letterSpacing: 1.5 },
  protoConcoursTitle: { color: Colors.textInverse, fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, marginTop: 6 },
  protoConcoursSub: { color: 'rgba(255,255,255,0.92)', fontSize: FontSize.sm, marginTop: 6, lineHeight: 19 },
  protoConcoursCta: { alignSelf: 'flex-start', backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: 10, marginTop: Spacing.md },
  protoConcoursCtaTxt: { color: Colors.primaryDark, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  tabBar: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg, paddingBottom: Spacing.sm },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabBtnLocked: { backgroundColor: Colors.surfaceVariant, borderColor: Colors.border, opacity: 0.7 },
  tabLabelLocked: { color: Colors.textTertiary },
  tabLabel: { fontSize: 10, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  tabLabelActive: { color: Colors.textInverse },
  tabCount: { backgroundColor: Colors.border, borderRadius: 10, minWidth: 22, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' },
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
  cardConcours: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.primary, textAlign: 'right' },
  priceBadge: { alignItems: 'flex-end' },
  priceHT: { fontSize: FontSize.xs, color: Colors.textTertiary },
  priceKmLine: { textAlign: 'right' },
  priceKmValue: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  priceKmLabel: { fontSize: FontSize.xs, color: Colors.textTertiary },
  priceTTC: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.primary },
  ratingMini: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: '#92400E', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm },
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
  cardFeatured: { borderColor: Colors.gold, borderWidth: 2, backgroundColor: Colors.goldBg },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: Spacing.sm },
  featuredBadge: { alignSelf: 'flex-start', backgroundColor: Colors.gold, borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  featuredBadgeText: { fontSize: 11, color: Colors.textInverse, fontWeight: FontWeight.bold, letterSpacing: 0.3 },
  boostBadge: { alignSelf: 'flex-start', backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 1, borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  boostBadgeText: { fontSize: 11, color: '#92400E', fontWeight: FontWeight.bold, letterSpacing: 0.3 },
  certifiedBadge: { alignSelf: 'flex-start', backgroundColor: '#DBEAFE', borderColor: '#93C5FD', borderWidth: 1, borderRadius: Radius.xs, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  certifiedBadgeText: { fontSize: 11, color: '#1E40AF', fontWeight: FontWeight.bold, letterSpacing: 0.3 },
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

  // Onglets transport (Trajets / Van seul)
  subTabBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  subTabBtn: { flex: 1, paddingVertical: Spacing.sm + 2, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface },
  subTabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  subTabLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  subTabLabelActive: { color: Colors.textInverse },

  // Onglets coach
  coachTabBar: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  coachTabBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  coachTabBtnActive: { borderBottomColor: Colors.primary },
  coachTabLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  coachTabLabelActive: { color: Colors.primary, fontWeight: FontWeight.bold },

  // Filtre concours
  concoursFilterContainer: { gap: Spacing.sm, marginBottom: Spacing.md },
  concoursFilterLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  concoursDropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md },
  concoursDropdownText: { fontSize: FontSize.base, color: Colors.textPrimary, flex: 1 },
  concoursDropdownIcon: { fontSize: FontSize.xs, color: Colors.textTertiary, marginLeft: Spacing.sm },

  // Carte concours pour coachs
  concoursCard: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, ...Shadow.card, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  concoursInfo: { flex: 1, gap: Spacing.xs },
  concoursName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  concoursDate: { fontSize: FontSize.xs, color: Colors.textSecondary },
  concoursDetail: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: Spacing.xs },
  concoursCreateBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2, justifyContent: 'center' },
  concoursCreateBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textInverse, textAlign: 'center' },

  // Dropdown menu
  dropdownBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center', alignItems: 'center' },
  dropdownMenu: { backgroundColor: Colors.surface, borderRadius: Radius.lg, marginHorizontal: Spacing.lg, overflow: 'hidden', ...Shadow.card },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownItemText: { fontSize: FontSize.base, color: Colors.textSecondary },
  dropdownItemTextActive: { color: Colors.primary, fontWeight: FontWeight.bold },
  dropdownCheckmark: { color: Colors.primary, fontWeight: FontWeight.bold, fontSize: FontSize.base },

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
