import { Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import InlineError from '@/components/InlineError';
import { useIndex } from './useIndex';
import { styles } from './index.styles';

export default function RecordScreen() {
  const {
    duration,
    savedMessage,
    errorMessage,
    isRecording,
    isUploading,
    isDisabled,
    formatDuration,
    handleRecordPress,
  } = useIndex();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Record Meeting</Text>

      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Recording...</Text>
        </View>
      )}

      {isRecording && (
        <Text style={styles.duration}>{formatDuration(duration)}</Text>
      )}

      <TouchableOpacity
        style={[
          styles.recordButton,
          isRecording && styles.recordButtonActive,
          isDisabled && styles.recordButtonDisabled,
        ]}
        onPress={handleRecordPress}
        activeOpacity={0.8}
        disabled={isDisabled}
      >
        <View
          style={[
            styles.recordButtonInner,
            isRecording && styles.recordButtonInnerActive,
          ]}
        />
      </TouchableOpacity>

      <Text style={styles.instruction}>
        {isUploading
          ? 'Uploading...'
          : isRecording
          ? 'Tap to stop recording'
          : 'Tap to start recording'}
      </Text>

      {savedMessage && (
        <View style={styles.savedMessageContainer}>
          {isUploading && <ActivityIndicator color="#fff" style={styles.uploadingIndicator} />}
          <Text style={styles.savedMessage}>{savedMessage}</Text>
        </View>
      )}

      <InlineError message={errorMessage} />

      {!isRecording && !isUploading && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Your recording will continue even when the app is in the background or the screen is locked.
          </Text>
        </View>
      )}
    </View>
  );
}

