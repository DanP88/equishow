/**
 * Onglet ACCUEIL — tableau de bord d'accueil, adapté au rôle (cavalier / coach /
 * organisateur / admin). Récapitule l'essentiel + raccourcis vers les écrans réels.
 * Présentationnel (données illustratives) pour les compteurs détaillés ; le prénom
 * et la navigation sont réels. À brancher progressivement sur les hooks existants.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { useUserRole } from '../../hooks/useUserRole';
import { userStore } from '../../data/store';
import { useMyChevaux } from '../../hooks/useChevaux';
import { useChevalConcours, CModuleKey } from '../../hooks/useChevalReservations';
import { useMyEscrowPayments } from '../../hooks/useMyEscrowPayments';
import { useMyReservationsSummary, ResaModule } from '../../hooks/useMyReservationsSummary';

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
        <View style={s.avatar}><Text style={s.avatarTxt}>{initials(prenom, userStore.nom)}</Text></View>
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
function formatHeroDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(+d)) return '';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
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
  const { items: concoursItems } = useChevalConcours(concoursIds);
  // Réservations réelles de l'utilisateur (acheteur) + escrow.
  const { items: resa, toPay } = useMyReservationsSummary();
  const { byReservation } = useMyEscrowPayments();

  const heldCount = useMemo(
    () => Object.values(byReservation).filter((p) => p.transferState === 'held').length,
    [byReservation],
  );

  const upcoming = useMemo(() => concoursItems.filter((i) => !i.past && i.concoursNom), [concoursItems]);
  const hero = upcoming[0];
  const heroPrep = useMemo(() => {
    if (!hero) return { pct: 0, reserved: new Set<CModuleKey>() };
    const reserved = new Set<CModuleKey>(hero.reserved.map((r) => r.module));
    const done = PREP_MODULES.filter((m) => reserved.has(m)).length;
    return { pct: Math.round((done / PREP_MODULES.length) * 100), reserved };
  }, [hero]);
  const heroDays = hero ? daysTo(hero.dateFin) : null;

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
            {hero.dateFin && <Text style={s.heroMeta}>{formatHeroDate(hero.dateFin)}</Text>}
            <View style={s.prepRow}>
              {PREP_MODULES.map((m) => (
                <View key={m} style={s.prepChip}>
                  <Text style={s.prepDot}>{heroPrep.reserved.has(m) ? '✓' : '○'}</Text>
                  <Text style={s.prepTxt}>{RESA_META[m].label}</Text>
                </View>
              ))}
            </View>
            <View style={s.heroBar}><View style={[s.heroFill, { width: `${heroPrep.pct}%` }]} /></View>
            <Text style={s.heroPct}>Déplacement prêt à {heroPrep.pct} %</Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity activeOpacity={0.92} onPress={() => go('/(tabs)/concours-hub')} style={[s.heroWrap, Shadow.card]}>
          <LinearGradient colors={['#FB923C', '#EA580C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
            <Text style={s.heroKick}>VOTRE PROCHAIN CONCOURS</Text>
            <Text style={[s.heroName, { marginTop: 6 }]}>Trouvez votre concours</Text>
            <Text style={s.heroMeta}>Suivez un concours et Equishow organise box, transport et coach.</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Récap chiffres réels */}
      <View style={s.stats}>
        <View style={s.stat}><Text style={s.statN}>{resa.length}</Text><Text style={s.statL}>réservations</Text></View>
        <View style={s.statSep} />
        <View style={s.stat}><Text style={[s.statN, { color: Colors.warning }]}>{toPay.length}</Text><Text style={s.statL}>à régler</Text></View>
        <View style={s.statSep} />
        <View style={s.stat}><Text style={s.statN}>{upcoming.length}</Text><Text style={s.statL}>concours à venir</Text></View>
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
  return (
    <>
      <Hero kick="TON ACTIVITÉ" title="2 demandes en attente" meta="Réponds vite pour ne pas perdre de réservations" jLabel="●" pct={undefined} onPress={() => go('/(tabs)/coach-demandes')} />
      <Stats items={[['2', 'demandes'], ['4', 'cours à venir'], ['1', 'stage en cours']]} />

      <SectionRow title="Demandes récentes" link="Voir tout" onLink={() => go('/(tabs)/coach-demandes')} />
      {[
        ['🎓', 'Cours CSO · Sarah L.', 'CSO de Saumur · 19 juil.', 'À traiter', Colors.warning, Colors.warningBg],
        ['📚', 'Stage perfectionnement', '2 places demandées', 'À traiter', Colors.warning, Colors.warningBg],
      ].map((r, i) => <ResaRow key={i} emoji={r[0]} title={r[1]} sub={r[2]} status={r[3]} color={r[4]} bg={r[5]} />)}

      <SectionRow title="Prochains rendez-vous" link="Agenda" onLink={() => go('/(tabs)/coach-agenda')} />
      {[
        ['📅', 'Coaching · Léa M.', 'Demain 14 h · Grand National Dijon', 'Confirmé', Colors.success, Colors.successBg],
        ['📚', 'Stage 2 jours', '10–11 juil. · 4 inscrits', 'Confirmé', Colors.success, Colors.successBg],
      ].map((r, i) => <ResaRow key={i} emoji={r[0]} title={r[1]} sub={r[2]} status={r[3]} color={r[4]} bg={r[5]} />)}

      <Escrow title="200 € à libérer bientôt" sub="Tes paiements sont versés après chaque prestation accomplie." />
      <Shortcuts items={[['📬', 'Demandes', '/(tabs)/coach-demandes'], ['🎓', 'Mes services', '/(tabs)/coach-services'], ['🏆', 'Concours', '/(tabs)/coach-concours'], ['💬', 'Messages', '/messagerie']]} />
    </>
  );
}

/* ─────────────── ORGANISATEUR ─────────────── */
function Organisateur() {
  return (
    <>
      <Hero kick="TON CONCOURS" title="CSO de Saumur" meta="18–20 juil. · Organisateur vérifié ✓" jLabel="J-12" pct={undefined} onPress={() => go('/(tabs)/org-concours')} />
      <Stats items={[['247', 'vues'], ['38', 'followers'], ['18', 'cavaliers engagés']]} />

      <SectionRow title="Préparation des cavaliers" link="Radar" onLink={() => go('/(tabs)/org-concours')} />
      <View style={[s.card, Shadow.card, { gap: Spacing.md }]}>
        {[['🏠 Box réservés', 14, 30, Colors.success], ['🚚 Transport recherché', 9, 30, Colors.info], ['🎓 Coaching demandé', 7, 30, Colors.dressage]].map((b, i) => (
          <Bar key={i} label={b[0] as string} value={b[1] as number} max={b[2] as number} color={b[3] as string} />
        ))}
      </View>

      <Escrow title="Données agrégées (RGPD)" sub="Les segments de moins de 5 cavaliers sont masqués. Aucune donnée nominative." />
      <Shortcuts items={[['🏆', 'Concours', '/(tabs)/org-concours'], ['📦', 'Services', '/(tabs)/org-services'], ['👥', 'Communauté', '/(tabs)/communaute'], ['💬', 'Messages', '/messagerie']]} />
    </>
  );
}

/* ─────────────── ADMIN ─────────────── */
function Admin() {
  return (
    <>
      <Hero kick="PLATEFORME" title="Tout est sous contrôle" meta="Vue d’ensemble en temps réel" jLabel="●" pct={undefined} onPress={() => go('/(tabs)/admin-analytics')} />
      <Stats items={[['1', 'litige ouvert', Colors.warning], ['3', 'réclamations'], ['12,4k€', 'GMV 30 j']]} />

      <SectionRow title="À traiter" link="Analytics" onLink={() => go('/(tabs)/admin-analytics')} />
      {[
        ['⚖️', 'Litige #EQ-1042', 'Transport · ouvert il y a 6 h', 'À traiter', Colors.urgent, Colors.urgentBg],
        ['📩', '3 réclamations EQ-REC', 'En attente de réponse', 'Ouvert', Colors.warning, Colors.warningBg],
      ].map((r, i) => <ResaRow key={i} emoji={r[0]} title={r[1]} sub={r[2]} status={r[3]} color={r[4]} bg={r[5]} />)}

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
