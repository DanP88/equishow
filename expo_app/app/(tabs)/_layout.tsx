import { Redirect, Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { CustomBottomBar } from '../../components/CustomBottomBar';
import { CustomTopBar } from '../../components/CustomTopBar';
import { V2_ENABLED, V2_FLAGS } from '../../v2/flags';

export default function TabsLayout() {
  // Chantier V2 local : toute entrée dans le groupe V1 (rechargement à froid sur
  // une URL (tabs)/*, ou clic sur un lien "comparer avec la V1") rebondit vers
  // la V2. __DEV__ uniquement → n'affecte jamais TestFlight/prod, ni main.
  if (__DEV__ && V2_ENABLED && V2_FLAGS.navigation) {
    return <Redirect href={'/(v2)/accueil' as any} />;
  }

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
