import { Link, Stack } from 'expo-router';
import { StyleSheet, View, Text } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>this screen doesn't exist.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.link_text}>go home</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#0a0a0a',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  link_text: {
    fontSize: 14,
    color: '#818cf8',
  },
});
