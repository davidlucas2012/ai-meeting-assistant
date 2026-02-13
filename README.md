# AI Meeting Assistant

A mobile app for recording in-person meetings with AI-generated transcripts and summaries delivered via push notifications.

**User Flow:** Tap record → put phone in pocket → stop recording 30 minutes later → receive notification when transcript is ready → tap to view meeting.

---

## Quick Start

### Prerequisites
- Node.js 18+, Python 3.9+, Expo CLI
- Supabase account (free tier)
- OpenAI account with API key ([platform.openai.com](https://platform.openai.com/api-keys))
- Android device for push notifications (or iOS with Apple Developer account)

### 1. Mobile App

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Add your Supabase credentials to .env

# Start development server
npm start

# Run on platform
npm run ios       # iOS simulator
npm run android   # Android emulator
```

### 2. Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in SQL Editor
3. Create storage bucket: `meeting-audio` (private)
4. Add credentials to `.env`:
   - `EXPO_PUBLIC_SUPABASE_URL` (Project URL)
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` (anon/public key)

### 3. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Add to backend/.env:
#   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
#   - OPENAI_API_KEY (from platform.openai.com/api-keys)

# Run backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Push Notifications (Android)

Push notifications require a development build (not Expo Go):

```bash
# Install EAS CLI
npm install -g eas-cli
eas login

# Build development client
eas build --profile development --platform android

# Install on device and run
npx expo start --dev-client
```

**Note:** `google-services.json` is included for evaluation purposes. For iOS push, see [docs/SETUP.md](docs/SETUP.md#ios-push-setup-apns-required).

📖 **Detailed setup instructions:** [docs/SETUP.md](docs/SETUP.md)

---

## Optional Speaker Diarization

After a meeting is transcribed, you can optionally generate speaker labels to organize the transcript by speaker turns with intelligent name extraction.

**How it works:**
- Raw transcript is generated automatically during initial processing
- Speaker labeling is available on-demand via a button in the meeting detail view
- **Extracts speaker names** when introduced ("Hi, I'm Maria" → labeled as "Maria")
- Uses generic labels (Speaker 1, Speaker 2) for unnamed speakers
- No additional audio processing required (operates on stored transcript text only)
- Uses GPT-4o-mini for text-only AI inference to keep costs low
- Results are cached - subsequent views are instant
- Structured diarization stored as JSON for future UI enhancements

**Note:** Speaker identification is based on transcript text analysis, not biometric voice ID.

**Usage:**
1. Open a processed meeting (status: "ready")
2. Tap "Generate Speaker Labels" button in the transcript section
3. Wait a few seconds for AI processing
4. Toggle between raw and speaker-labeled views

---

## Architecture Decisions

**Framework:** Expo SDK 54 with Expo Router for file-based routing and deep linking support. Enables seamless notification → meeting detail navigation.

**Recording:** expo-av provides native audio recording with background support. Custom config plugin (`/plugins/withBackgroundAudio.js`) configures iOS (`UIBackgroundModes: audio`) and Android (foreground service) for continuous recording when app is backgrounded or screen locked. Records high-quality AAC at 128kbps.

**Reliability Queue:** Persistent upload queue (`queueService.ts`) ensures recordings are never lost. Jobs are stored in AsyncStorage and survive app crashes. Exponential backoff retry strategy (5 attempts) handles network failures gracefully. One job at a time prevents race conditions. Failed jobs display actionable error messages with manual retry.

**Realtime Updates:** Supabase Realtime subscriptions (`postgres_changes`) provide instant status updates when backend processing completes. No polling required—status changes are pushed to connected clients immediately. Reduces network usage and battery consumption.

**State Management:** React hooks (useState, useRef, useEffect) for local component state. Supabase auth listener in root layout manages global authentication state. No Redux/MobX needed for this scope—keeps codebase simple and reduces boilerplate.

**Backend:** FastAPI (Python) for async support and auto-generated API docs at `/docs`. Separation from mobile app allows independent scaling. `/process-meeting` endpoint downloads audio, transcribes with OpenAI Whisper, generates structured summary with GPT-4o-mini (key points + action items), updates database, and sends push notification.

**Database & Auth:** Supabase for PostgreSQL database, email/password authentication, and file storage. Row Level Security (RLS) ensures users can only access their own data. Session persistence via expo-secure-store on native platforms.

**File Upload:** Audio uploaded to Supabase Storage at `{user_id}/{meeting_id}.m4a` path structure, enabling user-scoped RLS policies. 50MB max file size (configurable). Upload triggered after recording stops, handled by queue.

**Push Notifications:** Expo Push Notifications with Firebase Cloud Messaging (Android) and APNs (iOS). Push tokens stored in Supabase with RLS. Deep linking (`ai-meeting-assistant://meeting/{id}`) opens specific meeting when notification is tapped. Backend sends notification after processing completes.

**Trade-offs Made:**
- **Synchronous AI processing** instead of background queue (Celery/RQ) to keep MVP scope simple
- **Transcript truncation at 20K chars** to avoid token limits (handles ~2 hour meetings)
- **Firebase credentials committed** for evaluator convenience (would be in EAS Secrets in production)
- **Sequential queue processing** (one job at a time) instead of parallel to simplify locking
- **50MB file size limit** matches Supabase free tier (≈45 min recording)
- **Android-only push demo** due to Apple Developer account requirement ($99/year)

📐 **Full architecture documentation:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## What Would Be Improved With More Time

**AI Enhancements:**
- Speaker diarization for multi-person meetings ("John: ...", "Sarah: ...")
- Sentiment analysis and meeting insights
- Custom prompts for domain-specific summarization (sales calls, standups, etc.)
- Support for very long recordings (chunked transcription, streaming)

**Backend Processing:**
- Background job queue (Celery/RQ/Bull) for async processing to prevent timeout on long recordings
- Webhook-based status updates instead of fire-and-forget
- More robust retry logic for failed transcription jobs with exponential backoff
- Progress updates during processing ("Transcribing... 45%")

**Recording UX:**
- Recording time limit enforcement with visual warnings
- Estimated file size indicator during recording (e.g., "12MB / 50MB")
- Auto-stop at 48 minutes (safety buffer before 50MB limit)
- Audio playback controls on meeting detail screen
- Audio visualization during recording

**Data Management:**
- Delete meeting functionality with automatic audio file cleanup
- Bulk operations (delete all, export all)
- Search and filter meetings by date/status
- Meeting tags and categories

**Testing & Quality:**
- Unit tests (Jest for frontend, pytest for backend)
- Integration tests for upload queue and retry logic
- E2E tests with Detox
- Error tracking (Sentry)
- Analytics (PostHog)

**Production Readiness:**
- Android foreground notification during recording
- Queue status indicator in UI ("2 uploads pending")
- Push notification receipt tracking
- User profile and settings screen
- Deployment guides (Fly.io for backend, EAS for mobile)
- Rate limiting and authentication on backend endpoints
- Manual audio file cleanup for completed meetings

---

## Documentation

- 📖 **[Setup Guide](docs/SETUP.md)** - Comprehensive setup instructions
- 📐 **[Architecture](docs/ARCHITECTURE.md)** - System design and flow diagrams
- ⚙️ **[Features](docs/FEATURES.md)** - Detailed feature documentation
- 🔧 **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

---

## Project Structure

```
/app                      - Expo Router file-based routing
  /(tabs)                 - Tab navigation
    index.tsx             - Record screen with recording UI
    meetings.tsx          - Meetings list with status badges
  /meeting/[id].tsx       - Meeting detail (transcript + summary)
  auth.tsx                - Authentication screen
  _layout.tsx             - Root layout with auth guard

/services                 - Business logic layer
  recordingService.ts     - Audio recording (expo-av wrapper)
  meetingService.ts       - Meeting CRUD, upload, backend integration
  notificationsService.ts - Push notification registration
  queueService.ts         - Persistent upload queue with retry logic

/plugins                  - Custom Expo config plugins
  withBackgroundAudio.js  - iOS/Android background audio config

/backend                  - Python FastAPI backend
  main.py                 - /process-meeting endpoint
  requirements.txt        - Python dependencies

/supabase
  schema.sql              - Database schema, RLS policies
```

---

Built with Expo SDK 54, Supabase, and FastAPI.
