import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { router } from 'expo-router';
import * as RecordingService from '@/services/recordingService';
import * as MeetingService from '@/services/meetingService';
import InlineError from '@/components/InlineError';

type RecordState = 'idle' | 'recording' | 'uploading' | 'processing';

export default function RecordScreen() {
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [duration, setDuration] = useState(0);
  const [savedMessage, setSavedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      // Cleanup recording service on unmount
      RecordingService.cleanup().catch((err) => {
        console.log('Cleanup error (expected if not recording):', err);
      });
    };
  }, []); // Empty dependency array - only run on mount/unmount

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
    setErrorMessage(null);
    setSavedMessage('');

    if (recordState === 'idle') {
      // Start recording
      try {
        await RecordingService.startRecording();
        setRecordState('recording');
        setDuration(0);
        startTimer();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start recording';
        setErrorMessage(message);
        console.error('Failed to start recording:', error);
      }
    } else if (recordState === 'recording') {
      // Stop recording
      try {
        stopTimer();
        const result = await RecordingService.stopRecording();
        setDuration(0);

        console.log('Recording saved:', result);

        // Upload to Supabase
        setRecordState('uploading');
        setSavedMessage('Uploading...');

        const { meetingId } = await MeetingService.createMeetingAndUploadAudio(
          result.uri,
          result.durationMillis
        );

        setRecordState('processing');
        setSavedMessage('Upload complete!');

        // Clear the message after 2 seconds, then navigate
        setTimeout(() => {
          setSavedMessage('');
          setRecordState('idle');
          router.push(`/meeting/${meetingId}`);
        }, 2000);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to stop recording or upload';
        setErrorMessage(message);
        console.error('Failed to stop recording or upload:', error);
        setRecordState('idle');
        setDuration(0);
        setSavedMessage('');
      }
    }
  };

  const isRecording = recordState === 'recording';
  const isUploading = recordState === 'uploading' || recordState === 'processing';
  const isDisabled = isUploading;

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
  recordButtonDisabled: {
    opacity: 0.5,
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadingIndicator: {
    marginRight: 10,
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
