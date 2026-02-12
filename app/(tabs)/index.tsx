import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import * as RecordingService from '@/services/recordingService';

export default function RecordScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [savedMessage, setSavedMessage] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (isRecording) {
        RecordingService.cleanup();
      }
    };
  }, [isRecording]);

  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setDuration(elapsed);
    }, 100);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleRecordPress = async () => {
    setSavedMessage('');

    if (!isRecording) {
      // Start recording
      try {
        await RecordingService.startRecording();
        setIsRecording(true);
        setDuration(0);
        startTimer();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
        Alert.alert('Recording Error', errorMessage);
        console.error('Failed to start recording:', error);
      }
    } else {
      // Stop recording
      try {
        stopTimer();
        const result = await RecordingService.stopRecording();
        setIsRecording(false);
        setDuration(0);

        console.log('Recording saved:', result);
        setSavedMessage('Recording saved locally');

        // Clear the message after 3 seconds
        setTimeout(() => {
          setSavedMessage('');
        }, 3000);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to stop recording';
        Alert.alert('Recording Error', errorMessage);
        console.error('Failed to stop recording:', error);
        setIsRecording(false);
        setDuration(0);
      }
    }
  };

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
        ]}
        onPress={handleRecordPress}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.recordButtonInner,
            isRecording && styles.recordButtonInnerActive,
          ]}
        />
      </TouchableOpacity>

      <Text style={styles.instruction}>
        {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
      </Text>

      {savedMessage && (
        <View style={styles.savedMessageContainer}>
          <Text style={styles.savedMessage}>{savedMessage}</Text>
        </View>
      )}

      {!isRecording && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            Your recording will continue even when the app is in the background or the screen is locked.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#333',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 18,
    color: '#FF3B30',
    fontWeight: '600',
  },
  duration: {
    fontSize: 48,
    fontWeight: '300',
    color: '#333',
    marginBottom: 40,
    fontVariant: ['tabular-nums'],
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    marginBottom: 30,
  },
  recordButtonActive: {
    backgroundColor: '#FF6B6B',
  },
  recordButtonInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
  },
  recordButtonInnerActive: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  instruction: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  savedMessageContainer: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  savedMessage: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  infoContainer: {
    marginTop: 40,
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});
