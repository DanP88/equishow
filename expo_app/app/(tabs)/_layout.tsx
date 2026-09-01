import { Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { CustomBottomBar } from '../../components/CustomBottomBar';
import { CustomTopBar } from '../../components/CustomTopBar';

export default function TabsLayout() {
  return (
    <View style={styles.container}>
      <CustomTopBar />
      {/*
        Les onglets se comportent comme une bottom-bar native : la CustomBottomBar
        fait `router.push` d'un onglet à l'autre. Avec l'animation de pile par
        défaut (slide horizontal), on voyait pendant la transition l'écran
        précédent glisser vers la gauche + un décalage de layout. `animation:
        'none'` = bascule immédiate, rendu type application native, pas de
        "page à gauche" ni de flash de contenu décalé.
      */}
      <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
      <CustomBottomBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
