import { StyleSheet, Text, View } from 'react-native';

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'ready':
        return '#4CAF50'; // Green
      case 'processing':
        return '#FF9800'; // Orange
      case 'upload_failed':
      case 'queued_failed':
        return '#FF3B30'; // Red
      case 'uploading':
        return '#2196F3'; // Blue
      case 'recorded':
      default:
        return '#999'; // Gray
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'processing':
        return 'Processing';
      case 'upload_failed':
        return 'Upload Failed';
      case 'queued_failed':
        return 'Processing Failed';
      case 'uploading':
        return 'Uploading';
      case 'recorded':
        return 'Recorded';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const backgroundColor = getStatusColor(status);
  const text = getStatusText(status);

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
