# Config Plugin Verification

This document verifies that the `withBackgroundAudio` config plugin is working correctly.

## Plugin File Location
`plugins/withBackgroundAudio.js`

## Verification Commands

### 1. Check if plugin is registered
```bash
npx expo config --type introspect | grep -A 3 "plugins:"
```

Expected output:
```
plugins: [
  'expo-router',
  './plugins/withBackgroundAudio.js'
],
```

### 2. Verify iOS Configuration
```bash
npx expo config --type introspect | grep -A 2 "UIBackgroundModes:"
npx expo config --type introspect | grep "NSMicrophoneUsageDescription"
```

Expected output:
- `UIBackgroundModes: [ 'audio' ]`
- `NSMicrophoneUsageDescription: 'This app records meeting audio to create transcripts and summaries.'`

### 3. Verify Android Configuration
```bash
npx expo config --type introspect | grep "RECORD_AUDIO"
npx expo config --type introspect | grep "FOREGROUND_SERVICE"
npx expo config --type introspect | grep "RecordingForegroundService"
```

Expected output:
- `'android:name': 'android.permission.RECORD_AUDIO'`
- `'android:name': 'android.permission.FOREGROUND_SERVICE'`
- `'android:name': 'android.permission.FOREGROUND_SERVICE_MICROPHONE'`
- `'android:name': '.RecordingForegroundService'`
- `'android:foregroundServiceType': 'microphone'`

## Apply Native Changes

To apply these configurations to native projects, run:
```bash
npx expo prebuild --clean
```

This will regenerate the native iOS and Android directories with all plugin configurations applied.

## Status: ✅ VERIFIED

All configurations have been verified as of the initial commit.
