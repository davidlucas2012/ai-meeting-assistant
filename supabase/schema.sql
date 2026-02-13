-- AI Meeting Assistant Database Schema
-- Run this in the Supabase SQL Editor at: https://supabase.com/dashboard/project/_/sql

-- Create meetings table
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'uploading', 'upload_failed', 'processing', 'ready', 'queued_failed')),
  audio_path TEXT NOT NULL,
  audio_url TEXT,
  transcript TEXT,
  summary TEXT,
  title TEXT,  -- AI-generated meeting title (max 30 chars) based on transcript content
  duration_millis INTEGER,
  -- Optional speaker diarization: generated on-demand from stored transcript
  -- Raw transcript stored in 'transcript', speaker-labeled version stored here
  -- Diarization is text-only processing (no re-transcription of audio)
  transcript_diarized TEXT,
  -- Structured diarization: JSON format with speaker labels and segments
  -- Schema: {speakers: [{id, label}], segments: [{speaker_id, text}]}
  -- Extracts speaker names when introduced ("I'm Maria" -> label: "Maria")
  diarization_json JSONB
);

-- Create index for faster user queries
CREATE INDEX IF NOT EXISTS meetings_user_id_idx ON public.meetings(user_id);
CREATE INDEX IF NOT EXISTS meetings_created_at_idx ON public.meetings(created_at DESC);
CREATE INDEX IF NOT EXISTS meetings_status_idx ON public.meetings(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Enable Realtime for the meetings table
-- This allows the mobile app to receive instant updates when meetings change
-- Run this in Supabase SQL Editor OR enable via Dashboard:
-- Dashboard > Database > Replication > Enable for "meetings" table
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;

-- RLS Policies for meetings table

-- Policy: Users can view their own meetings
CREATE POLICY "Users can view their own meetings"
  ON public.meetings
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own meetings
CREATE POLICY "Users can insert their own meetings"
  ON public.meetings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own meetings
CREATE POLICY "Users can update their own meetings"
  ON public.meetings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own meetings
CREATE POLICY "Users can delete their own meetings"
  ON public.meetings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Storage bucket for meeting audio files
-- Note: This must be created via the Supabase Dashboard or Storage API
-- Go to: Storage > Create a new bucket > Name: "meeting-audio" > Private: true

-- Storage RLS Policies
-- These policies allow users to upload and access their own audio files
-- Run these AFTER creating the meeting-audio bucket

-- Policy: Users can upload audio files to their own folder
CREATE POLICY "Users can upload their own audio"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'meeting-audio' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can view their own audio files
CREATE POLICY "Users can view their own audio"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'meeting-audio' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can update their own audio files
CREATE POLICY "Users can update their own audio"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'meeting-audio' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'meeting-audio' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Users can delete their own audio files
CREATE POLICY "Users can delete their own audio"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'meeting-audio' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Grant access to authenticated users
GRANT ALL ON public.meetings TO authenticated;

-- ============================================================================
-- Push Notifications Table
-- ============================================================================

-- Create push_tokens table for storing Expo Push Notification tokens
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_tokens_user_id_token_unique UNIQUE (user_id, token)
);

-- Create index for faster user queries
CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens(user_id);

-- Enable Row Level Security (RLS) on push_tokens
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for push_tokens table

-- Policy: Users can view their own push tokens
CREATE POLICY "Users can view their own push tokens"
  ON public.push_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own push tokens
CREATE POLICY "Users can insert their own push tokens"
  ON public.push_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own push tokens
CREATE POLICY "Users can update their own push tokens"
  ON public.push_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own push tokens
CREATE POLICY "Users can delete their own push tokens"
  ON public.push_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Grant access to authenticated users
GRANT ALL ON public.push_tokens TO authenticated;

-- Note: After running this schema:
-- 1. Create the 'meeting-audio' storage bucket in the Supabase Dashboard
-- 2. The bucket should be set to PRIVATE (not public)
-- 3. Storage policies above will control access based on user_id folder structure
-- 4. Audio files should be stored at: meeting-audio/{user_id}/{meeting_id}.m4a
