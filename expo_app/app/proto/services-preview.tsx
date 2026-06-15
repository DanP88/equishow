import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';

/**
 * PROTOTYPE — aperçu fidèle du HAUT de l'écran Services réel (app/(tabs)/services.tsx),
 * reproduit ici hors auth pour la démo. La vraie modif (bannière additive) est bien
 * dans services.tsx ; cet écran sert uniquement à la capture / visualisation.
 */
export default function ProtoServicesPreview() {
  return (
    <SafeAreaView style={s.root}>
      {/* Header (copie services.tsx) */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Services</Text>
          <Text style={s.headerSub}>Transport · Box · Coaching</Text>
        </View>
        <View style={s.headerRight}>
          <View style={s.filterBtn}><Text style={s.filterIcon}>⚙️</Text><Text style={s.filterLabel}>Filtres</Text></View>
          <View style={s.msgBtn}><Text style={s.msgBtnIcon}>💬</Text></View>
        </View>
      </View>

      {/* Stripe bar (copie) */}
      <View style={s.stripeBar}>
        <Text style={s.stripeIcon}>🔒</Text>
        <Text style={s.stripeText}>Paiements sécurisés via Stripe — commission 5%</Text>
      </View>

      {/* Bannière concours additive (telle qu'injectée dans services.tsx) */}
      <TouchableOpacity style={s.protoConcoursBanner} activeOpacity={0.85} onPress={() => router.push('/proto/concours-list' as any)}>
        <Text style={s.protoConcoursIcon}>🏆</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.protoConcoursTitle}>Je prépare un concours</Text>
          <Text style={s.protoConcoursSub}>Box, transport & coach pour ton déplacement</Text>
        </View>
        <View style={s.protoConcoursCta}><Text style={s.protoConcoursCtaTxt}>Voir →</Text></View>
      </TouchableOpacity>

      {/* Tabs (copie) */}
      <View style={s.tabBar}>
        <View style={[s.tabBtn, s.tabBtnActive]}><Text style={[s.tabLabel, s.tabLabelActive]}>Transport</Text></View>
        <View style={s.tabBtn}><Text style={s.tabLabel}>Box</Text></View>
        <View style={s.tabBtn}><Text style={s.tabLabel}>Coachs</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.list}>
        {/* annonce factice pour montrer la continuité du parcours actuel */}
        <View style={s.bannerAdd}>
          <Text style={s.bannerAddIcon}>🚐</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.bannerAddText}>Vous avez des places dans votre van ?</Text>
            <Text style={s.bannerAddHint}>Recommandé : 0,8€/km</Text>
          </View>
          <View style={s.bannerAddBtn}><Text style={s.bannerAddBtnTxt}>Proposer</Text></View>
        </View>
        <View style={s.fakeCard}>
          <Text style={s.fakeRoute}>Lyon → Fontainebleau</Text>
          <Text style={s.fakeMeta}>Ven 14 juin · 2 places · 120 €</Text>
        </View>
        <View style={s.fakeCard}>
          <Text style={s.fakeRoute}>Caen → Deauville</Text>
          <Text style={s.fakeMeta}>Mar 17 juin · 3 places · 45 €</Text>
        </View>
        <Text style={s.note}>
          ↑ Le parcours actuel (Transport / Box / Coach) reste intact. La bannière concours est
          un accélérateur optionnel, jamais un passage obligatoire.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  headerSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  filterIcon: { fontSize: 12 },
  filterLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  msgBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  msgBtnIcon: { fontSize: 16 },

  stripeBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs, backgroundColor: Colors.surfaceVariant, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border },
  stripeIcon: { fontSize: 11 },
  stripeText: { fontSize: 10, color: Colors.textTertiary },

  protoConcoursBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginHorizontal: Spacing.lg, marginTop: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.primaryBorder, backgroundColor: Colors.primaryLight },
  protoConcoursIcon: { fontSize: 24 },
  protoConcoursTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.primaryDark },
  protoConcoursSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  protoConcoursCta: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  protoConcoursCtaTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.sm },

  tabBar: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg, paddingBottom: Spacing.md },
  tabBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: 20, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface },
  tabBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
  tabLabelActive: { color: Colors.textInverse },

  list: { paddingHorizontal: Spacing.lg, paddingBottom: 100, gap: Spacing.md },
  bannerAdd: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.goldBg, borderWidth: 1, borderColor: Colors.goldBorder, borderRadius: Radius.lg, padding: Spacing.md },
  bannerAddIcon: { fontSize: 22 },
  bannerAddText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary },
  bannerAddHint: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
  bannerAddBtn: { backgroundColor: Colors.gold, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  bannerAddBtnTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.xs },
  fakeCard: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg, padding: Spacing.lg },
  fakeRoute: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  fakeMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  note: { fontSize: FontSize.xs, color: Colors.textTertiary, lineHeight: 17, marginTop: Spacing.sm },
});
