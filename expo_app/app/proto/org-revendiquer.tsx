import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';

/** PROTOTYPE — Étape 7 : formulaire de revendication (mock, aucun envoi réel). */
export default function ProtoOrgRevendiquer() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ structure: '', email: '', tel: '', site: '', comment: '' });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (sent) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
          <Text style={s.title}>Revendication envoyée</Text>
        </View>
        <View style={s.successWrap}>
          <Text style={s.successIcon}>✅</Text>
          <Text style={s.successTitle}>Demande envoyée</Text>
          <Text style={s.successTxt}>
            Ta revendication est en cours de validation par un administrateur Equishow.
            Tu seras notifié sous 24-48h.
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.replace('/proto/org' as any)}>
            <Text style={s.primaryTxt}>Voir mes concours</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Text style={s.backTxt}>←</Text></TouchableOpacity>
        <Text style={s.title}>Revendiquer un concours</Text>
      </View>

      <ScrollView contentContainerStyle={s.list} keyboardShouldPersistTaps="handled">
        <View style={s.ctx}>
          <Text style={s.ctxTxt}>🏆 CSO de Deauville · 19-21 juil · Deauville (14)</Text>
        </View>

        <Field label="Nom de la structure *" value={form.structure} onChange={set('structure')} placeholder="Étrier de Deauville" />
        <Field label="Email *" value={form.email} onChange={set('email')} placeholder="contact@structure.fr" keyboardType="email-address" />
        <Field label="Téléphone" value={form.tel} onChange={set('tel')} placeholder="06 00 00 00 00" keyboardType="phone-pad" />
        <Field label="Site web" value={form.site} onChange={set('site')} placeholder="https://…" keyboardType="url" />
        <Field label="Commentaire" value={form.comment} onChange={set('comment')} placeholder="Précise ton rôle (organisateur terrain / financier)…" multiline />

        <TouchableOpacity style={s.primaryBtn} activeOpacity={0.85} onPress={() => setSent(true)}>
          <Text style={s.primaryTxt}>Envoyer la demande</Text>
        </TouchableOpacity>
        <Text style={s.note}>Prototype — aucune donnée n'est réellement envoyée.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, multiline, keyboardType }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; keyboardType?: any;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        multiline={multiline}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceVariant },
  backTxt: { fontSize: 20, color: Colors.textPrimary },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  ctx: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primaryBorder, borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg },
  ctxTxt: { fontSize: FontSize.sm, color: Colors.primaryDark, fontWeight: FontWeight.semibold },
  field: { marginBottom: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginBottom: 6 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderMedium, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.base, color: Colors.textPrimary },
  inputMulti: { height: 90, textAlignVertical: 'top' },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  primaryTxt: { color: Colors.textInverse, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  note: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: Spacing.sm, textAlign: 'center' },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl, gap: Spacing.md },
  successIcon: { fontSize: 56 },
  successTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  successTxt: { fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
