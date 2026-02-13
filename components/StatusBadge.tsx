import { Text, View } from 'react-native';
import { useStatusBadge } from './useStatusBadge';
import { styles } from './statusBadge.styles';

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { backgroundColor, text } = useStatusBadge(status);

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}
