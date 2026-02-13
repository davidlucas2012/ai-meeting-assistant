# Troubleshooting Guide

This guide covers common issues and their solutions.

## Realtime Updates Not Working

### Symptoms

- After stopping a recording, the meeting detail page doesn't update automatically (stuck in "Processing..." state)
- New meetings don't appear in the meetings list without manual refresh
- Meeting status changes (uploading → processing → ready) don't reflect in the UI

### Root Cause

Supabase Realtime is not enabled for the `meetings` table. The app uses Realtime subscriptions to instantly update the UI when meetings change, eliminating the need for polling or manual refreshes.

### Solution

Enable Realtime for the `meetings` table in Supabase:

#### Option 1: Via SQL Editor (Recommended)

Run this in the Supabase SQL Editor:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
```

#### Option 2: Via Supabase Dashboard

1. Go to **Database** → **Replication** in Supabase Dashboard
2. Find the `meetings` table in the list
3. Toggle the switch to **enable** replication for `meetings`
4. Click **Save**

### Verification

After enabling Realtime, you should see console logs in the mobile app:

```
Realtime subscription active for meetings list (INSERT + UPDATE)
Realtime subscription active
```

When a meeting updates, you'll see:
```
Realtime UPDATE received for meetings list: {...}
```

### What Gets Updated in Realtime

- **Meetings List**:
  - New recordings appear instantly (INSERT events)
  - Status changes reflect immediately (UPDATE events)

- **Meeting Detail Page**:
  - Status transitions (uploading → processing → ready)
  - Transcript and summary appear when processing completes
  - Diarization results update automatically

## Push Notifications

### Android Push Troubleshooting (FIS_AUTH_ERROR)

If you encounter `FIS_AUTH_ERROR` when generating push tokens on Android, this indicates a Firebase Installation Service authentication failure.

#### Root Cause

The native Android build wasn't processing `google-services.json` properly, preventing Firebase from authenticating. This requires two critical configurations:

1. **Google Services Gradle Plugin** - Processes `google-services.json` during build
2. **SHA Certificate Fingerprints** - Firebase validates the app's signing certificate

#### Configuration Applied

**1. Google Services Gradle Plugin** (already configured in this project):

```gradle
// android/build.gradle
dependencies {
  classpath 'com.google.gms:google-services:4.4.1'
  // ... other dependencies
}

// android/app/build.gradle (at bottom of file)
apply plugin: 'com.google.gms.google-services'
```

**2. SHA Certificate Fingerprints** (configured in Firebase Console):

For EAS development builds, the SHA fingerprints are:
- **SHA-1:** `9c:b5:ab:b4:96:06:15:c1:dd:5b:ba:93:ea:cf:18:47:da:ad:e9:b7`
- **SHA-256:** `2b:97:69:f0:75:07:3c:e2:3e:21:ee:4d:90:4a:93:6d:c3:f5:1a:26:74:16:aa:fd:f6:55:26:46:cd:0e:ab:ef`

These must be added to Firebase Console → Project Settings → Your apps → ai-meeting-assistant → SHA certificate fingerprints.

#### How to Get SHA Fingerprints from EAS

```bash
# View your EAS keystore credentials
npx eas-cli credentials --platform android

# Or visit EAS dashboard
https://expo.dev/accounts/[your-account]/projects/ai-meeting-assistant/credentials/android
```

#### Important Notes

- **Firebase Propagation:** After adding SHA fingerprints, Firebase can take **1-2 hours** to propagate changes globally
- **Committed android/ folder:** This project includes the `android/` folder in version control (not typically recommended) to ensure the Google Services plugin configuration persists through EAS builds
- **Production Approach:** In production, use Expo config plugins to apply Google Services configuration during prebuild, avoiding the need to commit native folders

#### Verification Steps

1. Confirm `google-services.json` is in `android/app/` directory
2. Verify SHA fingerprints match your EAS keystore in Firebase Console
3. Check for Firebase installation files on device:
   ```bash
   adb shell "run-as com.anonymous.aimeetingtemp ls -la files" | grep PersistedInstallation
   ```
4. If file exists, Firebase IS configured; issue is likely SHA fingerprint propagation delay

#### If Issue Persists

- Wait 1-2 hours for Firebase propagation
- Try removing and re-adding SHA fingerprints in Firebase Console
- Verify package name matches exactly: `com.anonymous.aimeetingtemp`
- Ensure Firebase APIs are enabled (Firebase Installations API, FCM)

### Notification Channel (Android)

The app creates a notification channel with these settings:
- **Channel ID**: `meeting-ready`
- **Name**: "Meeting Ready"
- **Importance**: MAX (makes sound and appears on-screen)
- **Vibration**: Pattern [0, 250, 250, 250]

Users can customize notification behavior in Android Settings > Apps > AI Meeting Assistant > Notifications.

### Push Notifications Not Received

**Check:**
1. Push notifications only work on physical devices (not simulators/emulators)
2. Must use a development build (not Expo Go)
3. FCM credentials must be configured (see SETUP.md)
4. Backend must be running and accessible
5. Notification permissions must be granted
6. Check backend logs for "Push notification sent"
7. Verify push token is stored in Supabase (`push_tokens` table)
8. Ensure `EXPO_PUBLIC_BACKEND_URL` points to accessible IP (not `localhost` for physical devices)
9. Check app foreground/background notification settings

## Upload Queue Issues

### Failed Uploads

The app displays specific error messages for failed uploads. Here's how to resolve them:

#### "Network error: Unable to connect to server"

**Cause:** Cannot reach the backend server

**Solutions:**
- Check your internet connection
- Ensure backend is running and accessible
- Verify `EXPO_PUBLIC_BACKEND_URL` in `.env` is correct
- For physical devices, use your computer's local IP instead of `localhost`
- Pull down to refresh and the queue will retry automatically

#### "Audio file no longer exists"

**Cause:** The recording file was deleted from device storage

**Solutions:**
- Cannot be retried - record a new meeting
- Audio files are stored in `FileSystem.documentDirectory` and persist until manually deleted
- Avoid clearing app data or cache while uploads are pending

#### "Authentication failed"

**Cause:** Your session expired or is invalid

**Solutions:**
- Sign out and sign back in
- The queue will automatically retry once you're authenticated
- Check Supabase session in settings

#### "Recording too large (XXmb). Maximum size is 50MB"

**Cause:** The recording exceeds the configured file size limit

**Details:**
- The queue automatically checks file size before upload
- Default limit: 50MB (configurable in `queueService.ts` - `MAX_FILE_SIZE_MB`)
- **Recommended max recording time: 45 minutes** (provides safety buffer below 50MB limit)
- Supabase free tier: 50MB per file, upgrade for larger files

**Estimated recording times at 128kbps (AAC):**
- 45 minutes ≈ 45MB (recommended)
- 50 minutes ≈ 50MB (at limit)
- 100 minutes ≈ 100MB (requires plan upgrade)

**Solutions:**
- Record shorter meetings (under 45 minutes recommended)
- **To increase limit:** Edit `MAX_FILE_SIZE_MB` in `/services/queueService.ts`
- **To reduce file size:** Lower bitrate in `recordingService.ts` (line 80, 88) from 128000 to 64000
- Upgrade Supabase plan for larger file support

### Checking Queue Status

The upload queue runs automatically and provides status updates:

**Automatic Processing:**
- Queue runs every 15 seconds
- Queue also runs when app comes to foreground
- Check console logs for "Queue loop" and "Processing job" messages

**In the UI:**
- Failed meetings show a red "Error" hint with the specific error message
- "Retry" button appears for failed meetings
- Tapping "Retry" resets the job and triggers immediate upload
- Meeting detail screen displays job errors in red monospace text

**Manual Retry:**
1. Navigate to the meetings list
2. Find the meeting with "Error" badge
3. Tap the "Retry" button
4. Queue will immediately attempt to process the job

## Backend Issues

### Backend Not Starting

**Common errors:**

#### "ModuleNotFoundError: No module named 'fastapi'"

**Cause:** Python dependencies not installed

**Solution:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### "SUPABASE_URL environment variable is required"

**Cause:** Backend `.env` file not configured

**Solution:**
1. Copy `backend/.env.example` to `backend/.env`
2. Add your Supabase credentials (see SETUP.md)

### Backend Connection Refused

**Symptom:** Frontend shows "Network error: Unable to connect to server"

**Causes & Solutions:**

1. **Backend not running**
   - Start backend: `cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000`

2. **Wrong URL in frontend**
   - For simulator/emulator: `EXPO_PUBLIC_BACKEND_URL=http://localhost:8000`
   - For physical device: `EXPO_PUBLIC_BACKEND_URL=http://192.168.1.X:8000` (your local IP)

3. **Firewall blocking connection**
   - Allow port 8000 in your firewall
   - macOS: System Preferences > Security & Privacy > Firewall
   - Windows: Windows Defender Firewall > Allow an app

## Database Issues

### "Row Level Security policy violation"

**Cause:** Trying to access data that doesn't belong to you, or RLS policies not set up correctly

**Solutions:**
1. Ensure you ran the `supabase/schema.sql` script in your Supabase dashboard
2. Verify you're signed in as the correct user
3. Check that the `meetings` table has RLS policies enabled
4. For backend operations, ensure you're using the `service_role` key (not `anon` key)

### "relation does not exist"

**Cause:** Database schema not set up

**Solution:**
1. Go to Supabase SQL Editor
2. Run the contents of `supabase/schema.sql`
3. Verify tables exist in the Table Editor

## Recording Issues

### Recording Doesn't Continue in Background

**iOS:**
1. Check that `UIBackgroundModes` includes `audio` in Info.plist
2. Run `npx expo prebuild --clean` to regenerate native projects
3. Rebuild the app

**Android:**
1. Check that foreground service permissions are configured
2. Run `npx expo prebuild --clean` to regenerate native projects
3. Rebuild the app
4. Grant microphone permissions when prompted

### "Recording failed to start"

**Causes & Solutions:**

1. **Microphone permissions denied**
   - iOS: Settings > AI Meeting Assistant > Microphone > Enable
   - Android: App Settings > Permissions > Microphone > Allow

2. **Audio session configuration failed**
   - Restart the app
   - Check device audio settings
   - Ensure no other apps are using the microphone

3. **Insufficient storage**
   - Free up device storage
   - Recordings are stored in `FileSystem.documentDirectory`

## Build Issues

### EAS Build Fails

**Common errors:**

#### "google-services.json not found"

**Cause:** FCM credentials not configured for EAS builds

**Solution:**
1. Ensure `google-services.json` is in project root for local development
2. For EAS builds, upload FCM service account key via `npx eas-cli credentials`
3. See SETUP.md > Push Notifications for detailed steps

#### "Gradle build failed"

**Causes & Solutions:**

1. **Dependency conflicts**
   - Try `cd android && ./gradlew clean`
   - Then rebuild with EAS

2. **Outdated Gradle wrapper**
   - Update `android/gradle/wrapper/gradle-wrapper.properties`
   - Set `distributionUrl` to a newer version

3. **Memory issues**
   - Increase Gradle memory in `android/gradle.properties`
   - Add: `org.gradle.jvmargs=-Xmx4096m`

### Expo Prebuild Issues

#### "Config plugin not applied"

**Cause:** Native projects not regenerated after config changes

**Solution:**
```bash
npx expo prebuild --clean
```

This regenerates the `ios/` and `android/` folders with all config plugin changes applied.

## General Debugging

### Enable Debug Logging

**Backend:**
- Backend already logs to console by default
- Check terminal where `uvicorn` is running
- Look for "Processing meeting", "Push notification sent", etc.

**Frontend:**
- Open React Native Debugger or Metro bundler console
- Look for console.log statements in services
- Queue service logs "Queue loop", "Processing job", "Job completed"

### Clear App State

**To reset the app to a fresh state:**

1. **Clear async storage (queue and cache):**
   - Add to your code temporarily:
     ```typescript
     import AsyncStorage from '@react-native-async-storage/async-storage';
     await AsyncStorage.clear();
     ```

2. **Clear Supabase session:**
   - Sign out from the app

3. **Clear app data (nuclear option):**
   - iOS: Delete app and reinstall
   - Android: Settings > Apps > AI Meeting Assistant > Storage > Clear data

### Network Inspection

**To inspect API calls:**

1. **React Native Debugger:**
   - Install: `brew install react-native-debugger`
   - Start: `open "rndebugger://set-debugger-loc?host=localhost&port=8081"`
   - Enable Network tab

2. **Flipper:**
   - Built-in network inspector
   - See requests to Supabase and backend

3. **Backend logs:**
   - Check FastAPI logs for incoming requests
   - Look for error stack traces

## Getting Help

If you encounter an issue not covered here:

1. Check the [SETUP.md](SETUP.md) guide to ensure everything is configured correctly
2. Review the [ARCHITECTURE.md](ARCHITECTURE.md) to understand how components interact
3. Check console logs for error messages
4. Verify all environment variables are set correctly
5. Ensure all services are running (backend, Expo dev server)

**Common checklist:**
- [ ] Supabase project created and configured
- [ ] Database schema applied (`supabase/schema.sql`)
- [ ] Storage bucket created (`meeting-audio`)
- [ ] Environment variables set (`.env` files)
- [ ] Backend running (`uvicorn main:app --reload`)
- [ ] Push notification credentials configured (FCM for Android)
- [ ] Development build installed (for push notifications)
- [ ] Microphone permissions granted
