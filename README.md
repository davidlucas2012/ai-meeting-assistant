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

#### Testing Push Notifications

**Requirements:**
- Push notifications **only work on physical devices** (not simulators/emulators)
- Ensure the backend is running and accessible from your device
- Grant notification permissions when prompted

**Testing Steps:**
1. Run the app on a physical device
2. Sign in to create/restore a session
3. Grant notification permissions
4. Record a short meeting
5. Wait for upload to complete
6. Backend will process the meeting and send a notification
7. Tap the notification to open the meeting detail

**Troubleshooting:**
- Check backend logs for "Push notification sent"
- Verify push token is stored in Supabase (`push_tokens` table)
- Ensure `EXPO_PUBLIC_BACKEND_URL` points to accessible IP (not `localhost` for physical devices)
- Check app foreground/background notification settings

#### Notification Channel (Android)

The app creates a notification channel with these settings:
- **Channel ID**: `meeting-ready`
- **Name**: "Meeting Ready"
- **Importance**: MAX (makes sound and appears on-screen)
- **Vibration**: Pattern [0, 250, 250, 250]

Users can customize notification behavior in Android Settings > Apps > AI Meeting Assistant > Notifications.

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
/supabase
  schema.sql               - Database schema, RLS policies, push tokens table
/backend
  main.py                  - FastAPI backend with /process-meeting endpoint
  requirements.txt         - Python dependencies
  .env.example             - Backend environment template
```

## Architecture Decisions

**Framework**: Expo SDK 54 with Expo Router for file-based routing and deep linking support.

**Recording**: expo-av provides native audio recording with background support. Audio mode configured for continuous recording even when app is backgrounded or screen locked. Custom config plugin handles all native permissions.

**State Management**: React hooks (useState, useRef, useEffect) for local component state. Authentication state managed globally via Supabase auth listener in root layout.

**Navigation**: Expo Router provides file-based routing, deep link handling, and auth guards. Protected routes automatically redirect unauthenticated users to the auth screen.

**Backend**: FastAPI for async support and auto-generated API docs. Separation from mobile app allows independent scaling.

**Database & Auth**: Supabase for PostgreSQL database, authentication (email/password), and file storage. Row Level Security (RLS) ensures users can only access their own data. Session persistence via expo-secure-store on native platforms (keychain/keystore) and localStorage on web.

**File Upload**: Audio recordings are uploaded to Supabase Storage after recording stops. Files are stored at `{user_id}/{meeting_id}.m4a` path structure, enabling user-scoped RLS policies.

**Push Notifications**: Expo Push Notifications alert users when transcripts are ready. Push tokens are stored in Supabase with RLS policies. Deep linking via Expo Router opens specific meeting details when notification is tapped.

**Backend Processing**: After upload, frontend calls backend `/process-meeting` endpoint with signed audio URL. Backend generates mock transcript/summary, updates database, and sends push notification. Fire-and-forget pattern prevents blocking UI.

## What Would Be Improved With More Time

- Implement real transcription/summarization using AI services (OpenAI Whisper, GPT-4, etc.)
- Add background job queue for backend processing (Celery, RQ, or Bull)
- Implement foreground notification for Android recording service
- Better error handling and retry logic for failed uploads
- Offline support and sync queue for recordings
- Audio playback controls on meeting detail screen
- Unit and integration tests (Jest for frontend, pytest for backend)
- Audio visualization during recording
- Delete meeting functionality
- User profile and settings screen
- Push notification receipt tracking
- Analytics and monitoring (Sentry, PostHog)
- Production deployment guides (Fly.io, Railway, Vercel)