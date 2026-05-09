import { View, Text, StyleSheet } from 'react-native';
import { EXPIRATION_DATE } from '../config/testExpiration';

export function ExpiredAccessScreen() {
  const dateStr = EXPIRATION_DATE.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>🔒</Text>
        </View>
        <Text style={styles.title}>Accès expiré</Text>
        <Text style={styles.message}>
          Cette version de test n'est plus disponible.
        </Text>
        <Text style={styles.sub}>
          La période de test s'est terminée le {dateStr}.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A0F0A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    maxWidth: 360,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#444',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  sub: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
});
