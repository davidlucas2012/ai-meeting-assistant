import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Check if running in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';

let Notifications: any = null;
let notificationsAvailable = false;

/**
 * Initialize notifications module
 */
async function initializeNotifications(): Promise<boolean> {
  if (notificationsAvailable) return true;

  try {
    Notifications = await import('expo-notifications');
    notificationsAvailable = true;
    return true;
  } catch (error) {
    console.warn('[UploadNotification] Notifications not available:', error);
    return false;
  }
}

const UPLOAD_NOTIFICATION_ID = 'upload-processing';

/**
 * Show a persistent notification while uploading/processing
 * This keeps the app alive in the background on Android
 */
export async function showUploadNotification(meetingId: string): Promise<void> {
  if (Platform.OS !== 'android') {
    // iOS doesn't support foreground service notifications the same way
    return;
  }

  const available = await initializeNotifications();
  if (!available) {
    console.log('[UploadNotification] Not available, skipping');
    return;
  }

  try {
    await Notifications.setNotificationChannelAsync('upload', {
      name: 'Upload Progress',
      importance: Notifications.AndroidImportance.LOW,
      sound: null,
      vibrationPattern: null,
      enableVibrate: false,
    });

    await Notifications.scheduleNotificationAsync({
      identifier: UPLOAD_NOTIFICATION_ID,
      content: {
        title: 'Processing meeting',
        body: 'Uploading and processing your recording...',
        priority: Notifications.AndroidNotificationPriority.LOW,
        sticky: true, // Can't be dismissed by user
        autoDismiss: false,
        data: { meetingId },
      },
      trigger: null, // Show immediately
    });

    console.log('[UploadNotification] Notification shown');
  } catch (error) {
    console.error('[UploadNotification] Failed to show notification:', error);
  }
}

/**
 * Update the upload notification with progress
 */
export async function updateUploadNotification(status: string): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  const available = await initializeNotifications();
  if (!available) return;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: UPLOAD_NOTIFICATION_ID,
      content: {
        title: 'Processing meeting',
        body: status,
        priority: Notifications.AndroidNotificationPriority.LOW,
        sticky: true,
        autoDismiss: false,
      },
      trigger: null,
    });
  } catch (error) {
    console.error('[UploadNotification] Failed to update notification:', error);
  }
}

/**
 * Dismiss the upload notification
 */
export async function dismissUploadNotification(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  const available = await initializeNotifications();
  if (!available) return;

  try {
    await Notifications.dismissNotificationAsync(UPLOAD_NOTIFICATION_ID);
    console.log('[UploadNotification] Notification dismissed');
  } catch (error) {
    console.error('[UploadNotification] Failed to dismiss notification:', error);
  }
}
