import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';

// Check if running in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';

/**
 * Register for push notifications and return the Expo push token.
 * This function:
 * 1. Checks if running on a physical device
 * 2. Requests notification permissions
 * 3. Creates an Android notification channel
 * 4. Gets the Expo push token
 *
 * Note: Push notifications are not supported in Expo Go. Returns null in Expo Go.
 *
 * @returns The Expo push token string, or null if registration fails
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Skip notifications in Expo Go
  if (isExpoGo) {
    console.log('Push notifications not available in Expo Go');
    return null;
  }

  try {
    // Dynamically import expo-notifications and expo-device (only in dev builds)
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');

    // Push notifications only work on physical devices
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Request notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push notification permissions');
      return null;
    }

    // Configure Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('meeting-ready', {
        name: 'Meeting Ready',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF3B30',
      });
    }

    // Get the Expo push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn('No project ID found. Using default token retrieval.');
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    console.log('Push token registered:', tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Store or update the user's push token in Supabase.
 * Uses an upsert operation to avoid duplicates.
 *
 * @param token - The Expo push token to store
 * @throws Error if user is not authenticated or database operation fails
 */
export async function upsertPushToken(token: string): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      throw new Error('User not authenticated');
    }

    const userId = session.user.id;

    // Check if token already exists for this user
    const { data: existing } = await supabase
      .from('push_tokens')
      .select('id, token')
      .eq('user_id', userId)
      .eq('token', token)
      .maybeSingle();

    if (existing) {
      // Token already exists, update the updated_at timestamp
      const { error: updateError } = await supabase
        .from('push_tokens')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(`Failed to update push token: ${updateError.message}`);
      }

      console.log('Push token updated in database');
    } else {
      // Insert new token
      const { error: insertError } = await supabase
        .from('push_tokens')
        .insert({
          user_id: userId,
          token,
        });

      if (insertError) {
        throw new Error(`Failed to insert push token: ${insertError.message}`);
      }

      console.log('Push token saved to database');
    }
  } catch (error) {
    console.error('Error upserting push token:', error);
    throw error;
  }
}

/**
 * Configure notification handlers for the app.
 * This sets up how notifications are displayed and handled.
 * Call this function once during app initialization.
 *
 * Note: No-op in Expo Go. Requires a development build.
 */
export async function configureNotificationHandlers(): Promise<void> {
  if (isExpoGo) {
    console.log('Notification handlers not configured (not available in Expo Go)');
    return;
  }

  try {
    const Notifications = await import('expo-notifications');

    // Set the handler for incoming notifications
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    console.warn('Failed to configure notification handlers:', error);
  }
}

/**
 * Get the most recent push token for the current user.
 *
 * @returns The most recent push token, or null if none found
 */
export async function getCurrentPushToken(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return null;
    }

    const { data, error } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', session.user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching push token:', error);
      return null;
    }

    return data?.token ?? null;
  } catch (error) {
    console.error('Error getting current push token:', error);
    return null;
  }
}
