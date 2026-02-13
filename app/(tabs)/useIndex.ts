import { useState, useRef, useEffect } from 'react';
import { router } from 'expo-router';
import * as RecordingService from '@/services/recordingService';
import * as MeetingService from '@/services/meetingService';

type RecordState = 'idle' | 'recording' | 'uploading' | 'processing';

export function useIndex() {
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

        // Enqueue upload (returns immediately)
        setRecordState('uploading');
        setSavedMessage('Queued for upload...');

        const { meetingId } = await MeetingService.submitRecording(
          result.uri,
          result.durationMillis
        );

        setSavedMessage('Processing - safe to minimize!');

        // Navigate after brief delay to show message
        setTimeout(() => {
          setSavedMessage('');
          setRecordState('idle');
          router.push(`/meeting/${meetingId}`);
        }, 1500);
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

  return {
    recordState,
    duration,
    savedMessage,
    errorMessage,
    isRecording,
    isUploading,
    isDisabled,
    formatDuration,
    handleRecordPress,
  };
}
