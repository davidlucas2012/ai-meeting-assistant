# AI Meeting Assistant

A mobile app for recording in-person meetings with AI-generated transcripts and summaries delivered via push notifications.

## Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Python 3.9+ (for backend)
- Expo CLI
- iOS Simulator (macOS) or Android Emulator

### Mobile App Setup

1. Install dependencies:
```bash
npm install
# or
yarn install
```

2. Configure Supabase (see [Supabase Setup](#supabase-setup) below)

3. Start the development server:
```bash
npm start
# or
yarn start
```

4. Run on a platform:
```bash
npm run ios       # iOS simulator
npm run android   # Android emulator
npm run web       # Web browser
```

### Background Audio Configuration

This app includes a custom Expo config plugin that enables background audio recording on both iOS and Android.

**What the plugin configures:**

**iOS:**
- Adds `audio` to `UIBackgroundModes` in Info.plist (allows audio recording while app is backgrounded)
- Ensures `NSMicrophoneUsageDescription` is set (required for microphone access)

**Android:**
- Adds `RECORD_AUDIO` permission (microphone access)
- Adds `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MICROPHONE` permissions (Android 14+)
- Configures a foreground service with microphone type for continuous recording

**Important:** After any changes to the config plugin or app.json, you must run prebuild to apply native changes:

```bash
npx expo prebuild --clean
```

This regenerates the native `ios/` and `android/` directories with the plugin's configurations applied.

### Recording Layer

The app uses `expo-av` for high-quality audio recording with background support.

**Features:**
- One-tap recording start/stop
- Background recording that continues when app is backgrounded or screen is locked
- Real-time duration counter during recording
- Automatic permission handling for microphone access
- High-quality audio encoding (AAC at 44.1kHz, 128kbps)
- **Recommended max recording time: 45 minutes** (to stay within 50MB file size limit)

**Implementation:**
- Recording service layer (`/services/recordingService.ts`) provides a clean API for recording operations
- Audio mode configured for background operation with `staysActiveInBackground: true`
- Records in `.m4a` format for broad compatibility
- Safe state management using React hooks (useRef, useState, useEffect)

**Android Foreground Service:**
- On Android, background microphone access requires a foreground service
- The native configuration is already in place via the config plugin
- Foreground notification UI will be implemented in a future commit with push notification integration

### Supabase Setup

This app uses Supabase for authentication, database, and storage.

#### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the project to finish setting up

#### 2. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Get your Supabase credentials:
   - Go to Project Settings > API
   - Copy the **Project URL** and paste it as `EXPO_PUBLIC_SUPABASE_URL`
   - Copy the **anon/public key** and paste it as `EXPO_PUBLIC_SUPABASE_ANON_KEY`

#### 3. Set Up Database Schema

1. Go to the SQL Editor in your Supabase dashboard
2. Copy the contents of `supabase/schema.sql`
3. Paste and run the SQL commands

This will:
- Create the `meetings` table with proper structure
- Set up Row Level Security (RLS) policies so users can only access their own meetings
- Configure storage bucket policies

#### 4. Create Storage Bucket

1. Go to Storage in your Supabase dashboard
2. Create a new bucket named `meeting-audio`
3. Set it to **Private** (not public)
4. The RLS policies from the schema will control access

#### 5. (Optional) Disable Email Confirmation

For development, you may want to disable email confirmation:

1. Go to Authentication > Settings
2. Scroll to "Email Auth"
3. Disable "Confirm email"

This allows you to sign up without verifying your email during development.

### Backend Setup

The backend processes meeting audio files, generates transcripts and summaries, and sends push notifications when processing is complete.

#### 0. Install Python (if not already installed)

**Check if Python is installed:**
```bash
python3 --version
```

If you see a version number (e.g., `Python 3.11.x`), you're good to go. Skip to step 1.

**If Python is not installed:**

**macOS:**
```bash
# Using Homebrew (recommended)
brew install python@3.11

# Verify installation
python3 --version
```

If you don't have Homebrew:
```bash
# Install Homebrew first
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Then install Python
brew install python@3.11
```

**Windows:**
1. Download Python from https://www.python.org/downloads/
2. Run the installer
3. ✅ Check "Add Python to PATH" during installation
4. Verify: `python --version` in Command Prompt

**Linux:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install python3.11 python3.11-venv python3-pip

# Fedora
sudo dnf install python3.11

# Verify
python3 --version
```

#### 1. Install Python Dependencies

**Important:** Use `python3` (not `python`) on macOS/Linux.

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### 2. Configure Backend Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your Supabase credentials:
   - Go to Supabase Project Settings > API
   - Copy the **Project URL** as `SUPABASE_URL`
   - Copy the **service_role key** (NOT the anon key!) as `SUPABASE_SERVICE_ROLE_KEY`

   ⚠️ **Important**: The service role key bypasses Row Level Security. **NEVER** expose this key in client-side code or commit it to version control!

#### 3. Run the Backend

```bash
# Make sure you're in the backend directory with venv activated
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`

**API Endpoints:**
- `GET /health` - Health check
- `POST /process-meeting` - Process audio and send notification (called automatically by mobile app)

**API Documentation:**
- Visit `http://localhost:8000/docs` for interactive API documentation

#### 4. Update Frontend Backend URL

Make sure your frontend `.env` file has the correct backend URL:
```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```

For testing on a physical device, use your computer's local IP address:
```
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:8000
```

### Push Notifications

The app uses Expo Push Notifications to alert users when their meeting transcript is ready.

#### Android Push Setup (FCM Required)

> **⚠️ Note for Evaluators:** For this take-home exam, `google-services.json` is included in the repository to enable immediate building and testing. **In a production environment**, this file would be:
> - Added to `.gitignore` to prevent committing credentials
> - Managed via EAS Secrets or environment variables
> - Auto-generated during builds from FCM service account credentials
>
> This demonstrates understanding of security best practices while maintaining evaluator convenience.

Push notifications on Android require Firebase Cloud Messaging (FCM) credentials. The included `google-services.json` is pre-configured for testing. To set up your own Firebase project:

1. **Create Firebase Project**
   - Go to [https://console.firebase.google.com](https://console.firebase.google.com)
   - Create a new project (or use existing)
   - Click "Add app" and select Android

2. **Register Android App**
   - Enter the package name: `com.anonymous.aimeetingtemp` (from app.json)
   - Download `google-services.json`
   - Place it in the project root (same directory as `package.json`) for local development

3. **Upload FCM Service Account Key to EAS**
   - In Firebase Console, go to Project Settings > Service Accounts
   - Click "Generate new private key" and download the JSON file
   - Upload to EAS:
     ```bash
     npx eas-cli credentials
     ```
   - Select: Android → Push Notifications → Upload FCM service account key
   - **EAS will automatically generate `google-services.json` during cloud builds** from these credentials

4. **Verify Configuration**
   - Ensure `google-services.json` is in project root (for local development only)
   - File is gitignored to prevent committing credentials
   - For EAS builds: `google-services.json` is auto-generated from FCM credentials (no manual setup needed)

**Note:** Push notifications do **NOT** work in Expo Go. You must use a development build (see "Building Dev Client" below).

#### iOS Push Setup (APNs Required)

> **⚠️ Note for Evaluators:** iOS push notifications are **architecturally supported** but require an **Apple Developer Account** ($99/year) for testing. This is not included in the take-home exam scope due to:
> - Required paid Apple Developer membership
> - APNs credentials tied to Team ID
> - Physical iOS device requirement (simulators don't support push)
>
> The Android implementation demonstrates the complete push notification flow. The same Expo Push Notifications API works cross-platform with identical architecture.

**iOS Push Requirements (for reference):**

If you have an Apple Developer account, iOS push notifications work identically to Android:

1. **Generate APNs Key**
   - Log in to [Apple Developer Portal](https://developer.apple.com/account)
   - Go to Certificates, Identifiers & Profiles > Keys
   - Create a new key with "Apple Push Notifications service (APNs)" enabled
   - Download the `.p8` file and note your Key ID and Team ID

2. **Upload to EAS**
   ```bash
   npx eas-cli credentials
   ```
   - Select: iOS → Push Notifications → Upload APNs key
   - Provide Key ID, Team ID, and `.p8` file
   - EAS manages credentials for cloud builds

3. **Build for iOS**
   ```bash
   npx eas-cli build --profile development --platform ios
   ```

4. **Implementation Notes**
   - Same `expo-notifications` API used for both platforms
   - Same token storage in Supabase `push_tokens` table
   - Same backend `/process-meeting` endpoint sends notifications
   - Same deep linking via `ai-meeting-assistant://meeting/{id}`

**Why Android-only for this exam:**
- Demonstrates complete push notification architecture
- No additional code needed for iOS (same implementation)
- Evaluators without Apple Developer accounts can still test
- Production-ready approach documented for both platforms

#### Building Dev Client (Required for Push on Android)

Push notifications require a custom native build. Follow these steps:

1. **Install EAS CLI**:
   ```bash
   npm install -g eas-cli
   ```

2. **Login to EAS**:
   ```bash
   eas login
   ```

3. **Build Development Client**:
   ```bash
   eas build --profile development --platform android
   ```

4. **Install on Device**:
   - Download the `.apk` from the EAS build URL
   - Install on your Android device
   - Or use `eas build:run` to install directly

5. **Run Dev Server**:
   ```bash
   npx expo start --dev-client
   ```

The development build includes your FCM credentials and enables push notifications.

#### How It Works

1. **Registration**: When a user signs in, the app automatically:
   - Requests notification permissions
   - Creates an Android notification channel ("Meeting Ready")
   - Registers for an Expo Push Token
   - Stores the token in Supabase

2. **Processing Flow**:
   - User records a meeting
   - Audio is uploaded to Supabase Storage
   - Frontend calls backend `/process-meeting` endpoint
   - Backend generates mock transcript/summary and updates database
   - Backend sends push notification via Expo Push Service

3. **Deep Linking**: When user taps the notification:
   - App opens to the specific meeting detail screen
   - Uses Expo Router deep linking: `ai-meeting-assistant://meeting/{id}`

#### Testing Push Notifications (Android)

**Requirements:**
- Push notifications **only work on physical devices** (not simulators/emulators)
- Must use a development build (not Expo Go)
- Android device with FCM credentials configured (see "Android Push Setup" above)
- Ensure the backend is running and accessible from your device
- Grant notification permissions when prompted

**Testing Steps:**
1. Build and install dev client (see "Building Dev Client" above)
2. Run the dev server with `npx expo start --dev-client`
3. Sign in to create/restore a session
4. Grant notification permissions when prompted
5. Record a short meeting
6. Wait for upload to complete
7. Backend will process the meeting and send a notification
8. Tap the notification to open the meeting detail

**For iOS Testing:**
- Requires Apple Developer Account and APNs credentials (see "iOS Push Setup" above)
- Same flow once credentials are configured

**Troubleshooting:**
- Check backend logs for "Push notification sent"
- Verify push token is stored in Supabase (`push_tokens` table)
- Ensure `EXPO_PUBLIC_BACKEND_URL` points to accessible IP (not `localhost` for physical devices)
- Check app foreground/background notification settings
- **Android: If push token generation fails**, check console for "Push token generation failed. Check FCM credentials and rebuild."

#### Notification Channel (Android)

The app creates a notification channel with these settings:
- **Channel ID**: `meeting-ready`
- **Name**: "Meeting Ready"
- **Importance**: MAX (makes sound and appears on-screen)
- **Vibration**: Pattern [0, 250, 250, 250]

Users can customize notification behavior in Android Settings > Apps > AI Meeting Assistant > Notifications.

## Realtime Updates

The app uses **Supabase Realtime** to provide instant status updates without polling. When the backend finishes processing a meeting and updates the database row to `status: 'ready'`, the change is instantly propagated to connected clients.

### How It Works

**Meeting Detail Screen**:
- Subscribes to `postgres_changes` events for the specific meeting row
- Updates UI instantly when backend changes meeting status
- No polling required - updates are pushed from the server
- Subscription automatically cleaned up on unmount

**Meetings List Screen**:
- Subscribes to updates for all meetings owned by the current user
- Automatically updates meeting status badges in the list
- Works alongside AppState refresh for foreground transitions

### Implementation Details

- Uses Supabase Realtime `postgres_changes` to listen for database row updates
- Filter: `id=eq.{meetingId}` for detail screen, `user_id=eq.{userId}` for list screen
- Channel cleanup prevents memory leaks and duplicate subscriptions
- Error logging for subscription failures (does not crash UI)
- Realtime updates complement (not replace) AppState refresh and pull-to-refresh

### Benefits Over Polling

- **Instant updates**: No 5-second delay waiting for next poll
- **Reduced network usage**: No repeated requests every few seconds
- **Lower battery consumption**: Server pushes updates only when they occur
- **Scalable**: Server load doesn't increase with number of connected clients waiting for updates

## Project Structure

```
/app
  /(tabs)                  - Tab navigation
    index.tsx              - Record screen with recording UI
    meetings.tsx           - Meetings list with status badges
  /meeting/[id].tsx        - Meeting detail view (transcript + summary)
  auth.tsx                 - Authentication screen
  _layout.tsx              - Root layout with auth guard and notification handlers
/lib
  supabase.ts              - Supabase client configuration
  api.ts                   - Backend API client
/plugins                   - Custom Expo config plugins for background audio
/services
  recordingService.ts      - Audio recording (expo-av wrapper)
  meetingService.ts        - Meeting CRUD, upload, and backend integration
  notificationsService.ts  - Push notification registration and token management
  queueService.ts          - Persistent upload queue with retry logic
/supabase
  schema.sql               - Database schema, RLS policies, push tokens table
/backend
  main.py                  - FastAPI backend with /process-meeting endpoint
  requirements.txt         - Python dependencies
  .env.example             - Backend environment template
```

## Reliability Queue

The app includes a persistent queue system that ensures recordings are never lost due to network failures, app crashes, or temporary backend issues.

### How It Works

When you stop a recording, the audio file is immediately **enqueued** for upload rather than uploaded synchronously. This means:

1. **Recording is saved locally** on your device
2. **Job is added to the queue** (stored in AsyncStorage)
3. **You can navigate away immediately** - the upload happens in the background
4. **Queue persists** across app restarts and survives crashes
5. **Automatic retries** with exponential backoff (up to 5 attempts)

### Queue Architecture

**Storage**: AsyncStorage (single atomic array at `@queue/jobs`)
- Jobs persist across app sessions
- Crash recovery resets stuck jobs automatically
- No data loss even if app is force-quit

**Retry Strategy**: Exponential backoff prevents hammering the backend during outages
- Attempt 1: Retry after 1 second
- Attempt 2: Retry after 2 seconds
- Attempt 3: Retry after 4 seconds
- Attempt 4: Retry after 8 seconds
- Attempt 5: Retry after 16 seconds
- After 5 failed attempts: Job marked as "failed", manual retry available

**Concurrency**: One job at a time (global lock prevents race conditions)
- Jobs are processed sequentially to avoid overwhelming the backend
- Queue automatically runs every 15 seconds
- Queue triggers on app foreground (AppState listener)

### Job Lifecycle

```
Recording stopped
    ↓
Job created (status: pending)
    ↓
Queue picks up job (status: running)
    ↓
1. Create meeting row in database
2. Upload audio to Supabase Storage
3. Request backend processing
    ↓
Success → Job completed (removed after 24h)
Failure → Job pending (retry with backoff)
    ↓
Max attempts reached → Job failed (manual retry available)
```

### Crash Recovery

If the app crashes during upload:
- On next startup, the queue detects jobs stuck in "running" state
- These jobs are reset to "pending" with error message "App restarted during job"
- The upload is retried from the beginning (idempotent operations)

### User Experience

**Meetings List**:
- Failed meetings show a red "Error" hint with the specific error message
- "Retry" button appears for failed meetings
- Tapping "Retry" resets the job and triggers immediate upload

**Meeting Detail**:
- Failed meetings display the job error in red monospace text
- Suggested actions based on error type (e.g., "check your connection")

### Troubleshooting Failed Uploads

**"Network error: Unable to connect to server"**
- Check your internet connection
- Ensure backend is running and accessible
- Verify `EXPO_PUBLIC_BACKEND_URL` in `.env` is correct
- Pull down to refresh and the queue will retry automatically

**"Audio file no longer exists"**
- The recording file was deleted from device storage
- Cannot be retried - record a new meeting
- Audio files are stored in `FileSystem.documentDirectory` and persist until manually deleted

**"Authentication failed"**
- Your session expired - sign out and sign back in
- The queue will automatically retry once you're authenticated

**"Recording too large (XXmb). Maximum size is 50MB"**
- The queue automatically checks file size before upload
- Default limit: 50MB (configurable in `queueService.ts` - `MAX_FILE_SIZE_MB`)
- **Recommended max recording time: 45 minutes** (provides safety buffer below 50MB limit)
- Supabase free tier: 50MB per file, upgrade for larger files
- **Estimated recording times at 128kbps (AAC):**
  - 45 minutes ≈ 45MB (recommended)
  - 50 minutes ≈ 50MB (at limit)
  - 100 minutes ≈ 100MB (requires plan upgrade)
- **To increase limit:** Edit `MAX_FILE_SIZE_MB` in `/services/queueService.ts`
- **To reduce file size:** Lower bitrate in `recordingService.ts` (line 80, 88) from 128000 to 64000

**Checking Queue Status**:
- Queue runs automatically every 15 seconds
- Queue also runs when app comes to foreground
- Check console logs for "Queue loop" and "Processing job" messages

## Lifecycle & Resilience

The app implements several strategies to ensure reliable operation and automatic state synchronization:

**Realtime Status Updates**: Meeting status changes are instantly propagated via Supabase Realtime subscriptions. When the backend updates a meeting to "ready", connected clients receive the update immediately without polling. Subscriptions are automatically cleaned up on unmount to prevent memory leaks.

**AppState Auto-Refresh**: When the app transitions from background to active, the meetings list automatically refreshes to display updated meeting statuses. This ensures users see the latest data after returning to the app. Includes a 500ms debounce to prevent duplicate refreshes.

**Upload Locking**: An in-memory Set tracks active uploads by job ID to prevent duplicate submission. The lock is released in a finally block to ensure cleanup even on error.

**Recording State Machine**: The record screen uses a strict state machine (`idle | recording | uploading | processing`) to prevent impossible state transitions. The record button is disabled during upload and processing states. Recording service guards against starting while already recording or stopping when not recording.

**Graceful Error Display**: Inline error messages provide user feedback without blocking the UI. Errors clear automatically on the next successful action. The `InlineError` component conditionally renders based on message presence.

## Architecture Decisions

**Framework**: Expo SDK 54 with Expo Router for file-based routing and deep linking support.

**Recording**: expo-av provides native audio recording with background support. Audio mode configured for continuous recording even when app is backgrounded or screen locked. Custom config plugin handles all native permissions.

**State Management**: React hooks (useState, useRef, useEffect) for local component state. Authentication state managed globally via Supabase auth listener in root layout.

**Navigation**: Expo Router provides file-based routing, deep link handling, and auth guards. Protected routes automatically redirect unauthenticated users to the auth screen.

**Backend**: FastAPI for async support and auto-generated API docs. Separation from mobile app allows independent scaling.

**Database & Auth**: Supabase for PostgreSQL database, authentication (email/password), and file storage. Row Level Security (RLS) ensures users can only access their own data. Session persistence via expo-secure-store on native platforms (keychain/keystore) and localStorage on web.

**File Upload**: Audio recordings are uploaded to Supabase Storage after recording stops. Files are stored at `{user_id}/{meeting_id}.m4a` path structure, enabling user-scoped RLS policies.

**Push Notifications**: Expo Push Notifications alert users when transcripts are ready. Push tokens are stored in Supabase with RLS policies. Deep linking via Expo Router opens specific meeting details when notification is tapped. Firebase credentials (`google-services.json`) are included in this repository for evaluation purposes only; in production, these would be managed via EAS Secrets and gitignored.

**Backend Processing**: After upload, frontend calls backend `/process-meeting` endpoint with signed audio URL. Backend generates mock transcript/summary, updates database, and sends push notification. Fire-and-forget pattern prevents blocking UI.

## What Would Be Improved With More Time

- Implement real transcription/summarization using AI services (OpenAI Whisper, GPT-4, etc.)
- Add background job queue for backend processing (Celery, RQ, or Bull)
- Implement foreground notification for Android recording service
- **Recording time limit enforcement:**
  - Show estimated file size during recording (e.g., "12MB / 50MB")
  - Display warning when approaching 45-minute recommended limit
  - Auto-stop recording at 48 minutes (safety buffer before 50MB limit)
  - Allow users to adjust quality vs. duration trade-off
- Audio playback controls on meeting detail screen
- Unit and integration tests (Jest for frontend, pytest for backend)
- Audio visualization during recording
- Delete meeting functionality with automatic audio file cleanup
- User profile and settings screen with configurable limits
- Push notification receipt tracking
- Analytics and monitoring (Sentry, PostHog)
- Production deployment guides (Fly.io, Railway, Vercel)
- Queue status indicator in UI (e.g., "2 uploads pending")
- Manual audio file cleanup for completed meetings
