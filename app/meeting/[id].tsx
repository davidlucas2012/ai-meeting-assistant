import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams();

  return (
    <>
      <Stack.Screen options={{ title: `Meeting ${id}` }} />
      <View style={styles.container}>
        <Text style={styles.title}>Meeting {id}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transcript</Text>
          <Text style={styles.placeholder}>(Transcript will appear here)</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.placeholder}>(Summary will appear here)</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  placeholder: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
});
