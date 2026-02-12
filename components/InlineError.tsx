import { StyleSheet, Text, View } from 'react-native';

interface InlineErrorProps {
  message: string | null;
}

export default function InlineError({ message }: InlineErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
    marginTop: 15,
  },
  errorText: {
    fontSize: 14,
    color: '#C62828',
    lineHeight: 20,
  },
});
