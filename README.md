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

See [backend/README.md](backend/README.md) for backend setup instructions.

## Project Structure

```
/app
  /(tabs)           - Tab navigation
    index.tsx       - Record screen with recording UI
    meetings.tsx    - Meetings list
  /meeting/[id].tsx - Meeting detail view
  auth.tsx          - Authentication screen
/lib
  supabase.ts       - Supabase client configuration
/plugins            - Custom Expo config plugins for background audio
/services           - Recording and meeting service layers
  recordingService.ts - Audio recording (expo-av wrapper)
  meetingService.ts   - Meeting CRUD and upload operations
/supabase
  schema.sql        - Database schema and RLS policies
/backend            - Python FastAPI backend
```

## Architecture Decisions

**Framework**: Expo SDK 54 with Expo Router for file-based routing and deep linking support.

**Recording**: expo-av provides native audio recording with background support. Audio mode configured for continuous recording even when app is backgrounded or screen locked. Custom config plugin handles all native permissions.

**State Management**: React hooks (useState, useRef, useEffect) for local component state. Authentication state managed globally via Supabase auth listener in root layout.

**Navigation**: Expo Router provides file-based routing, deep link handling, and auth guards. Protected routes automatically redirect unauthenticated users to the auth screen.

**Backend**: FastAPI for async support and auto-generated API docs. Separation from mobile app allows independent scaling.

**Database & Auth**: Supabase for PostgreSQL database, authentication (email/password), and file storage. Row Level Security (RLS) ensures users can only access their own data. Session persistence via expo-secure-store on native platforms (keychain/keystore) and localStorage on web.

**File Upload**: Audio recordings are uploaded to Supabase Storage after recording stops. Files are stored at `{user_id}/{meeting_id}.m4a` path structure, enabling user-scoped RLS policies.

## What Would Be Improved With More Time

- Implement foreground notification for Android recording service
- Add Expo Push Notifications for transcript completion
- Implement real transcription/summarization in backend (currently placeholders)
- Backend webhook/polling to trigger processing after upload
- Better error handling and retry logic for failed uploads
- Offline support and sync queue for recordings
- Audio playback controls on meeting detail screen
- Unit and integration tests
- Audio visualization during recording
- Delete meeting functionality
- User profile and settings screen