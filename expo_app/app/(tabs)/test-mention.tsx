import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import { notificationsStore } from '../../data/notificationsStore';
import { userStore } from '../../data/store';
import { useState } from 'react';

export default function TestMentionScreen() {
  const [mentionText, setMentionText] = useState('');

  function sendMentionNotification() {
    if (!mentionText.trim()) {
      Alert.alert('Erreur', 'Veuillez écrire un message');
      return;
    }

    notificationsStore.addNotification({
      type: 'mention',
      title: `🏇 ${userStore.prenom} ${userStore.nom} vous a tagué`,
      message: mentionText,
      author: `${userStore.prenom} ${userStore.nom}`,
      authorRole: userStore.role === 'cavalier' ? 'Cavalier' : userStore.role,
    });

    Alert.alert('✅ Notification envoyée!', `La notification a été envoyée au coach`);
    setMentionText('');
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🧪 Tester le tagging</Text>
        <Text style={styles.headerSubtitle}>Envoyer une notification au coach</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.label}>👤 Vous êtes connecté en tant que:</Text>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{userStore.prenom} {userStore.nom}</Text>
            <Text style={styles.userRole}>{userStore.role === 'cavalier' ? '🏇 Cavalier' : '🎓 Coach'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>💬 Message à envoyer au coach:</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: @Émilie Laurent, j'aimerais vos conseils pour ma progression..."
            placeholderTextColor={Colors.textTertiary}
            value={mentionText}
            onChangeText={setMentionText}
            multiline
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity style={styles.sendButton} onPress={sendMentionNotification} activeOpacity={0.8}>
          <Text style={styles.sendButtonText}>📤 Envoyer la mention</Text>
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>ℹ️ Comment ça marche</Text>
          <Text style={styles.infoText}>
            1. Tapez votre message avec le nom d'un coach{'\n'}
            2. Cliquez sur "Envoyer la mention"{'\n'}
            3. Connectez-vous au compte Coach{'\n'}
            4. Allez dans l'onglet Notifications 🔔{'\n'}
            5. Vous verrez la notification de tagging!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  headerSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  container: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.sm },
  userInfo: {
    backgroundColor: Colors.primaryLight + '20',
    borderRadius: 8,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  userName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  userRole: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: FontWeight.semibold },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
    fontSize: FontSize.sm,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  sendButtonText: { color: '#FFF', fontWeight: FontWeight.bold, fontSize: FontSize.base },
  infoCard: {
    backgroundColor: Colors.goldBg,
    borderRadius: 8,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  infoTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.gold, marginBottom: Spacing.sm },
  infoText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
});
