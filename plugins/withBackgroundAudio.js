const {
  createRunOncePlugin,
  withInfoPlist,
  withAndroidManifest,
  AndroidConfig,
} = require('@expo/config-plugins');

/**
 * Config plugin to enable background audio recording on iOS and Android.
 *
 * iOS:
 * - Adds "audio" to UIBackgroundModes
 * - Ensures NSMicrophoneUsageDescription is present
 *
 * Android:
 * - Adds RECORD_AUDIO permission
 * - Adds FOREGROUND_SERVICE and FOREGROUND_SERVICE_MICROPHONE permissions
 * - Configures foreground service type for microphone usage
 *
 * @type {import('@expo/config-plugins').ConfigPlugin}
 */
const withBackgroundAudio = (config) => {
  // Configure iOS
  config = withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;

    // Add background audio mode
    if (!infoPlist.UIBackgroundModes) {
      infoPlist.UIBackgroundModes = [];
    }
    if (!infoPlist.UIBackgroundModes.includes('audio')) {
      infoPlist.UIBackgroundModes.push('audio');
    }

    // Ensure microphone usage description exists
    if (!infoPlist.NSMicrophoneUsageDescription) {
      infoPlist.NSMicrophoneUsageDescription =
        'This app records meeting audio to create transcripts and summaries.';
    }

    return config;
  });

  // Configure Android
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(androidManifest);

    // Add permissions
    AndroidConfig.Permissions.ensurePermissions(androidManifest, [
      'android.permission.RECORD_AUDIO',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE', // Android 14+
    ]);

    // Add foreground service to application
    // This ensures the service element exists with the correct attributes
    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    // Check if our recording service already exists
    const existingService = mainApplication.service.find(
      (service) =>
        service.$?.['android:name'] === '.RecordingForegroundService'
    );

    if (!existingService) {
      mainApplication.service.push({
        $: {
          'android:name': '.RecordingForegroundService',
          'android:foregroundServiceType': 'microphone',
          'android:exported': 'false',
        },
      });
    }

    return config;
  });

  return config;
};

module.exports = createRunOncePlugin(
  withBackgroundAudio,
  'withBackgroundAudio',
  '1.0.0'
);
