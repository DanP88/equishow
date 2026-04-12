import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { CustomBottomBar } from '../../components/CustomBottomBar';
import { CustomTopBar } from '../../components/CustomTopBar';

export default function TabsLayout() {
  return (
    <View style={styles.container}>
      <CustomTopBar />
      <Stack screenOptions={{ headerShown: false }} />
      <CustomBottomBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
