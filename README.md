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

### Backend Setup

See [backend/README.md](backend/README.md) for backend setup instructions.

## Project Structure

```
/app
  /(tabs)           - Tab navigation
    index.tsx       - Record screen
    meetings.tsx    - Meetings list
  /meeting/[id].tsx - Meeting detail view
/plugins            - Custom Expo config plugins (TBD)
/backend            - Python FastAPI backend
```

## Architecture Decisions

**Framework**: Expo SDK 54 with Expo Router for file-based routing and deep linking support.

**State Management**: React hooks for now. Will add state management (Zustand/Redux) as recording and data sync complexity grows.

**Navigation**: Expo Router provides file-based routing and deep link handling out of the box, reducing boilerplate.

**Backend**: FastAPI for async support and auto-generated API docs. Separation from mobile app allows independent scaling.

**Database**: Supabase planned for auth, storage, and Postgres with RLS (not yet implemented).

## What Would Be Improved With More Time

- Implement actual audio recording with background support
- Create custom Expo config plugin for native permissions
- Integrate Supabase for auth, storage, and database
- Add Expo Push Notifications
- Implement real transcription/summarization in backend
- Error handling and loading states
- Offline support and sync
- Unit and integration tests
- Audio visualization during recording