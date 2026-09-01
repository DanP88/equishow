/**
 * Onglet ACCUEIL — tableau de bord d'accueil, adapté au rôle (cavalier / coach /
 * organisateur / admin). Récapitule l'essentiel + raccourcis vers les écrans réels.
 * Cavalier + Coach : compteurs branchés sur les vraies données Supabase (hooks).
 * Organisateur + Admin : encore présentationnels (données illustratives) — à
 * brancher progressivement sur les hooks existants.
 */
import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { useUserRole } from '../../hooks/useUserRole';
import { useAuth } from '../../hooks/useAuth';
import { userStore } from '../../data/store';
import { getHeroSnapshot, setHeroSnapshot } from '../../lib/heroSnapshot';
import { useMyChevaux } from '../../hooks/useChevaux';
import { useChevalConcours, CModuleKey } from '../../hooks/useChevalReservations';
import { useMyEscrowPayments } from '../../hooks/useMyEscrowPayments';
import { useMyReservationsSummary, ResaModule } from '../../hooks/useMyReservationsSummary';
import { useCoachPendingDemands } from '../../hooks/useCoachPendingDemands';
import { useMarketplaceAnalytics } from '../../hooks/useMarketplaceAnalytics';
import { useOpenSupportCount } from '../../hooks/useSupportRequests';
import { useMyConcours } from '../../hooks/useConcours';
import { useOrgRadar } from '../../hooks/useOrgRadar';
import { ACCUEIL_DEV_SEED, MOCK_ACCUEIL } from '../../data/mockAccueil';

type Role = 'cavalier' | 'coach' | 'organisateur' | 'admin';

export default function Accueil() {
  const role = (useUserRole() as Role) || 'cavalier';
  const prenom = userStore.prenom || '';
  const hello = prenom ? `Bonjour ${prenom} 👋` : 'Bonjour 👋';

  return (
    <ScrollView style={s.root} contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
      <View style={s.header}>
        <View>
          <Text style={s.hello}>{hello}</Text>
          <Text style={s.headerSub}>{SUBTITLE[role]}</Text>
        </View>
      </View>

      {role === 'cavalier' && <Cavalier />}
      {role === 'coach' && <Coach />}
      {role === 'organisateur' && <Organisateur />}
      {role === 'admin' && <Admin />}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const SUBTITLE: Record<Role, string> = {
  cavalier: 'Voici ton récap du moment',
  coach: 'Voici ton activité du moment',
  organisateur: 'Voici l’activité de tes concours',
  admin: 'Vue d’ensemble de la plateforme',
};

/* ─────────────── CAVALIER (design récap, données réelles) ─────────────── */
const PREP_MODULES: CModuleKey[] = ['box', 'transport', 'coach'];

function daysTo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr); if (isNaN(+d)) return null;
  d.setHours(0, 0, 0, 0); const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((+d - +now) / 86400000);
}
function jLabel(days: number | null): string {
  if (days == null) return '';
  if (days === 0) return "Aujourd'hui"; if (days < 0) return 'En cours';
  return `J-${days}`;
}
// « Passé ? » recalculé depuis la date au moment du rendu — robuste si le récap
// vient d'un cache local créé un autre jour (le flag `past` figé pourrait mentir).
function isConcoursPast(i: { dateFin: string | null; past?: boolean }): boolean {
  if (i.dateFin) {
    const d = new Date(`${i.dateFin}T00:00:00`);
    if (!isNaN(+d)) { const t = new Date(); t.setHours(0, 0, 0, 0); return d < t; }
  }
  return !!i.past;
}
function formatHeroDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(+d)) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function initials2(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '··';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
// Libellé du CTA (P6-premium) selon le service manquant.
const FIND_LABEL: Record<CModuleKey, string> = {
  box: 'Réserver un box', transport: 'Réserver un transport', coach: 'Réserver un coach', stage: 'Réserver un stage',
};
// Nom [singulier, pluriel] pour la ligne de réassurance.
const PREP_NOUN: Record<CModuleKey, [string, string]> = {
  box: ['box', 'box'], transport: ['transport', 'transports'], coach: ['coach', 'coachs'], stage: ['stage', 'stages'],
};
// Anneau de progression (V5) — gold pâle sur le hero orange.
function HeroRing({ pct, count, total }: { pct: number; count: number; total: number }) {
  const ringStyle = Platform.select({
    web: { backgroundImage: `conic-gradient(#FFE2A0 0 ${pct}%, rgba(255,255,255,0.22) ${pct}% 100%)` } as any,
    default: { borderWidth: 4, borderColor: '#FFE2A0' },
  });
  return (
    <View style={[s.hRing, ringStyle as any]}>
      <View style={s.hRingInner}>
        <Text style={s.hRingNum}>{count}/{total}</Text>
        <Text style={s.hRingLbl}>prêt</Text>
      </View>
    </View>
  );
}

const RESA_META: Record<ResaModule, { emoji: string; label: string }> = {
  box: { emoji: '🏠', label: 'Box' },
  transport: { emoji: '🚚', label: 'Transport' },
  coach: { emoji: '🎓', label: 'Coach' },
  stage: { emoji: '📚', label: 'Stage' },
};
// Libellé + couleur du statut côté cavalier (récap accueil).
function resaStatut(it: { statut: string; needsPayment: boolean }): { label: string; color: string; bg: string } {
  if (it.needsPayment) return { label: 'À régler', color: Colors.warning, bg: Colors.warningBg };
  switch (it.statut) {
    case 'paid': return { label: 'Payé', color: Colors.success, bg: Colors.successBg };
    case 'accepted': return { label: 'Confirmé', color: Colors.success, bg: Colors.successBg };
    case 'completed': return { label: 'Terminé', color: Colors.success, bg: Colors.successBg };
    case 'pending': return { label: 'En attente', color: Colors.textSecondary, bg: Colors.surfaceVariant };
    case 'rejected': return { label: 'Refusé', color: Colors.urgent, bg: Colors.urgentBg };
    case 'cancelled': return { label: 'Annulé', color: Colors.textSecondary, bg: Colors.surfaceVariant };
    default: return { label: it.statut, color: Colors.textSecondary, bg: Colors.surfaceVariant };
  }
}

function Cavalier() {
  const { chevaux } = useMyChevaux();
  // Récap concours réel (tous chevaux) pour le hero + complétion.
  const concoursIds = useMemo(() => chevaux.map((c) => c.id), [chevaux]);
  const cc = useChevalConcours(concoursIds);
  // Réservations réelles de l'utilisateur (acheteur) + escrow.
  const rs = useMyReservationsSummary();
  const { byReservation } = useMyEscrowPayments();

  const heldCountReal = useMemo(
    () => Object.values(byReservation).filter((p) => p.transferState === 'held').length,
    [byReservation],
  );

  // SEED DEV (front-only, __DEV__ uniquement) : remplace les sorties des hooks par
  // des données d'exemple pour tester l'accueil sans écrire en base. Cf. data/mockAccueil.
  const seed = __DEV__ && ACCUEIL_DEV_SEED;
  const { profile } = useAuth();
  // `cc.items` est déjà ré-hydraté depuis le cache (clé = ids chevaux) pour la
  // navigation entre onglets. Reste le cold start (surtout web : chaque refresh
  // repart de zéro, aucune donnée synchrone) : tant que le hook n'a rien, on
  // part du dernier récap connu, lu de façon SYNCHRONE → la bonne carte est
  // peinte dès le 1er frame, aucun flash.
  const concoursItems = useMemo(() => {
    if (seed) return MOCK_ACCUEIL.concours;
    if (cc.items.length) return cc.items;
    return getHeroSnapshot(profile?.id) ?? cc.items;
  }, [seed, cc.items, profile?.id]);

  // Mémorise le récap dès qu'il est résolu, pour les démarrages suivants.
  useEffect(() => {
    if (seed || cc.isLoading) return;
    setHeroSnapshot(profile?.id, cc.items);
  }, [seed, cc.isLoading, cc.items, profile?.id]);
  const resa = seed ? MOCK_ACCUEIL.resa : rs.items;
  const toPay = seed ? MOCK_ACCUEIL.resa.filter((r) => r.needsPayment) : rs.toPay;
  const heldCount = seed ? MOCK_ACCUEIL.heldCount : heldCountReal;

  const upcoming = useMemo(
    () => concoursItems.filter((i) => i.concoursNom && !isConcoursPast(i)),
    [concoursItems],
  );
  const hero = upcoming[0];
  const heroPrep = useMemo(() => {
    if (!hero) return { pct: 0, reserved: new Set<CModuleKey>() };
    const reserved = new Set<CModuleKey>(hero.reserved.map((r) => r.module));
    const done = PREP_MODULES.filter((m) => reserved.has(m)).length;
    return { pct: Math.round((done / PREP_MODULES.length) * 100), reserved };
  }, [hero]);
  const heroDays = hero ? daysTo(hero.dateFin) : null;

  // V5+V8 : nom du prestataire par service (depuis le récap réel) + service manquant.
  const vendorByModule = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of resa) if (!map.has(r.module) && r.vendeur) map.set(r.module, r.vendeur);
    return map;
  }, [resa]);
  const reservedCount = PREP_MODULES.filter((m) => heroPrep.reserved.has(m)).length;
  // Tous les services encore à réserver → un bouton dédié par service.
  const missingModules = PREP_MODULES.filter((m) => !heroPrep.reserved.has(m));
  const availOf = (m: CModuleKey) => hero?.available[m] ?? 0;
  // Chaque bouton atterrit DIRECTEMENT sur l'onglet du service, pré-filtré sur CE
  // concours (par nom, comme la fiche concours) → le cavalier ne cherche pas son
  // concours : « Trouver un box » → liste des box du CSO de Saumur.
  const goServiceConcours = (module: CModuleKey) =>
    router.push({ pathname: '/(tabs)/services', params: { tab: module, concours: hero?.concoursNom ?? '' } } as any);

  const nextToPay = toPay[0];

  return (
    <>
      {/* HERO — prochain concours réel + complétion préparation */}
      {hero ? (
        <TouchableOpacity activeOpacity={0.92} onPress={() => go('/(tabs)/concours-hub')} style={[s.heroWrap, Shadow.card]}>
          <LinearGradient colors={['#FB923C', '#EA580C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <View style={s.heroTop}>
              <Text style={s.heroKick}>PROCHAIN CONCOURS</Text>
              {heroDays != null && <View style={s.heroJ}><Text style={s.heroJTxt}>{jLabel(heroDays)}</Text></View>}
            </View>
            <Text style={s.heroName} numberOfLines={2}>{hero.concoursNom}</Text>
            {hero.dateFin && (
              <Text style={s.heroMeta}>
                {formatHeroDate(hero.dateFin)}
                {hero.lieu ? ` · ${hero.lieu}${hero.departement ? ` (${hero.departement})` : ''}` : ''}
              </Text>
            )}

            {/* Hybride V5 (anneau) + V8 (prestataires / slot manquant) */}
            <View style={s.hRingRow}>
              <HeroRing pct={heroPrep.pct} count={reservedCount} total={PREP_MODULES.length} />
              <View style={s.hSide}>
                {PREP_MODULES.map((m) => {
                  const done = heroPrep.reserved.has(m);
                  const vendor = vendorByModule.get(m);
                  const avail = availOf(m);
                  return (
                    <View key={m} style={s.hLine}>
                      <View style={[s.hAv, done ? s.hAvOn : s.hAvDash]}>
                        <Text style={s.hAvTxt}>{done ? (vendor ? initials2(vendor) : '✓') : '+'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.hLineLabel} numberOfLines={1}>{RESA_META[m].emoji} {RESA_META[m].label}</Text>
                        <Text style={[s.hLineSub, !done && s.hLineMiss]} numberOfLines={1}>
                          {done
                            ? (vendor || 'Réservé ✓')
                            : (avail > 0 ? `${avail} ${PREP_NOUN[m][avail > 1 ? 1 : 0]} dispo` : 'À réserver')}
                        </Text>
                      </View>
                      {done && <Text style={s.hOk}>✓</Text>}
                    </View>
                  );
                })}
              </View>
            </View>
            {missingModules.length > 0 ? (
              <>
                {/* P6 : par service manquant → preuve sociale (rareté + prix mini
                    réels) puis CTA « Réserver un X » menant à CE service pré-filtré. */}
                {missingModules.map((m) => {
                  const avail = availOf(m);
                  const from = hero?.availableFrom?.[m] ?? null;
                  const ville = hero?.lieu ?? '';
                  return (
                    <View key={m} style={s.hMissBlock}>
                      {avail > 0 && (
                        <Text style={s.hProof} numberOfLines={1}>
                          ★ {avail} {PREP_NOUN[m][avail > 1 ? 1 : 0]} disponible{avail > 1 ? 's' : ''}
                          {ville ? ` à ${ville}` : ''}{from ? ` · dès ${Math.round(from)} €` : ''}
                        </Text>
                      )}
                      <TouchableOpacity activeOpacity={0.85} style={s.hCta} onPress={() => goServiceConcours(m)}>
                        <Text style={s.hCtaTxt} numberOfLines={1}>{FIND_LABEL[m]} →</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            ) : (
              <Text style={s.hReady}>🎉 Tout est prêt pour ce concours</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        // État vide (aucun concours suivi) — V1 « Trio rassurant » : promesse
        // rendue tangible (les 3 services) + CTA unique + réassurance escrow.
        <View style={[s.heroWrap, Shadow.card]}>
          <LinearGradient colors={['#FB923C', '#F97316', '#EA580C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <View style={s.heRow}>
              <View style={s.heDot} />
              <Text style={s.heKick}>PRÊT(E) POUR LE PROCHAIN DÉFI ?</Text>
            </View>
            <Text style={s.heTitle}>On s'occupe de tout</Text>
            <Text style={s.heDesc}>Box, transport, coach : Equishow simplifie votre prochain concours.</Text>
            <View style={s.hePills}>
              {([['📦', 'Box'], ['🚐', 'Transport'], ['🎯', 'Coach']] as const).map(([icon, label]) => (
                <View key={label} style={s.hePill}>
                  <Text style={s.hePillIcon}>{icon}</Text>
                  <Text style={s.hePillTxt}>{label}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity activeOpacity={0.85} onPress={() => go('/(tabs)/concours-hub')} style={s.heCta}>
              <Text style={s.heCtaTxt}>Trouver mon concours  →</Text>
            </TouchableOpacity>
            <Text style={s.heTrust}>🔒 Paiement sécurisé</Text>
          </LinearGradient>
        </View>
      )}

      {/* Récap chiffres réels — chaque bloc mène au bon écran */}
      <View style={s.stats}>
        <TouchableOpacity style={s.stat} activeOpacity={0.7} onPress={() => go('/(tabs)/cavalier-agenda')}>
          <Text style={s.statN}>{resa.length}</Text><Text style={s.statL}>réservations</Text>
        </TouchableOpacity>
        <View style={s.statSep} />
        <TouchableOpacity style={s.stat} activeOpacity={0.7} onPress={() => go('/(tabs)/cavalier-agenda?topay=1')}>
          <Text style={[s.statN, { color: Colors.warning }]}>{toPay.length}</Text><Text style={s.statL}>à régler</Text>
        </TouchableOpacity>
        <View style={s.statSep} />
        <TouchableOpacity style={s.stat} activeOpacity={0.7} onPress={() => go('/(tabs)/concours-hub')}>
          <Text style={s.statN}>{upcoming.length}</Text><Text style={s.statL}>concours à venir</Text>
        </TouchableOpacity>
      </View>

      {/* À régler — paiement réel le plus urgent */}
      {nextToPay && (
        <>
          <SectionRow title="À régler" link={toPay.length > 1 ? `Tout voir (${toPay.length})` : 'Agenda'} onLink={() => go('/(tabs)/cavalier-agenda')} />
          <TouchableOpacity activeOpacity={0.85} style={[s.payCard, Shadow.card]} onPress={() => go(`/(tabs)/cavalier-agenda?pay=${nextToPay.id}`)}>
            <View style={s.payIcon}><Text style={{ fontSize: 20 }}>{RESA_META[nextToPay.module].emoji}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>{nextToPay.titre}{nextToPay.vendeur ? ` · ${nextToPay.vendeur}` : ''}</Text>
              <Text style={s.paySub}>{RESA_META[nextToPay.module].label} · à régler</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Text style={s.amt}>{Math.round(nextToPay.montant)} €</Text>
              <View style={s.payBtn}><Text style={s.payBtnTxt}>Payer</Text></View>
            </View>
          </TouchableOpacity>
        </>
      )}

      {/* Mes réservations — réelles */}
      {resa.length > 0 && (
        <>
          <SectionRow title="Mes réservations" link="Agenda" onLink={() => go('/(tabs)/cavalier-agenda')} />
          {resa.slice(0, 4).map((r) => {
            const st = resaStatut(r);
            return (
              <TouchableOpacity key={`${r.module}-${r.id}`} activeOpacity={0.85} style={[s.resaCard, Shadow.card]} onPress={() => go('/(tabs)/cavalier-agenda')}>
                <View style={s.resaIcon}><Text style={{ fontSize: 18 }}>{RESA_META[r.module].emoji}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>{r.titre}</Text>
                  <Text style={s.resaSub} numberOfLines={1}>{RESA_META[r.module].label}{r.vendeur ? ` · ${r.vendeur}` : ''}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: st.bg }]}><Text style={[s.badgeTxt, { color: st.color }]}>{st.label}</Text></View>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {/* Escrow rassurant — cliquable vers les paiements protégés réels */}
      {heldCount > 0 && (
        <TouchableOpacity activeOpacity={0.85} style={[s.escrow, Shadow.card]} onPress={() => go('/(tabs)/cavalier-agenda?escrow=held')}>
          <Text style={s.escrowIcon}>🔒</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.escrowTitle}>{heldCount} paiement{heldCount > 1 ? 's' : ''} protégé{heldCount > 1 ? 's' : ''} en séquestre</Text>
            <Text style={s.escrowSub}>Tes paiements sont conservés jusqu'à la fin de chaque prestation. Touche pour voir lesquels.</Text>
          </View>
        </TouchableOpacity>
      )}

      <Shortcuts items={[['🏆', 'Concours', '/(tabs)/concours-hub'], ['🤝', 'Services', '/(tabs)/services'], ['🐴', 'Chevaux', '/(tabs)/chevaux'], ['💬', 'Messages', '/messagerie']]} />
    </>
  );
}

/* ─────────────── COACH ─────────────── */
function Coach() {
  const uid = userStore.id;
  // Compteur « demandes en attente » = MÊME source que coach-demandes.tsx et le
  // badge de la bottom bar (selectCoachPendingDemands) → jamais d'écart.
  const { count, courses: pendingCourses, stages: pendingStages, allCourses, allStages } = useCoachPendingDemands();
  const { byReservation: escrowByResa } = useMyEscrowPayments();

  const startOfToday = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }, []);

  // Cours confirmés (accepted/paid) que CE coach anime et pas encore terminés.
  const coursAVenir = useMemo(
    () => allCourses.filter(
      (d) => d.coachId === uid && (d.statut === 'accepted' || d.statut === 'paid') && d.dateFin.getTime() >= startOfToday,
    ),
    [allCourses, uid, startOfToday],
  );
  // Inscriptions à un stage confirmées que ce coach anime.
  const stagesConfirmes = useMemo(
    () => allStages.filter((r) => r.coachId === uid && (r.statut === 'accepted' || r.statut === 'paid')),
    [allStages, uid],
  );
  // Paiements séquestre (held) rattachés aux prestations confirmées de ce coach.
  const heldCount = useMemo(
    () => [...coursAVenir, ...stagesConfirmes].filter((r) => escrowByResa[r.id]?.transferState === 'held').length,
    [coursAVenir, stagesConfirmes, escrowByResa],
  );

  const fmtDay = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const courseRow = (d: typeof allCourses[number]) => ({
    key: `c-${d.id}`, emoji: '🎓',
    title: `Cours · ${d.cavalierNom || '@' + d.cavalierPseudo}`,
    sub: `${d.concoursNom ? d.concoursNom + ' · ' : ''}${fmtDay(d.dateDebut)}`,
  });

  // « Demandes récentes » = les VRAIES demandes/inscriptions en attente (max 3).
  const demandesRecentes = useMemo(() => [
    ...pendingCourses.map(courseRow),
    ...pendingStages.map((r) => ({
      key: `s-${r.id}`, emoji: '📚',
      title: `Stage · ${r.stageTitre}`,
      sub: `${r.nombreParticipants} participant${r.nombreParticipants > 1 ? 's' : ''} demandé${r.nombreParticipants > 1 ? 's' : ''}`,
    })),
  ].slice(0, 3), [pendingCourses, pendingStages]);

  // « Prochains rendez-vous » = prestations confirmées à venir (max 3).
  const prochainsRdv = useMemo(() => [
    ...coursAVenir.map(courseRow),
    ...stagesConfirmes.map((r) => ({
      key: `s-${r.id}`, emoji: '📚',
      title: `Stage · ${r.stageTitre}`,
      sub: `${r.nombreParticipants} inscrit${r.nombreParticipants > 1 ? 's' : ''}`,
    })),
  ].slice(0, 3), [coursAVenir, stagesConfirmes]);

  return (
    <>
      <Hero
        kick="TON ACTIVITÉ"
        title={count > 0 ? `${count} demande${count > 1 ? 's' : ''} en attente` : 'Aucune demande en attente'}
        meta={count > 0 ? 'Réponds vite pour ne pas perdre de réservations' : 'Tu es à jour ✓'}
        jLabel="●"
        pct={undefined}
        onPress={() => go('/(tabs)/coach-demandes')}
      />
      <Stats items={[
        [String(count), count > 1 ? 'demandes' : 'demande'],
        [String(coursAVenir.length), 'cours à venir'],
        [String(stagesConfirmes.length), stagesConfirmes.length > 1 ? 'inscriptions stage' : 'inscription stage'],
      ]} />

      <SectionRow title="Demandes récentes" link="Voir tout" onLink={() => go('/(tabs)/coach-demandes')} />
      {demandesRecentes.length === 0 ? (
        <View style={[s.resaCard, Shadow.card]}><Text style={s.resaSub}>Aucune demande en attente pour le moment.</Text></View>
      ) : (
        demandesRecentes.map((r) => (
          <ResaRow key={r.key} emoji={r.emoji} title={r.title} sub={r.sub} status="À traiter" color={Colors.warning} bg={Colors.warningBg} />
        ))
      )}

      <SectionRow title="Prochains rendez-vous" link="Agenda" onLink={() => go('/(tabs)/coach-agenda')} />
      {prochainsRdv.length === 0 ? (
        <View style={[s.resaCard, Shadow.card]}><Text style={s.resaSub}>Aucun rendez-vous confirmé à venir.</Text></View>
      ) : (
        prochainsRdv.map((r) => (
          <ResaRow key={r.key} emoji={r.emoji} title={r.title} sub={r.sub} status="Confirmé" color={Colors.success} bg={Colors.successBg} />
        ))
      )}

      <Escrow
        title={heldCount > 0 ? `${heldCount} paiement${heldCount > 1 ? 's' : ''} en séquestre` : 'Aucun versement en attente'}
        sub="Tes paiements sont versés après chaque prestation accomplie."
      />
      <Shortcuts items={[['📬', 'Demandes', '/(tabs)/coach-demandes'], ['🎓', 'Mes services', '/(tabs)/coach-services'], ['🏆', 'Concours', '/(tabs)/coach-concours'], ['💬', 'Messages', '/messagerie']]} />
    </>
  );
}

/* ─────────────── ORGANISATEUR ─────────────── */
const ORG_SHORTCUTS: string[][] = [['🏆', 'Concours', '/(tabs)/org-concours'], ['📦', 'Services', '/(tabs)/org-services'], ['👥', 'Communauté', '/(tabs)/communaute'], ['💬', 'Messages', '/messagerie']];

function Organisateur() {
  // Concours publiés de l'organisateur connecté (source serveur, organisateur_id).
  const { concours: myConcours } = useMyConcours('publie');
  const activeConcours = useMemo(() => {
    if (!myConcours.length) return null;
    const now = Date.now();
    const upcoming = [...myConcours]
      .filter((c) => { const d = c.date_fin ?? c.date_debut; return !!d && new Date(`${d}T23:59:59`).getTime() >= now; })
      .sort((a, b) => (a.date_debut ?? '').localeCompare(b.date_debut ?? ''));
    return upcoming[0] ?? [...myConcours].sort((a, b) => (b.date_debut ?? '').localeCompare(a.date_debut ?? ''))[0];
  }, [myConcours]);

  // Radar réel (agrégats RGPD, mig 076) du concours actif. Jamais les données démo.
  const { radar, isDemo, error: radarError } = useOrgRadar(activeConcours?.id);
  const r = (!isDemo && !radarError) ? radar : null;

  if (!activeConcours) {
    return (
      <>
        <View style={[s.heroWrap, Shadow.card]}>
          <LinearGradient colors={['#FB923C', '#EA580C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <Text style={s.heKick}>ESPACE ORGANISATEUR</Text>
            <Text style={s.heTitle}>Aucun concours publié</Text>
            <Text style={s.heDesc}>Revendique ton concours FFE ou crée-le pour suivre sa préparation (Radar RGPD).</Text>
            <TouchableOpacity activeOpacity={0.85} onPress={() => go('/(tabs)/org-concours')} style={s.heCta}>
              <Text style={s.heCtaTxt}>Gérer mes concours  →</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
        <Shortcuts items={ORG_SHORTCUTS} />
      </>
    );
  }

  const jLabel = (() => {
    if (!activeConcours.date_debut) return '●';
    const d = Math.ceil((new Date(`${activeConcours.date_debut}T00:00:00`).getTime() - Date.now()) / 86400000);
    return d > 0 ? `J-${d}` : d === 0 ? 'Jour J' : '●';
  })();
  const engaged = r ? (r.engagement.cavaliers_engaged ?? (r.engagement.masked ? '<5' : '0')) : '—';
  const resaMax = r ? Math.max(r.reservations.total, 1) : 1;

  return (
    <>
      <Hero
        kick="TON CONCOURS"
        title={activeConcours.nom}
        meta={`${activeConcours.dateLabel}${activeConcours.lieu ? ` · ${activeConcours.lieu}` : ''}`}
        jLabel={jLabel}
        pct={undefined}
        onPress={() => go('/(tabs)/org-concours')}
      />
      <Stats items={[
        [r ? String(r.visibility.views) : '—', 'vues 30 j'],
        [r ? String(r.interest.followers) : '—', 'followers'],
        [String(engaged), 'cavaliers engagés'],
      ]} />

      <SectionRow title="Préparation des cavaliers" link="Radar" onLink={() => go('/(tabs)/org-concours')} />
      {r ? (
        <View style={[s.card, Shadow.card, { gap: Spacing.md }]}>
          <Bar label="🏠 Box réservés" value={r.reservations.box} max={resaMax} color={Colors.success} />
          <Bar label="🚚 Transport réservé" value={r.reservations.transport} max={resaMax} color={Colors.info} />
          <Bar label="🎓 Coaching réservé" value={r.reservations.coach} max={resaMax} color={Colors.dressage} />
        </View>
      ) : (
        <View style={[s.resaCard, Shadow.card]}><Text style={s.resaSub}>Radar indisponible pour ce concours pour le moment.</Text></View>
      )}

      <Escrow title="Données agrégées (RGPD)" sub="Les segments de moins de 5 cavaliers sont masqués. Aucune donnée nominative." />
      <Shortcuts items={ORG_SHORTCUTS} />
    </>
  );
}

/* ─────────────── ADMIN ─────────────── */
function fmtEurosK(cents: number | null | undefined): string {
  if (cents == null) return '—';
  const e = cents / 100;
  if (e >= 1000) return `${(e / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}k €`;
  return `${Math.round(e).toLocaleString('fr-FR')} €`;
}

function Admin() {
  // Vraies données plateforme (vues analytics + support). Mêmes sources que
  // admin-analytics.tsx / admin-support.tsx.
  const { data: mkt } = useMarketplaceAnalytics();
  const { count: supportOpen } = useOpenSupportCount();
  const disputesOpen = mkt.disputes?.disputes_open ?? 0;
  const gmv30 = mkt.revenue?.gmv_net_30d_cents ?? mkt.revenue?.gmv_brut_30d_cents ?? null;
  const toTreat = disputesOpen + supportOpen;

  return (
    <>
      <Hero
        kick="PLATEFORME"
        title={toTreat > 0 ? `${toTreat} élément${toTreat > 1 ? 's' : ''} à traiter` : 'Tout est à jour ✓'}
        meta="Litiges + réclamations en attente"
        jLabel="●"
        pct={undefined}
        onPress={() => go(disputesOpen > 0 ? '/(tabs)/admin-disputes' : supportOpen > 0 ? '/(tabs)/admin-support' : '/(tabs)/admin-analytics')}
      />
      <Stats items={[
        [String(disputesOpen), disputesOpen > 1 ? 'litiges ouverts' : 'litige ouvert', disputesOpen > 0 ? Colors.warning : undefined],
        [String(supportOpen), supportOpen > 1 ? 'réclamations' : 'réclamation'],
        [fmtEurosK(gmv30), 'GMV 30 j'],
      ]} />

      <SectionRow title="À traiter" link="Analytics" onLink={() => go('/(tabs)/admin-analytics')} />
      {toTreat === 0 ? (
        <View style={[s.resaCard, Shadow.card]}><Text style={s.resaSub}>Aucun litige ni réclamation en attente.</Text></View>
      ) : (
        <>
          {disputesOpen > 0 && (
            <ResaRow emoji="⚖️" title={`${disputesOpen} litige${disputesOpen > 1 ? 's' : ''} ouvert${disputesOpen > 1 ? 's' : ''}`}
              sub="À arbitrer" status="À traiter" color={Colors.urgent} bg={Colors.urgentBg} />
          )}
          {supportOpen > 0 && (
            <ResaRow emoji="📩" title={`${supportOpen} réclamation${supportOpen > 1 ? 's' : ''} EQ-REC`}
              sub="En attente de réponse" status="Ouvert" color={Colors.warning} bg={Colors.warningBg} />
          )}
        </>
      )}

      <Shortcuts items={[['📊', 'Analytics', '/(tabs)/admin-analytics'], ['⚖️', 'Litiges', '/(tabs)/admin-disputes'], ['📩', 'Réclamations', '/(tabs)/admin-support'], ['💶', 'Commissions', '/(tabs)/admin-commissions']]} />
    </>
  );
}

/* ─────────────── Composants partagés ─────────────── */
function Hero({ kick, title, meta, jLabel, pct, prep, onPress }: { kick: string; title: string; meta: string; jLabel: string; pct?: number; prep?: [string, boolean][]; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[s.heroWrap, Shadow.card]}>
      <LinearGradient colors={['#FB923C', '#EA580C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={s.heroTop}>
          <Text style={s.heroKick}>{kick}</Text>
          <View style={s.heroJ}><Text style={s.heroJTxt}>{jLabel}</Text></View>
        </View>
        <Text style={s.heroName}>{title}</Text>
        <Text style={s.heroMeta}>{meta}</Text>
        {prep && (
          <View style={s.prepRow}>
            {prep.map(([l, done]) => (
              <View key={l} style={s.prepChip}><Text style={s.prepDot}>{done ? '✓' : '○'}</Text><Text style={s.prepTxt}>{l}</Text></View>
            ))}
          </View>
        )}
        {typeof pct === 'number' && (
          <>
            <View style={s.heroBar}><View style={[s.heroFill, { width: `${pct}%` }]} /></View>
            <Text style={s.heroPct}>Déplacement prêt à {pct} %</Text>
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}
function Stats({ items }: { items: (string | undefined)[][] }) {
  return (
    <View style={s.stats}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={s.statSep} />}
          <View style={s.stat}><Text style={[s.statN, it[2] ? { color: it[2] } : null]}>{it[0]}</Text><Text style={s.statL}>{it[1]}</Text></View>
        </React.Fragment>
      ))}
    </View>
  );
}
function SectionRow({ title, link, onLink }: { title: string; link: string; onLink: () => void }) {
  return (
    <View style={s.sectionRow}>
      <Text style={s.section}>{title}</Text>
      <TouchableOpacity onPress={onLink}><Text style={s.sectionLink}>{link}</Text></TouchableOpacity>
    </View>
  );
}
function ResaRow({ emoji, title, sub, status, color, bg }: { emoji: string; title: string; sub: string; status: string; color: string; bg: string }) {
  return (
    <View style={[s.resaCard, Shadow.card]}>
      <View style={s.resaIcon}><Text style={{ fontSize: 18 }}>{emoji}</Text></View>
      <View style={{ flex: 1 }}><Text style={s.rowTitle}>{title}</Text><Text style={s.resaSub}>{sub}</Text></View>
      <View style={[s.badge, { backgroundColor: bg }]}><Text style={[s.badgeTxt, { color }]}>{status}</Text></View>
    </View>
  );
}
function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <View style={{ gap: 6 }}>
      <View style={s.barTop}><Text style={s.barLbl}>{label}</Text><Text style={s.barVal}>{value}</Text></View>
      <View style={s.barTrack}><View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} /></View>
    </View>
  );
}
function Escrow({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={[s.escrow, Shadow.card]}>
      <Text style={s.escrowIcon}>🔒</Text>
      <View style={{ flex: 1 }}><Text style={s.escrowTitle}>{title}</Text><Text style={s.escrowSub}>{sub}</Text></View>
    </View>
  );
}
function Shortcuts({ items }: { items: string[][] }) {
  return (
    <>
      <Text style={[s.section, { marginTop: Spacing.sm }]}>Raccourcis</Text>
      <View style={s.grid}>
        {items.map((q) => (
          <TouchableOpacity key={q[1]} style={[s.tile, Shadow.card]} activeOpacity={0.85} onPress={() => go(q[2])}>
            <Text style={{ fontSize: 24 }}>{q[0]}</Text>
            <Text style={s.tileTxt}>{q[1]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

function go(route: string) { router.push(route as any); }
function initials(p: string, n: string) { return `${(p || '').charAt(0)}${(n || '').charAt(0)}`.toUpperCase() || '··'; }

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { padding: Spacing.lg, gap: Spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hello: { fontSize: FontSize.xxxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.base, color: Colors.textSecondary, marginTop: 2 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#FFF', fontWeight: FontWeight.bold, fontSize: FontSize.base },

  heroWrap: { borderRadius: Radius.xl, overflow: 'hidden', marginTop: Spacing.xs },
  hero: { padding: Spacing.xl },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroKick: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: FontWeight.extrabold, letterSpacing: 1.5 },
  heroJ: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  heroJTxt: { color: '#FFF', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  heroName: { color: '#FFF', fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, marginTop: 10 },
  heroMeta: { color: 'rgba(255,255,255,0.92)', fontSize: FontSize.sm, marginTop: 4 },
  prepRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.md, flexWrap: 'wrap' },
  prepChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  prepDot: { color: '#FFF', fontSize: 12, fontWeight: FontWeight.bold }, prepTxt: { color: '#FFF', fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  heroBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', marginTop: Spacing.md, overflow: 'hidden' },
  heroFill: { height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  heroPct: { color: 'rgba(255,255,255,0.92)', fontSize: FontSize.xs, marginTop: 6, fontWeight: FontWeight.medium },

  // Hybride V5 (anneau) + V8 (prestataires / slot manquant)
  hRingRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: Spacing.md },
  hRing: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  hRingInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#D9610C', alignItems: 'center', justifyContent: 'center' },
  hRingNum: { color: '#FFF', fontSize: 16, fontWeight: FontWeight.extrabold },
  hRingLbl: { color: 'rgba(255,255,255,0.85)', fontSize: 10 },
  hSide: { flex: 1, gap: 6 },
  hLine: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  hAv: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  hAvOn: { backgroundColor: 'rgba(255,255,255,0.22)' },
  hAvDash: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)', borderStyle: 'dashed' },
  hAvTxt: { color: '#FFF', fontSize: 11, fontWeight: FontWeight.bold },
  hLineLabel: { color: '#FFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  hLineSub: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.xs, marginTop: 1 },
  hLineMiss: { color: '#FFE2A0', fontWeight: FontWeight.bold },
  hOk: { color: '#BBF7D0', fontWeight: FontWeight.bold, fontSize: 14 },
  hGo: { color: '#FFE2A0', fontWeight: FontWeight.bold, fontSize: 18 },
  hMissBlock: { marginTop: Spacing.sm },
  hProof: { color: '#FFE2A0', fontSize: FontSize.xs, fontWeight: FontWeight.semibold, marginTop: Spacing.md, marginBottom: 2 },
  hCta: { marginTop: 8, backgroundColor: '#FFF', borderRadius: Radius.md, paddingVertical: 11, alignItems: 'center' },
  hCtaTxt: { color: '#EA580C', fontSize: FontSize.base, fontWeight: FontWeight.bold },
  hReady: { marginTop: Spacing.md, color: '#FFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold, textAlign: 'center' },

  // Hero état vide — V1 « Trio rassurant »
  heRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  heDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gold },
  heKick: { color: 'rgba(255,255,255,0.9)', fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, letterSpacing: 1.4 },
  heTitle: { color: '#FFF', fontSize: FontSize.display, fontWeight: FontWeight.extrabold, marginTop: Spacing.md, lineHeight: 32 },
  heDesc: { color: 'rgba(255,255,255,0.92)', fontSize: FontSize.base, lineHeight: 20, marginTop: Spacing.sm },
  hePills: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  hePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999,
    paddingHorizontal: Spacing.md, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  hePillIcon: { fontSize: 14 },
  hePillTxt: { color: '#FFF', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  heCta: {
    marginTop: Spacing.xl, backgroundColor: '#FFF', borderRadius: Radius.lg,
    paddingVertical: 14, alignItems: 'center', ...Shadow.card,
  },
  heCtaTxt: { color: Colors.primaryDark, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  heTrust: { color: 'rgba(255,255,255,0.85)', fontSize: FontSize.xs, fontWeight: FontWeight.medium, textAlign: 'center', marginTop: Spacing.md },

  stats: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingVertical: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  stat: { flex: 1, alignItems: 'center' },
  statN: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  statL: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, textAlign: 'center' },
  statSep: { width: 1, height: 30, backgroundColor: Colors.border },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  section: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  sectionLink: { fontSize: FontSize.base, color: Colors.primary, fontWeight: FontWeight.semibold },

  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },

  payCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.warningBorder },
  payIcon: { width: 42, height: 42, borderRadius: Radius.md, backgroundColor: Colors.warningBg, alignItems: 'center', justifyContent: 'center' },
  paySub: { fontSize: FontSize.xs, color: Colors.warning, marginTop: 2, fontWeight: FontWeight.medium },
  amt: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  payBtn: { backgroundColor: Colors.primary, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  payBtnTxt: { color: '#FFF', fontSize: FontSize.sm, fontWeight: FontWeight.bold },

  resaCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  resaIcon: { width: 38, height: 38, borderRadius: Radius.md, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  resaSub: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },

  barTop: { flexDirection: 'row', justifyContent: 'space-between' },
  barLbl: { fontSize: FontSize.base, color: Colors.textPrimary, fontWeight: FontWeight.medium },
  barVal: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.backgroundSecondary, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },

  escrow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.primaryLight, borderRadius: Radius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.primaryBorder, marginTop: Spacing.sm },
  escrowIcon: { fontSize: 22 },
  escrowTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primaryDark },
  escrowSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 3, lineHeight: 17 },

  grid: { flexDirection: 'row', gap: Spacing.sm },
  tile: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: Colors.surface, borderRadius: Radius.lg, paddingVertical: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  tileTxt: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textPrimary, textAlign: 'center' },
});
