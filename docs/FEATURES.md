# Features Documentation

This document provides detailed information about the app's features and implementation.

## Recording Layer

The app uses `expo-av` for high-quality audio recording with background support.

### Features

- One-tap recording start/stop
- Background recording that continues when app is backgrounded or screen locked
- Real-time duration counter during recording
- Automatic permission handling for microphone access
- High-quality audio encoding (AAC at 44.1kHz, 128kbps)
- **Recommended max recording time: 45 minutes** (to stay within 50MB file size limit)

### Implementation

- Recording service layer (`/services/recordingService.ts`) provides a clean API for recording operations
- Audio mode configured for background operation with `staysActiveInBackground: true`
- Records in `.m4a` format for broad compatibility
- Safe state management using React hooks (useRef, useState, useEffect)

### Audio Format Specifications

```typescript
{
  android: {
    extension: '.m4a',
    outputFormat: AndroidOutputFormat.MPEG_4,
    audioEncoder: AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: IOSAudioQuality.HIGH,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  }
}
```

### Android Foreground Service

- On Android, background microphone access requires a foreground service
- The native configuration is already in place via the config plugin
- Foreground notification UI will be implemented in a future commit with push notification integration

## Background Audio Configuration

This app includes a custom Expo config plugin that enables background audio recording on both iOS and Android.

### What the Plugin Configures

**iOS:**
- Adds `audio` to `UIBackgroundModes` in Info.plist (allows audio recording while app is backgrounded)
- Ensures `NSMicrophoneUsageDescription` is set (required for microphone access)

**Android:**
- Adds `RECORD_AUDIO` permission (microphone access)
- Adds `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MICROPHONE` permissions (Android 14+)
- Configures a foreground service with microphone type for continuous recording

### Plugin Implementation

The config plugin is located at `/plugins/withBackgroundAudio.js` and is registered in `app.json`:

```json
{
  "expo": {
    "plugins": [
      "./plugins/withBackgroundAudio"
    ]
  }
}
```

### Applying Native Changes

**Important:** After any changes to the config plugin or app.json, you must run prebuild to apply native changes:

```bash
npx expo prebuild --clean
```

This regenerates the native `ios/` and `android/` directories with the plugin's configurations applied.

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

### File Size Validation

The queue validates file size before upload to prevent wasting bandwidth on files that will be rejected:

- Default limit: 50MB (configurable in `queueService.ts` - `MAX_FILE_SIZE_MB`)
- Files exceeding the limit are immediately marked as failed with descriptive error
- Prevents unnecessary upload attempts for oversized files
- Error message includes actual file size and recommended actions

## AI-Generated Meeting Titles

Each meeting is automatically assigned a descriptive title (max 30 characters) generated by GPT-4o-mini based on the meeting transcript.

### How It Works

When a meeting is processed:
1. Audio is transcribed using OpenAI Whisper
2. GPT-4o-mini analyzes the transcript to generate:
   - **Title**: Brief descriptive title capturing the main topic (max 30 chars)
   - Clean transcript
   - Summary with key points and action items
3. The title is saved to the database and displayed in the meetings list

### Examples

Instead of generic timestamps, you'll see meaningful titles like:
- "Product Launch Planning"
- "Budget Review Q1 2024"
- "Team Standup - Sprint 12"
- "Client Onboarding Call"

### User Experience

**Meetings List**:
- Title displayed prominently at the top of each meeting card
- Date and duration shown below as metadata
- Falls back to date/time for meetings without titles (older meetings)

**UI Layout**:
```
┌─────────────────────────────────────┐
│ Product Launch Planning    [Ready] │  ← Title + Status Badge
│ Feb 13, 2024 • 15:23               │  ← Date & Duration
└─────────────────────────────────────┘
```

### Technical Details

**Database Schema**:
```sql
ALTER TABLE meetings ADD COLUMN title TEXT;
```

**GPT Prompt**:
The title is generated as part of the transcript analysis step:
```json
{
  "title": "Brief descriptive title for the meeting (max 30 characters)",
  "clean_transcript": "...",
  "summary": "...",
  "key_points": [...],
  "action_items": [...]
}
```

**Character Limit Enforcement**: Titles are automatically truncated to 30 characters on the backend to ensure consistent UI layout across all devices.

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

### Code Example

```typescript
// Subscribe to meeting updates
const channel = supabase
  .channel(`meeting-${id}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'meetings',
      filter: `id=eq.${id}`,
    },
    (payload) => {
      console.log('Meeting updated:', payload.new);
      setMeeting(payload.new as Meeting);
    }
  )
  .subscribe();

// Cleanup on unmount
return () => {
  supabase.removeChannel(channel);
};
```

### Benefits Over Polling

- **Instant updates**: No 5-second delay waiting for next poll
- **Reduced network usage**: No repeated requests every few seconds
- **Lower battery consumption**: Server pushes updates only when they occur
- **Scalable**: Server load doesn't increase with number of connected clients waiting for updates

## Lifecycle & Resilience

The app implements several strategies to ensure reliable operation and automatic state synchronization:

### Realtime Status Updates

Meeting status changes are instantly propagated via Supabase Realtime subscriptions. When the backend updates a meeting to "ready", connected clients receive the update immediately without polling. Subscriptions are automatically cleaned up on unmount to prevent memory leaks.

### AppState Auto-Refresh

When the app transitions from background to active, the meetings list automatically refreshes to display updated meeting statuses. This ensures users see the latest data after returning to the app. Includes a 500ms debounce to prevent duplicate refreshes.

**Implementation:**

```typescript
useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextAppState) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App has come to foreground
      loadMeetings();
    }
    appState.current = nextAppState;
  });

  return () => {
    subscription.remove();
  };
}, []);
```

### Upload Locking

An in-memory Set tracks active uploads by job ID to prevent duplicate submission. The lock is released in a finally block to ensure cleanup even on error.

**Why this matters:**
- Prevents multiple simultaneous uploads of the same file
- Prevents race conditions in queue processing
- Ensures atomic job state transitions

### Recording State Machine

The record screen uses a strict state machine (`idle | recording | uploading | processing`) to prevent impossible state transitions.

**State transitions:**
- `idle` → `recording` (user taps record)
- `recording` → `uploading` (user taps stop)
- `uploading` → `processing` (upload complete, backend processing started)
- `processing` → `idle` (backend processing complete, navigation to meeting detail)

**Guards:**
- Record button disabled during `uploading` and `processing` states
- Recording service guards against starting while already recording
- Recording service guards against stopping when not recording

### Graceful Error Display

Inline error messages provide user feedback without blocking the UI. Errors clear automatically on the next successful action.

**Features:**
- Non-blocking error display (doesn't prevent user from continuing)
- Errors auto-clear on next successful action
- Specific error messages with actionable guidance
- Error state doesn't affect app navigation or other features

**Implementation:**

```typescript
// InlineError component
const InlineError = ({ message }: { message: string | null }) => {
  if (!message) return null;

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
};
```

## Push Notifications

The app uses Expo Push Notifications to alert users when their meeting transcript is ready.

### Notification Flow

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

### Notification Permissions

**Android:**
- Automatically requests permissions on first launch
- User can grant/deny in system dialog
- Can be managed later in Android Settings > Apps > AI Meeting Assistant > Notifications

**iOS:**
- Requires explicit permission request
- User can grant/deny in system dialog
- Can be managed later in iOS Settings > AI Meeting Assistant > Notifications

### Notification Channels (Android)

The app creates a high-priority notification channel:

```typescript
{
  name: 'Meeting Ready',
  importance: AndroidImportance.MAX,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#FF231F7C',
}
```

**Why MAX importance?**
- Makes sound and appears as heads-up notification
- Ensures users see transcript ready notifications immediately
- Appropriate for time-sensitive information

### Deep Linking

**URL Scheme:** `ai-meeting-assistant://meeting/{id}`

**Implementation:**
- Expo Router automatically handles deep links
- Notification payload includes `data: { meetingId }`
- App navigation triggered by `Notifications.addNotificationResponseReceivedListener`
- Works from both foreground and background states

**Code Example:**

```typescript
Notifications.addNotificationResponseReceivedListener((response) => {
  const meetingId = response.notification.request.content.data.meetingId;
  if (meetingId) {
    router.push(`/meeting/${meetingId}`);
  }
});
```

### Push Token Management

Push tokens are stored in Supabase with RLS policies:

**Table Schema:**
```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**RLS Policies:**
- Users can only insert/update/delete their own tokens
- Backend uses service role key to read tokens for sending notifications

**Token Refresh:**
- Tokens are refreshed on each app launch
- Old tokens for the same user are replaced (upsert by user_id)
- Ensures tokens stay fresh and valid

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
  withBackgroundAudio.js   - Config plugin for iOS/Android background audio

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

/docs
  ARCHITECTURE.md          - Complete system architecture documentation
  SETUP.md                 - Comprehensive setup guide
  TROUBLESHOOTING.md       - Troubleshooting guide
  FEATURES.md              - This file
```

## State Management

The app uses React hooks for local component state and Supabase for global state.

### Local State

**useState:** For UI state that changes over time
- Recording status (`idle | recording | uploading | processing`)
- Meeting list data
- Error messages
- Loading states

**useRef:** For values that persist between renders but don't trigger re-renders
- Recording object reference
- AppState reference for lifecycle management
- Timeout/interval IDs

**useEffect:** For side effects and lifecycle management
- Loading data on mount
- Subscribing to Realtime updates
- Cleaning up subscriptions on unmount
- AppState listeners

### Global State

**Authentication:** Managed by Supabase auth listener in root layout
- Session state stored in SecureStore (iOS/Android) or localStorage (web)
- Auth guard redirects unauthenticated users to login
- Session persists across app restarts

**Data:** Stored in Supabase database with RLS
- Meetings table (recordings, transcripts, summaries)
- Push tokens table (notification delivery)
- Audio files in Storage (private bucket with RLS)

### Why Not Redux/MobX/Zustand?

For this app's scope, React hooks + Supabase provide sufficient state management:

**Pros:**
- Less boilerplate and complexity
- Native to React (no additional libraries)
- Supabase handles data persistence and sync
- Authentication state managed by Supabase auth
- Realtime updates handled by Supabase Realtime

**When you'd want global state:**
- Complex app-wide state with many interdependencies
- Offline-first requirements with complex sync logic
- Heavy caching and optimistic updates
- Multiple sources of truth that need coordination

For this meeting notes app, the combination of React hooks for UI state and Supabase for data/auth state is the right level of complexity.
