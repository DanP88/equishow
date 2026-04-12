import { View, Text } from 'react-native';

export default function ReserverTransport() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: '600', marginBottom: 12 }}>
        Réservation transport
      </Text>
      <Text style={{ textAlign: 'center' }}>
        Paiement temporairement désactivé pour remettre la version web en route.
      </Text>
    </View>
  );
}
