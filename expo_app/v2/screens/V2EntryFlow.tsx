// ─────────────────────────────────────────────────────────────────────────────
// V2EntryFlow — PARCOURS D'ENTRÉE V2 (prototype F1, complément « nouvel
// utilisateur »).
//
//   Bienvenue ──► Se connecter ─────────────────────────► session simulée
//            └──► Créer un compte ──► identifiants ──► activités (multi) ──►
//                 infos complémentaires adaptatives ──► compte créé + connecté
//                 (TOUT en local, AUCUN Supabase Auth, AUCUN email réel)
//
// UX : aucune information n'est demandée deux fois. Prénom / nom / email /
// téléphone sont saisis à l'étape « Créer un compte » ; l'onboarding qui suit
// reçoit ces valeurs via `known` et masque les étapes correspondantes.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, TextInput,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, Shadow } from '../../constants/theme';
import { useV2Session } from '../auth';
import { OnboardingV2 } from './OnboardingV2';

type Phase = 'welcome' | 'login' | 'signupCreds' | 'signupActivities' | 'done';

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export function V2EntryFlow({ onExit }: { onExit?: () => void }) {
  const session = useV2Session();
  const [phase, setPhase] = useState<Phase>('welcome');

  // champs « Créer un compte »
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [tel, setTel] = useState('');
  const [err, setErr] = useState<string | null>(null);

  // champs « Se connecter »
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPwd, setLoginPwd] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const doSignupCreds = () => {
    setErr(null);
    if (!prenom.trim() || !nom.trim()) return setErr('Prénom et nom obligatoires.');
    if (!emailOk(email)) return setErr('Email invalide.');
    if (pwd.length < 6) return setErr('Mot de passe : 6 caractères minimum.');
    if (pwd !== pwd2) return setErr('Les mots de passe ne correspondent pas.');
    session.signUp({ prenom, nom, email, telephone: tel });
    setPhase('signupActivities');
  };

  const doLogin = () => {
    setErr(null);
    if (!emailOk(loginEmail)) return setErr('Email invalide.');
    if (!loginPwd) return setErr('Mot de passe requis.');
    session.logIn(loginEmail);
    setPhase('done');
  };

  // ── PHASE : activités + infos complémentaires (délègue à OnboardingV2) ─────
  if (phase === 'signupActivities') {
    return (
      <OnboardingV2
        kicker="Créer un compte · vos activités"
        known={{ prenom, nom, telephone: tel, email }}
        onDone={() => setPhase('done')}
      />
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.kicker}>EquiShow V2 · parcours d’entrée · prototype</Text>
        <Text style={s.title}>
          {phase === 'welcome' ? 'Bienvenue' :
           phase === 'login' ? 'Se connecter' :
           phase === 'signupCreds' ? 'Créer un compte' : 'Vous y êtes'}
        </Text>
        <View style={s.simTag}><Text style={s.simTagTxt}>SIMULÉ — aucun compte Supabase, aucun email réel</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {/* WELCOME ------------------------------------------------------- */}
        {phase === 'welcome' && (
          <>
            <Text style={s.lead}>Le compagnon de votre concours — transport, box, coach, infos.</Text>
            <TouchableOpacity style={s.btn} onPress={() => { setErr(null); setPhase('signupCreds'); }} activeOpacity={0.85}>
              <Text style={s.btnTxt}>Créer un compte</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnGhost} onPress={() => { setErr(null); setPhase('login'); }} activeOpacity={0.85}>
              <Text style={s.btnGhostTxt}>Se connecter</Text>
            </TouchableOpacity>
            {session.kind !== 'none' && (
              <View style={s.note}>
                <Text style={s.noteTxt}>
                  Session actuelle : <Text style={s.b}>{session.kind === 'real' ? 'compte réel connecté' : 'compte simulé'}</Text>
                  {session.identity?.email ? ` (${session.identity.email})` : ''}.
                </Text>
              </View>
            )}
          </>
        )}

        {/* LOGIN -------------------------------------------------------- */}
        {phase === 'login' && (
          <>
            <Field label="Email">
              <TextInput style={s.input} value={loginEmail} onChangeText={setLoginEmail} autoCapitalize="none" keyboardType="email-address" placeholder="vous@exemple.fr" placeholderTextColor={Colors.textTertiary} />
            </Field>
            <Field label="Mot de passe">
              <TextInput style={s.input} value={loginPwd} onChangeText={setLoginPwd} secureTextEntry placeholder="••••••••" placeholderTextColor={Colors.textTertiary} />
            </Field>
            <TouchableOpacity onPress={() => setForgotSent(true)}>
              <Text style={s.forgot}>Mot de passe oublié ?</Text>
            </TouchableOpacity>
            {forgotSent && (
              <View style={s.note}><Text style={s.noteTxt}>ⓘ Un email de réinitialisation a été envoyé à « {loginEmail || 'votre adresse'} » (simulé — aucun envoi réel).</Text></View>
            )}
            {err && <Text style={s.err}>{err}</Text>}
            <TouchableOpacity style={s.btn} onPress={doLogin} activeOpacity={0.85}>
              <Text style={s.btnTxt}>Se connecter (simulé)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.link} onPress={() => setPhase('welcome')}><Text style={s.linkTxt}>← Retour</Text></TouchableOpacity>
          </>
        )}

        {/* SIGNUP — IDENTIFIANTS -------------------------------------- */}
        {phase === 'signupCreds' && (
          <>
            <Text style={s.sub}>Ces informations ne seront pas redemandées ensuite.</Text>
            <View style={s.rowFields}>
              <Field label="Prénom" flex><TextInput style={s.input} value={prenom} onChangeText={setPrenom} placeholder="Prénom" placeholderTextColor={Colors.textTertiary} /></Field>
              <Field label="Nom" flex><TextInput style={s.input} value={nom} onChangeText={setNom} placeholder="Nom" placeholderTextColor={Colors.textTertiary} /></Field>
            </View>
            <Field label="Email"><TextInput style={s.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="vous@exemple.fr" placeholderTextColor={Colors.textTertiary} /></Field>
            <Field label="Téléphone (facultatif)"><TextInput style={s.input} value={tel} onChangeText={setTel} keyboardType="phone-pad" placeholder="06 …" placeholderTextColor={Colors.textTertiary} /></Field>
            <Field label="Mot de passe"><TextInput style={s.input} value={pwd} onChangeText={setPwd} secureTextEntry placeholder="6 caractères min." placeholderTextColor={Colors.textTertiary} /></Field>
            <Field label="Confirmer le mot de passe"><TextInput style={s.input} value={pwd2} onChangeText={setPwd2} secureTextEntry placeholder="••••••••" placeholderTextColor={Colors.textTertiary} /></Field>
            {err && <Text style={s.err}>{err}</Text>}
            <TouchableOpacity style={s.btn} onPress={doSignupCreds} activeOpacity={0.85}>
              <Text style={s.btnTxt}>Continuer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.link} onPress={() => setPhase('welcome')}><Text style={s.linkTxt}>← Retour</Text></TouchableOpacity>
          </>
        )}

        {/* DONE ------------------------------------------------------- */}
        {phase === 'done' && (
          <>
            <View style={[s.note, { borderColor: Colors.success, backgroundColor: Colors.successBg }]}>
              <Text style={[s.noteTxt, { color: Colors.success }]}>
                ✓ {session.simAccount?.createdVia === 'signup' ? 'Compte créé' : 'Connecté'} et session ouverte — <Text style={s.b}>simulé, local uniquement</Text>.
              </Text>
            </View>
            <RecapRow label="Type de session" value={session.kind} />
            <RecapRow label="Nom" value={`${session.identity?.prenom ?? ''} ${session.identity?.nom ?? ''}`.trim() || '—'} />
            <RecapRow label="Email" value={session.identity?.email ?? '—'} />
            {session.identity?.telephone ? <RecapRow label="Téléphone" value={session.identity.telephone} /> : null}
            <TouchableOpacity style={s.btn} onPress={() => onExit?.()} activeOpacity={0.85}>
              <Text style={s.btnTxt}>Terminer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.link} onPress={() => { session.signOut(); setPhase('welcome'); }}>
              <Text style={s.linkTxt}>Se déconnecter (simulé) & recommencer</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children, flex }: { label: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <View style={[s.field, flex && { flex: 1 }]}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}
function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.recapRow}>
      <Text style={s.recapLabel}>{label}</Text>
      <Text style={s.recapValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { padding: Spacing.lg, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm },
  kicker: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, color: Colors.textPrimary },
  simTag: { alignSelf: 'flex-start', backgroundColor: Colors.warningBg, borderColor: Colors.warningBorder, borderWidth: 1, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  simTagTxt: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: FontWeight.semibold },
  body: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 48 },
  lead: { fontSize: FontSize.lg, color: Colors.textSecondary, lineHeight: 22 },
  sub: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  rowFields: { flexDirection: 'row', gap: Spacing.md },
  field: { gap: Spacing.xs },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 4, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surface },
  forgot: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold, alignSelf: 'flex-start' },
  err: { fontSize: FontSize.sm, color: Colors.urgent, fontWeight: FontWeight.semibold },
  note: { backgroundColor: Colors.primaryLight, borderWidth: 1, borderColor: Colors.primaryBorder, borderRadius: Radius.md, padding: Spacing.md },
  noteTxt: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 19 },
  b: { fontWeight: FontWeight.bold, color: Colors.textPrimary },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: Spacing.md + 2, alignItems: 'center', marginTop: Spacing.xs },
  btnTxt: { color: Colors.textInverse, fontWeight: FontWeight.extrabold, fontSize: FontSize.base },
  btnGhost: { borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.md + 2, alignItems: 'center' },
  btnGhostTxt: { color: Colors.textSecondary, fontWeight: FontWeight.bold, fontSize: FontSize.base },
  link: { paddingVertical: Spacing.sm, alignItems: 'center' },
  linkTxt: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.bold },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  recapLabel: { fontSize: FontSize.sm, color: Colors.textTertiary, fontWeight: FontWeight.semibold },
  recapValue: { fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: FontWeight.semibold, flexShrink: 1, textAlign: 'right' },
});
