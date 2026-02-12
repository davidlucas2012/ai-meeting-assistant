-- AI Meeting Assistant Database Schema
-- Run this in the Supabase SQL Editor at: https://supabase.com/dashboard/project/_/sql

-- Create meetings table
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded', 'uploading', 'upload_failed', 'processing', 'ready')),
  audio_path TEXT NOT NULL,
  audio_url TEXT,
  transcript TEXT,
  summary TEXT,
  duration_millis INTEGER
);

-- Create index for faster user queries
CREATE INDEX IF NOT EXISTS meetings_user_id_idx ON public.meetings(user_id);
CREATE INDEX IF NOT EXISTS meetings_created_at_idx ON public.meetings(created_at DESC);
CREATE INDEX IF NOT EXISTS meetings_status_idx ON public.meetings(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

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

-- Note: After running this schema:
-- 1. Create the 'meeting-audio' storage bucket in the Supabase Dashboard
-- 2. The bucket should be set to PRIVATE (not public)
-- 3. Storage policies above will control access based on user_id folder structure
-- 4. Audio files should be stored at: meeting-audio/{user_id}/{meeting_id}.m4a
