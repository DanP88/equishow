import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight, CommonStyles } from '../../constants/theme';
import { supabase, User } from '../../lib/supabase';
import { AvisSection } from '../../components/AvisSection';

export default function ViewCoachScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [coach, setCoach] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      try {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', id)
          .single();
        setCoach(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [id]);

  if (isLoading) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!coach) {
    return (
      <SafeAreaView style={s.root}>
        <View style={s.center}>
          <Text>Coach non trouvé</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: Colors.primary, marginTop: 16 }}>← Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.container}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: Colors.primary, fontSize: 16, fontWeight: '600' }}>← Retour</Text>
        </TouchableOpacity>

        <View style={s.header}>
          <View style={s.avatar}>
            <Text style={{ fontSize: 40 }}>🎓</Text>
          </View>
          <Text style={s.name}>{coach.prenom} {coach.nom}</Text>
          <Text style={s.pseudo}>@{coach.pseudo}</Text>
        </View>

        <View style={s.statsBox}>
          <StatItem value="5" label="Élèves en coaching" icon="🐴" />
          <StatItem value="12" label="Élèves passé" icon="✓" />
          <StatItem value="48" label="Séances" icon="📅" />
        </View>

        {id && <AvisSection userId={id} />}

        <View style={s.infoSection}>
          <Text style={s.infoTitle}>Infos</Text>
          <View style={s.infoContent}>
            <Text style={{ color: Colors.textSecondary }}>Région: <Text style={{ fontWeight: 'bold', color: Colors.textPrimary }}>{coach.region || 'N/A'}</Text></Text>
            <Text style={{ color: Colors.textSecondary, marginTop: 8 }}>Tarif: <Text style={{ fontWeight: 'bold', color: Colors.textPrimary }}>65€/h HT</Text></Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({ value, label, icon }: { value: string; label: string; icon: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 4 }}>{icon}</Text>
      <Text style={{ fontSize: 18, fontWeight: 'bold', color: Colors.primary }}>{value}</Text>
      <Text style={{ fontSize: 11, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  container: { padding: 16, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { alignItems: 'center', marginVertical: 20, gap: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 24, fontWeight: 'bold', color: Colors.textPrimary },
  pseudo: { fontSize: 14, color: Colors.primary },

  statsBox: { flexDirection: 'row', gap: 12, marginBottom: 20, backgroundColor: Colors.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },

  infoSection: { backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  infoTitle: { padding: 16, fontSize: 12, fontWeight: 'bold', color: Colors.textTertiary, textTransform: 'uppercase' },
  infoContent: { paddingHorizontal: 16, paddingBottom: 16 },
});
