// ─────────────────────────────────────────────────────────────────────────────
// AdminProfilV2 — reskin Blush fusionnant app/(tabs)/admin-profil.tsx +
// app/(tabs)/admin-settings.tsx (identité, infos système, revendications de
// concours, déconnexion). Pas de « changer de compte » (outillage de test V1
// hors périmètre — la V2 a son propre panneau DEV).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { BL, FONT } from '../../ui/blush';
import { Spacing, FontSize, FontWeight } from '../../../constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useV2Session } from '../../auth';
import { useOpenConcoursClaimsCount } from '../../../hooks/useConcoursClaims';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { AlertModal } from '../../../components/AlertModal';

export function AdminProfilV2() {
  const { identity } = useV2Session();
  const { logout } = useAuth();
  const { count: pendingClaims, reload: reloadClaims } = useOpenConcoursClaimsCount();
  useFocusEffect(useCallback(() => { reloadClaims(); }, [reloadClaims]));

  const [loggingOut, setLoggingOut] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doLogout() {
    if (loggingOut) return;
    setConfirm(false);
    setLoggingOut(true);
    const { error: e } = await logout();
    if (e) {
      setLoggingOut(false);
      setError(typeof e === 'string' ? e : 'Impossible de se déconnecter.');
      return;
    }
    router.replace('/(auth)/login');
  }

  const initials = ((identity?.prenom?.[0] ?? '') + (identity?.nom?.[0] ?? '')).toUpperCase() || 'AD';

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.pad}>
        <Text style={s.h1}>Profil Admin</Text>

        <View style={s.identCard}>
          <View style={s.avatar}><Text style={s.avatarTxt}>{initials}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{identity?.prenom} {identity?.nom}</Text>
            <Text style={s.email}>{identity?.email}</Text>
            <View style={s.rolePill}><Text style={s.rolePillTxt}>Administrateur</Text></View>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Informations système</Text>
          <Row label="Environnement" value="Production" />
          <Row label="Projet Supabase" value="vhkjvnpxcqlmpokrgymx" />
        </View>

        <TouchableOpacity style={s.claimsBtn} onPress={() => router.push('/(v2)/admin/concours-claims' as any)} activeOpacity={0.85}>
          <Text style={s.claimsIcon}>🏆</Text>
          <View style={{ flex: 1 }}>
            <View style={s.claimsTitleRow}>
              <Text style={s.claimsTitle}>Revendications de concours</Text>
              {pendingClaims > 0 && <View style={s.countBadge}><Text style={s.countBadgeTxt}>{pendingClaims}</Text></View>}
            </View>
            <Text style={s.claimsSub}>Valider / refuser les demandes des organisateurs</Text>
          </View>
          <Text style={s.claimsArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[s.logoutBtn, loggingOut && { opacity: 0.6 }]} onPress={() => setConfirm(true)} disabled={loggingOut} activeOpacity={0.85}>
          <Text style={s.logoutTxt}>{loggingOut ? 'Déconnexion…' : 'Se déconnecter'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <ConfirmModal visible={confirm} title="Se déconnecter ?" message="Vous reviendrez à l'écran de connexion." cancelLabel="Annuler" confirmLabel="Se déconnecter" destructive onCancel={() => setConfirm(false)} onConfirm={doLogout} />
      <AlertModal visible={!!error} title="Erreur" message={error ?? ''} variant="error" onClose={() => setError(null)} />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BL.bg },
  pad: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 60 },
  h1: { fontFamily: FONT.head, fontSize: 25, fontWeight: '700', color: BL.ink },
  identCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: BL.card, borderRadius: 16, borderWidth: 1, borderColor: BL.line, padding: Spacing.lg },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: BL.lilac, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: BL.ink },
  email: { fontSize: FontSize.xs, color: BL.sub, marginTop: 2 },
  rolePill: { alignSelf: 'flex-start', backgroundColor: BL.lilacSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 },
  rolePillTxt: { fontSize: 11, fontWeight: '700', color: BL.lilac },
  card: { backgroundColor: BL.card, borderRadius: 16, borderWidth: 1, borderColor: BL.line, padding: Spacing.lg, gap: 2 },
  cardTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: BL.ink, marginBottom: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: BL.line },
  rowLabel: { fontSize: FontSize.sm, color: BL.sub, fontWeight: FontWeight.semibold },
  rowValue: { fontSize: FontSize.sm, color: BL.ink, fontWeight: FontWeight.semibold },
  claimsBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: BL.accentSoft, borderRadius: 16, padding: Spacing.lg, borderWidth: 1, borderColor: BL.accentLine },
  claimsIcon: { fontSize: 26 },
  claimsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  claimsTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: BL.accent },
  claimsSub: { fontSize: FontSize.xs, color: BL.sub, marginTop: 2 },
  claimsArrow: { fontSize: 22, color: BL.accent },
  countBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: BL.berry, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countBadgeTxt: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  logoutBtn: { backgroundColor: BL.berry, borderRadius: 999, paddingVertical: Spacing.md, alignItems: 'center' },
  logoutTxt: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#fff' },
});
