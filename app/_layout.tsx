import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, router, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import { useEffect, useState, useRef } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  configureNotificationHandlers,
  registerForPushNotifications,
  upsertPushToken,
} from '@/services/notificationsService';
import * as QueueService from '@/services/queueService';

// Check if running in Expo Go
const isExpoGo = Constants.executionEnvironment === 'storeClient';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  // Configure notification handlers once on mount
  useEffect(() => {
    configureNotificationHandlers();
  }, []);

  // Handle notification responses (when user taps a notification)
  useEffect(() => {
    // Skip notification listeners in Expo Go
    if (isExpoGo) {
      return;
    }

    // Setup notification response listener only in dev builds
    (async () => {
      try {
        const Notifications = await import('expo-notifications');

        // This listener is called when the app is foregrounded or backgrounded
        // and the user taps on a notification
        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data;
          const meetingId = data?.meetingId as string | undefined;

          if (meetingId) {
            console.log('Notification tapped, navigating to meeting:', meetingId);
            // Use router.push to navigate to the meeting detail screen
            router.push(`/meeting/${meetingId}`);
          }
        });
      } catch (error) {
        console.warn('Failed to setup notification listeners:', error);
      }
    })();

    return () => {
      if (responseListener.current) {
        (async () => {
          try {
            const Notifications = await import('expo-notifications');
            Notifications.removeNotificationSubscription(responseListener.current);
          } catch (error) {
            // Ignore cleanup errors
          }
        })();
      }
    };
  }, []);

  // Auth state management
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Register for push notifications when session is available
  useEffect(() => {
    if (session?.user && !loading) {
      // Register for push notifications
      registerForPushNotifications()
        .then((token) => {
          if (token) {
            return upsertPushToken(token);
          }
        })
        .catch((error) => {
          console.error('Failed to register push notifications:', error);
        });
    }
  }, [session, loading]);

  // Start queue loop when session is available
  useEffect(() => {
    if (session?.user && !loading) {
      console.log('Starting queue loop...');
      QueueService.cleanupOldJobs().catch(console.error);
      QueueService.startQueueLoop();

      return () => {
        console.log('Stopping queue loop...');
        QueueService.stopQueueLoop();
      };
    }
  }, [session, loading]);

  // Resume queue when app comes to foreground
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        if (session?.user) {
          console.log('App foregrounded, triggering queue...');
          QueueService.runQueueOnce().catch(console.error);
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [session]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!session && !inAuthGroup) {
      // Redirect to auth if not authenticated
      router.replace('/auth');
    } else if (session && inAuthGroup) {
      // Redirect to app if authenticated and on auth screen
      router.replace('/(tabs)');
    }
  }, [session, segments, loading]);

  if (loading) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="meeting/[id]" options={{ presentation: 'card' }} />
      </Stack>
    </ThemeProvider>
  );
}
