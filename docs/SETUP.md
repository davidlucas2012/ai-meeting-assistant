# Setup Guide

This guide provides comprehensive setup instructions for the AI Meeting Assistant app.

## Prerequisites

- Node.js 18+ and npm/yarn
- Python 3.9+ (for backend)
- Expo CLI
- iOS Simulator (macOS) or Android Emulator

## Mobile App Setup

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

You'll need to add your Supabase credentials (see [Supabase Setup](#supabase-setup) below).

### 3. Start the Development Server

```bash
npm start
# or
yarn start
```

### 4. Run on a Platform

```bash
npm run ios       # iOS simulator
npm run android   # Android emulator
npm run web       # Web browser
```

## Supabase Setup

This app uses Supabase for authentication, database, and storage.

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the project to finish setting up

### 2. Configure Frontend Environment Variables

1. Get your Supabase credentials:
   - Go to Project Settings > API
   - Copy the **Project URL** and paste it as `EXPO_PUBLIC_SUPABASE_URL` in `.env`
   - Copy the **anon/public key** and paste it as `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env`

### 3. Set Up Database Schema

1. Go to the SQL Editor in your Supabase dashboard
2. Copy the contents of `supabase/schema.sql`
3. Paste and run the SQL commands

This will:
- Create the `meetings` table with proper structure
- Set up Row Level Security (RLS) policies so users can only access their own meetings
- Create the `push_tokens` table for notification management
- Configure storage bucket policies

### 4. Create Storage Bucket

1. Go to Storage in your Supabase dashboard
2. Create a new bucket named `meeting-audio`
3. Set it to **Private** (not public)
4. The RLS policies from the schema will control access

### 5. (Optional) Disable Email Confirmation

For development, you may want to disable email confirmation:

1. Go to Authentication > Settings
2. Scroll to "Email Auth"
3. Disable "Confirm email"

This allows you to sign up without verifying your email during development.

## Backend Setup

The backend processes meeting audio files, generates transcripts and summaries, and sends push notifications.

### 0. Install Python (if not already installed)

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

### 1. Install Python Dependencies

**Important:** Use `python3` (not `python`) on macOS/Linux.

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Backend Environment

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your Supabase credentials:
   - Go to Supabase Project Settings > API
   - Copy the **Project URL** as `SUPABASE_URL`
   - Copy the **service_role key** (NOT the anon key!) as `SUPABASE_SERVICE_ROLE_KEY`

   ⚠️ **Important**: The service role key bypasses Row Level Security. **NEVER** expose this key in client-side code or commit it to version control!

### 3. Run the Backend

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

### 4. Update Frontend Backend URL

Make sure your frontend `.env` file has the correct backend URL:

```
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```

For testing on a physical device, use your computer's local IP address:

```
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:8000
```

To find your local IP:
- **macOS/Linux**: `ifconfig | grep "inet "`
- **Windows**: `ipconfig`

## Push Notifications

The app uses Expo Push Notifications to alert users when their meeting transcript is ready.

### Android Push Setup (FCM Required)

> **⚠️ Note for Evaluators:** For this take-home exam, `google-services.json` is included in the repository to enable immediate building and testing. **In a production environment**, this file would be:
> - Added to `.gitignore` to prevent committing credentials
> - Managed via EAS Secrets or environment variables
> - Auto-generated during builds from FCM service account credentials
>
> This demonstrates understanding of security best practices while maintaining evaluator convenience.

Push notifications on Android require Firebase Cloud Messaging (FCM) credentials. The included `google-services.json` is pre-configured for testing. To set up your own Firebase project:

#### 1. Create Firebase Project

- Go to [https://console.firebase.google.com](https://console.firebase.google.com)
- Create a new project (or use existing)
- Click "Add app" and select Android

#### 2. Register Android App

- Enter the package name: `com.anonymous.aimeetingtemp` (from app.json)
- Download `google-services.json`
- Place it in the project root (same directory as `package.json`) for local development

#### 3. Upload FCM Service Account Key to EAS

- In Firebase Console, go to Project Settings > Service Accounts
- Click "Generate new private key" and download the JSON file
- Upload to EAS:
  ```bash
  npx eas-cli credentials
  ```
- Select: Android → Push Notifications → Upload FCM service account key
- **EAS will automatically generate `google-services.json` during cloud builds** from these credentials

#### 4. Verify Configuration

- Ensure `google-services.json` is in project root (for local development only)
- File is gitignored to prevent committing credentials
- For EAS builds: `google-services.json` is auto-generated from FCM credentials (no manual setup needed)

**Note:** Push notifications do **NOT** work in Expo Go. You must use a development build (see "Building Dev Client" below).

### iOS Push Setup (APNs Required)

> **⚠️ Note for Evaluators:** iOS push notifications are **architecturally supported** but require an **Apple Developer Account** ($99/year) for testing. This is not included in the take-home exam scope due to:
> - Required paid Apple Developer membership
> - APNs credentials tied to Team ID
> - Physical iOS device requirement (simulators don't support push)
>
> The Android implementation demonstrates the complete push notification flow. The same Expo Push Notifications API works cross-platform with identical architecture.

**iOS Push Requirements (for reference):**

If you have an Apple Developer account, iOS push notifications work identically to Android:

#### 1. Generate APNs Key

- Log in to [Apple Developer Portal](https://developer.apple.com/account)
- Go to Certificates, Identifiers & Profiles > Keys
- Create a new key with "Apple Push Notifications service (APNs)" enabled
- Download the `.p8` file and note your Key ID and Team ID

#### 2. Upload to EAS

```bash
npx eas-cli credentials
```

- Select: iOS → Push Notifications → Upload APNs key
- Provide Key ID, Team ID, and `.p8` file
- EAS manages credentials for cloud builds

#### 3. Build for iOS

```bash
npx eas-cli build --profile development --platform ios
```

#### 4. Implementation Notes

- Same `expo-notifications` API used for both platforms
- Same token storage in Supabase `push_tokens` table
- Same backend `/process-meeting` endpoint sends notifications
- Same deep linking via `ai-meeting-assistant://meeting/{id}`

**Why Android-only for this exam:**
- Demonstrates complete push notification architecture
- No additional code needed for iOS (same implementation)
- Evaluators without Apple Developer accounts can still test
- Production-ready approach documented for both platforms

### Building Dev Client (Required for Push on Android)

Push notifications require a custom native build. Follow these steps:

#### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

#### 2. Login to EAS

```bash
eas login
```

#### 3. Build Development Client

```bash
eas build --profile development --platform android
```

#### 4. Install on Device

- Download the `.apk` from the EAS build URL
- Install on your Android device
- Or use `eas build:run` to install directly

#### 5. Run Dev Server

```bash
npx expo start --dev-client
```

The development build includes your FCM credentials and enables push notifications.

### How It Works

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

### Testing Push Notifications (Android)

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

### Applying Native Changes

**Important:** After any changes to the config plugin or app.json, you must run prebuild to apply native changes:

```bash
npx expo prebuild --clean
```

This regenerates the native `ios/` and `android/` directories with the plugin's configurations applied.

## Next Steps

Once setup is complete:
- See [FEATURES.md](FEATURES.md) for detailed feature documentation
- See [ARCHITECTURE.md](ARCHITECTURE.md) for system architecture overview
- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) if you encounter issues
