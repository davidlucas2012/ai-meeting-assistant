import { Text, View } from 'react-native';
import { styles } from './inlineError.styles';

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
