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

2. Start the development server:
```bash
npm start
# or
yarn start
```

3. Run on a platform:
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

### Backend Setup

See [backend/README.md](backend/README.md) for backend setup instructions.

## Project Structure

```
/app
  /(tabs)           - Tab navigation
    index.tsx       - Record screen with recording UI
    meetings.tsx    - Meetings list
  /meeting/[id].tsx - Meeting detail view
/plugins            - Custom Expo config plugins for background audio
/services           - Recording service layer (expo-av wrapper)
/backend            - Python FastAPI backend
```

## Architecture Decisions

**Framework**: Expo SDK 54 with Expo Router for file-based routing and deep linking support.

**Recording**: expo-av provides native audio recording with background support. Audio mode configured for continuous recording even when app is backgrounded or screen locked. Custom config plugin handles all native permissions.

**State Management**: React hooks (useState, useRef, useEffect) for local component state. Will add global state management (Zustand/Redux) as data sync complexity grows.

**Navigation**: Expo Router provides file-based routing and deep link handling out of the box, reducing boilerplate.

**Backend**: FastAPI for async support and auto-generated API docs. Separation from mobile app allows independent scaling.

**Database**: Supabase planned for auth, storage, and Postgres with RLS (not yet implemented).

## What Would Be Improved With More Time

- Implement foreground notification for Android recording service
- Integrate Supabase for auth, storage, and database
- Add Expo Push Notifications
- Implement real transcription/summarization in backend
- Error handling and loading states
- Offline support and sync
- Unit and integration tests
- Audio visualization during recording