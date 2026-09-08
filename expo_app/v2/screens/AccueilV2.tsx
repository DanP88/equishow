// ─────────────────────────────────────────────────────────────────────────────
// AccueilV2 — récap perso · thème « Blush + fun » (test).
//
//   Palette Blush (#6) + étiquettes / fun de Sticker pop (#2), dosage Équilibré.
//   Tutoiement · titres Fraunces · pastilles rondes légèrement inclinées ·
//   lilas sur les libellés de section, corail = dispo, prune/berry = temps.
//
//   0. Salut {Prénom} 👋
//   1. Ton prochain concours (0 / 1 / plusieurs pertinents) + étiquette « à J-X »
//   2. À traiter (si count > 0)
//   3. On s'organise ? — Je cherche / Je propose
//   4. Le fil des cavalières (aperçu)
//   5. Concours à venir (découverte)
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { BL, FONT, countdown, daysUntil } from '../ui/blush';
import { Sticker } from '../ui/Sticker';
import { Icon } from '../ui/Icon';
import { useV2Session } from '../auth';
import { useCapabilities } from '../capabilities';
import { useConcoursList } from '../../hooks/useConcours';
import { useConcoursLocal } from '../state/concoursLocal';
import { useV2Todo } from '../adapters/todo';
import { useV2Community } from '../adapters/community';

function isUpcoming(c: { date_fin: string | null; date_debut: string | null }) {
  const d = c.date_fin ?? c.date_debut;
  if (!d) return true;
  const t = new Date(`${d}T00:00:00`).getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return t >= today.getTime();
}

export function AccueilV2() {
  const { identity } = useV2Session();
  const caps = useCapabilities();
  const { concours } = useConcoursList();
  const local = useConcoursLocal();

  const upcoming = useMemo(() => concours.filter(isUpcoming), [concours]);
  const pertinents = useMemo(
    () => upcoming.filter((c) => local.followingIds.includes(c.id) || local.goingIds.includes(c.id)),
    [upcoming, local.followingIds, local.goingIds],
  );
  const next = pertinents[0] ?? null;
  const nextEntry = useConcoursLocal(next?.id);
  const others = pertinents.length - 1;

  const { items: actions } = useV2Todo();
  const community = useV2Community('community').posts.slice(0, 2);
  const communityCount = useV2Community('community').posts.length;

  const prenom = identity?.prenom?.trim();
  const cd = next ? countdown(daysUntil(next.date_debut ?? next.date_fin)) : null;
  const discovery = upcoming.filter((c) => c.id !== next?.id).slice(0, 3);

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.pad} showsVerticalScrollIndicator={false}>

        {/* 0 — SALUTATION */}
        <View style={s.hello}>
          <Text style={s.helloT}>Salut {prenom || 'toi'} 👋</Text>
          <Text style={s.helloS}>Voici ton récap du moment.</Text>
        </View>

        {/* 1 — TON PROCHAIN CONCOURS */}
        {!next ? (
          <View style={s.card}>
            <Text style={s.kicker}>Ton prochain concours</Text>
            <Text style={s.emptyT}>Tu n'as pas encore de concours prévu.</Text>
            <Text style={s.meta}>Sur EquiShow, tout part d'un concours : transport, box, coach, infos, discussions.</Text>
            <Pill label="Trouver un concours" onPress={() => router.replace('/(v2)/concours' as any)} />
          </View>
        ) : (
          <TouchableOpacity
            style={[s.card, s.hero]}
            activeOpacity={0.92}
            onPress={() => router.push(`/(v2)/concours/${next.id}` as any)}
          >
            {cd && <Sticker label={cd.label} tone={cd.tone} tilt={3} style={s.heroSticker} />}
            <Text style={s.kicker}>
              Ton prochain concours{nextEntry.entry.going ? '  ·  tu y participes' : nextEntry.entry.following ? '  ·  suivi' : ''}
            </Text>
            <Text style={s.heroTitle}>{next.nom}</Text>
            <Text style={s.meta}>
              {[next.type_concours && next.type_concours !== 'nan' ? next.type_concours : null, next.dateLabel, next.lieu].filter(Boolean).join('  ·  ')}
            </Text>

            {nextEntry.entry.going ? (
              <>
                <Text style={s.prep}>Préparation {nextEntry.prepScore}/5</Text>
                <Pill label="Préparer mon concours" onPress={() => router.push(`/(v2)/concours/${next.id}/preparer` as any)} />
              </>
            ) : (
              <Pill label="Voir la fiche du concours" onPress={() => router.push(`/(v2)/concours/${next.id}` as any)} />
            )}

            {others > 0 && (
              <TouchableOpacity onPress={() => router.replace('/(v2)/concours?tab=suivis' as any)} hitSlop={6}>
                <Text style={s.ghost}>+ {others} autre{others > 1 ? 's' : ''} concours à venir</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        )}

        {/* 2 — À TRAITER */}
        {actions.length > 0 && (
          <View style={s.block}>
            <View style={s.secRow}><Text style={s.secT}>À traiter · {actions.length}</Text></View>
            <View style={s.listCard}>
              {actions.map((a, i) => (
                <TouchableOpacity key={a.id} style={[s.li, i > 0 && s.liDiv]} activeOpacity={0.7} onPress={() => router.push(a.target as any)}>
                  <Icon name={a.icon} size={17} color={BL.faint} />
                  <Text style={s.liLabel} numberOfLines={1}>{a.label}</Text>
                  <Text style={s.chev}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* 3 — ON S'ORGANISE ? */}
        <View style={s.block}>
          <View style={s.secRow}><Text style={s.secT}>On s'organise&nbsp;?</Text></View>
          <View style={s.tiles}>
            <TileCard icon="🔎" title="Je cherche" sub="transport · box · coach" onPress={() => router.push('/(v2)/cherche' as any)} />
            <TileCard icon="📣" title="Je propose" sub={caps.has('coach') ? 'une place · un box · du coaching' : 'une place · un box'} onPress={() => router.push('/(v2)/propose' as any)} />
          </View>
        </View>

        {/* 4 — LE FIL DES CAVALIÈRES */}
        {community.length > 0 && (
          <View style={s.block}>
            <View style={s.secRow}>
              <Text style={s.secT}>Le fil des cavalières</Text>
              <TouchableOpacity onPress={() => router.replace('/(v2)/communaute' as any)} hitSlop={6}><Text style={s.act}>Tout voir</Text></TouchableOpacity>
            </View>
            <View style={s.softCard}>
              {communityCount > 0 && <Sticker label={`✨ ${Math.min(communityCount, 9)} récents`} tone="lilac" tilt={-3} style={s.softSticker} />}
              {community.map((p, i) => (
                <Text key={p.id} style={[s.post, i > 0 && { marginTop: 6 }]} numberOfLines={1}>
                  <Text style={s.postAuthor}>{p.auteur} — </Text>{p.contenu}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* 5 — CONCOURS À VENIR (découverte) */}
        {discovery.length > 0 && (
          <View style={s.block}>
            <View style={s.secRow}>
              <Text style={s.secT}>Concours à venir</Text>
              <TouchableOpacity onPress={() => router.replace('/(v2)/concours' as any)} hitSlop={6}><Text style={s.act}>Tout voir</Text></TouchableOpacity>
            </View>
            <View style={s.listCard}>
              {discovery.map((c, i) => (
                <TouchableOpacity key={c.id} style={[s.li, i > 0 && s.liDiv]} activeOpacity={0.7} onPress={() => router.push(`/(v2)/concours/${c.id}` as any)}>
                  <Icon name="trophy-outline" size={16} color={BL.faint} />
                  <Text style={s.liLabel} numberOfLines={1}>{c.nom}</Text>
                  {(c.followers_count ?? 0) === 0 && <Sticker label="à découvrir" tone="lilac" tilt={0} style={s.liTag} />}
                  <Text style={s.liVal}>{c.dateLabel}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ── sous-composants ────────────────────────────────────────────────────────
function Pill({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={s.pill} activeOpacity={0.9} onPress={onPress}>
      <Text style={s.pillTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

function TileCard({ icon, title, sub, onPress }: { icon: string; title: string; sub: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={s.tile} activeOpacity={0.9} onPress={onPress}>
      <Text style={s.tileIc}>{icon}</Text>
      <Text style={s.tileTitle}>{title}</Text>
      <Text style={s.tileSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BL.bg },
  pad: { padding: 16, paddingBottom: 44, gap: 4 },

  hello: { marginBottom: 4 },
  helloT: { fontFamily: FONT.head, fontSize: 22, fontWeight: '700', color: BL.ink, letterSpacing: -0.2 },
  helloS: { fontFamily: FONT.body, fontSize: 12, color: BL.sub, marginTop: 2 },

  block: { marginTop: 14, gap: 8 },
  card: {
    backgroundColor: BL.card, borderRadius: BL.radius, borderWidth: 1, borderColor: BL.line,
    padding: 16, gap: 6,
    shadowColor: BL.accent, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 2,
  },
  hero: { borderColor: BL.accentLine, marginTop: 13, overflow: 'visible' },
  heroSticker: { position: 'absolute', top: -10, right: 14, zIndex: 3 },

  kicker: { fontFamily: FONT.body, fontSize: 9, fontWeight: '800', letterSpacing: 0.9, textTransform: 'uppercase', color: BL.accent },
  heroTitle: { fontFamily: FONT.head, fontSize: 20, fontWeight: '700', color: BL.ink, marginTop: 3, lineHeight: 24 },
  emptyT: { fontFamily: FONT.head, fontSize: 16, fontWeight: '600', color: BL.ink, marginTop: 2 },
  meta: { fontFamily: FONT.body, fontSize: 12, color: BL.sub, marginTop: 3, lineHeight: 18 },
  prep: { fontFamily: FONT.body, fontSize: 12, color: BL.ink, fontWeight: '700', marginTop: 7 },
  ghost: { fontFamily: FONT.body, fontSize: 11, color: BL.sub, fontWeight: '700', textAlign: 'center', marginTop: 9 },

  pill: { marginTop: 11, backgroundColor: BL.accent, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  pillTxt: { fontFamily: FONT.body, color: BL.accentInk, fontWeight: '800', fontSize: 13 },

  secRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  secT: { fontFamily: FONT.body, fontSize: 9, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: BL.lilac },
  act: { fontFamily: FONT.body, fontSize: 10.5, fontWeight: '800', color: BL.lilac },

  listCard: { backgroundColor: BL.card, borderRadius: BL.radiusCard, borderWidth: 1, borderColor: BL.line, overflow: 'hidden' },
  li: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 13, paddingHorizontal: 13 },
  liDiv: { borderTopWidth: 1, borderTopColor: BL.line },
  liLabel: { flex: 1, fontFamily: FONT.body, fontSize: 13, color: BL.ink, fontWeight: '700' },
  liVal: { fontFamily: FONT.body, fontSize: 11, color: BL.sub, fontWeight: '600' },
  liTag: { marginRight: 2 },
  chev: { fontSize: 18, color: BL.faint },

  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, backgroundColor: BL.card, borderRadius: BL.radiusTile, borderWidth: 1, borderColor: BL.line, padding: 13, gap: 3 },
  tileIc: { fontSize: 16 },
  tileTitle: { fontFamily: FONT.head, fontSize: 13, fontWeight: '700', color: BL.ink },
  tileSub: { fontFamily: FONT.body, fontSize: 9.5, color: BL.sub },

  softCard: { backgroundColor: BL.card, borderRadius: BL.radiusCard, borderWidth: 1, borderColor: BL.line, padding: 13, gap: 6, overflow: 'visible' },
  softSticker: { position: 'absolute', top: -9, right: 12, zIndex: 3 },
  post: { fontFamily: FONT.body, fontSize: 11, color: BL.sub },
  postAuthor: { fontWeight: '800', color: BL.ink },
});
