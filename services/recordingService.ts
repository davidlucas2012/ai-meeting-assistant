import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export interface RecordingStatus {
  isRecording: boolean;
  durationMillis: number;
  canRecord: boolean;
}

export interface RecordingResult {
  uri: string;
  durationMillis: number;
}

let recording: Audio.Recording | null = null;

/**
 * Request microphone permissions from the user.
 * @returns true if permission was granted, false otherwise
 */
export async function requestPermissions(): Promise<boolean> {
  try {
    const { status } = await Audio.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting microphone permissions:', error);
    return false;
  }
}

/**
 * Configure audio mode for recording with background support.
 * This must be called before starting a recording.
 */
async function configureAudioMode(): Promise<void> {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    staysActiveInBackground: true,
    playsInSilentModeIOS: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
  });
}

/**
 * Start recording audio.
 * Requests permissions if not already granted.
 * Configures audio mode for background recording.
 * @throws Error if permissions are denied or recording fails to start
 */
export async function startRecording(): Promise<void> {
  try {
    // Check if already recording
    if (recording) {
      console.warn('Recording already in progress');
      return;
    }

    // Request permissions
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      throw new Error('Microphone permission denied');
    }

    // Configure audio mode for recording
    await configureAudioMode();

    // Create recording instance
    const { recording: newRecording } = await Audio.Recording.createAsync(
      {
        isMeteringEnabled: true,
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      },
      // onRecordingStatusUpdate callback
      (status) => {
        // This callback could be used for live updates in the future
        // For now, we'll poll status when needed
      }
    );

    recording = newRecording;

    // NOTE: On Android, a foreground service notification should be shown here
    // to prevent the OS from killing the recording in the background.
    // This will be implemented in a future commit with expo-notifications.

    console.log('Recording started successfully');
  } catch (error) {
    recording = null;
    console.error('Failed to start recording:', error);
    throw error;
  }
}

/**
 * Stop the current recording and return the file URI and duration.
 * @returns Object containing the recording URI and duration in milliseconds
 * @throws Error if no recording is in progress or stopping fails
 */
export async function stopRecording(): Promise<RecordingResult> {
  try {
    if (!recording) {
      throw new Error('No recording in progress');
    }

    // Get status before stopping to capture duration
    const status = await recording.getStatusAsync();
    const durationMillis = status.durationMillis || 0;

    // Stop and unload the recording
    await recording.stopAndUnloadAsync();

    // Reset audio mode to allow playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
    });

    // Get the recording URI
    const uri = recording.getURI();
    if (!uri) {
      throw new Error('Recording URI is null');
    }

    // Clear the recording instance
    recording = null;

    // NOTE: Foreground service notification should be dismissed here on Android

    console.log('Recording stopped successfully:', { uri, durationMillis });

    return { uri, durationMillis };
  } catch (error) {
    recording = null;
    console.error('Failed to stop recording:', error);
    throw error;
  }
}

/**
 * Get the current status of the recording.
 * @returns RecordingStatus object with current recording state
 */
export async function getRecordingStatus(): Promise<RecordingStatus> {
  if (!recording) {
    return {
      isRecording: false,
      durationMillis: 0,
      canRecord: false,
    };
  }

  try {
    const status = await recording.getStatusAsync();
    return {
      isRecording: status.isRecording,
      durationMillis: status.durationMillis || 0,
      canRecord: status.canRecord,
    };
  } catch (error) {
    console.error('Failed to get recording status:', error);
    return {
      isRecording: false,
      durationMillis: 0,
      canRecord: false,
    };
  }
}

/**
 * Check if there is an active recording.
 * @returns true if recording is in progress, false otherwise
 */
export function isRecording(): boolean {
  return recording !== null;
}

/**
 * Cleanup function to ensure recording is properly stopped.
 * Should be called when the app is backgrounded or unmounted.
 */
export async function cleanup(): Promise<void> {
  if (recording) {
    try {
      await recording.stopAndUnloadAsync();
      recording = null;
    } catch (error) {
      console.error('Error during recording cleanup:', error);
    }
  }
}
