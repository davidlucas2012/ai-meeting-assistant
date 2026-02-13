const BACKGROUND_QUEUE_TASK = 'background-queue-task';

// Lazy load modules to handle cases where they're not available (Expo Go)
let BackgroundFetch: any = null;
let TaskManager: any = null;
let modulesAvailable = false;

/**
 * Initialize background task modules
 * Returns false if modules are not available (e.g., in Expo Go)
 */
async function initializeModules(): Promise<boolean> {
  if (modulesAvailable) return true;

  try {
    BackgroundFetch = await import('expo-background-fetch');
    TaskManager = await import('expo-task-manager');
    modulesAvailable = true;

    // Define the background task
    TaskManager.defineTask(BACKGROUND_QUEUE_TASK, async () => {
      try {
        console.log('[BackgroundTask] Running queue processing...');

        // Import queue service to access resetQueueLock
        const QueueService = await import('./queueService');

        // Reset any stuck locks from suspended foreground execution
        QueueService.resetQueueLock();

        // Run the queue once
        await QueueService.runQueueOnce();

        console.log('[BackgroundTask] Queue processing completed');

        // Return success status
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        console.error('[BackgroundTask] Queue processing failed:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });

    return true;
  } catch (error) {
    console.warn('[BackgroundTask] Modules not available (Expo Go or dev mode):', error);
    return false;
  }
}

/**
 * Register the background fetch task
 * This should be called when the app starts and user is authenticated
 */
export async function registerBackgroundTask(): Promise<void> {
  console.log('[BackgroundTask] Attempting to register...');
  try {
    const available = await initializeModules();
    if (!available) {
      console.log('[BackgroundTask] Not available in current environment');
      return;
    }

    console.log('[BackgroundTask] Modules initialized successfully');
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_QUEUE_TASK);

    if (isRegistered) {
      console.log('[BackgroundTask] Already registered');
      return;
    }

    console.log('[BackgroundTask] Registering with minimumInterval: 15 seconds');
    await BackgroundFetch.registerTaskAsync(BACKGROUND_QUEUE_TASK, {
      minimumInterval: 15, // Reduced to 15 seconds for more aggressive background processing
      stopOnTerminate: false, // Continue after app is closed
      startOnBoot: true, // Start on device boot (Android)
    });

    console.log('[BackgroundTask] Registered successfully');
  } catch (error) {
    console.error('[BackgroundTask] Failed to register:', error);
  }
}

/**
 * Unregister the background fetch task
 * Call this when user logs out
 */
export async function unregisterBackgroundTask(): Promise<void> {
  try {
    const available = await initializeModules();
    if (!available) {
      return;
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_QUEUE_TASK);

    if (!isRegistered) {
      console.log('[BackgroundTask] Not registered, nothing to unregister');
      return;
    }

    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_QUEUE_TASK);
    console.log('[BackgroundTask] Unregistered successfully');
  } catch (error) {
    console.error('[BackgroundTask] Failed to unregister:', error);
  }
}

/**
 * Get the status of the background fetch task
 */
export async function getBackgroundTaskStatus(): Promise<number | null> {
  try {
    const available = await initializeModules();
    if (!available) {
      return null;
    }

    return await BackgroundFetch.getStatusAsync();
  } catch (error) {
    console.error('[BackgroundTask] Failed to get status:', error);
    return null;
  }
}
