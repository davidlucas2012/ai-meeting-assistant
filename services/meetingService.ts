import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { postJson } from '@/lib/api';
import { getCurrentPushToken } from './notificationsService';

/**
 * Generate a UUID v4 (works in React Native)
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export type MeetingStatus = 'recorded' | 'uploading' | 'upload_failed' | 'processing' | 'ready' | 'queued_failed';

export interface Meeting {
  id: string;
  user_id: string;
  created_at: string;
  status: MeetingStatus;
  audio_path: string;
  audio_url: string | null;
  transcript: string | null;
  summary: string | null;
  duration_millis: number | null;
}

export interface MeetingListItem {
  id: string;
  created_at: string;
  status: MeetingStatus;
  duration_millis: number | null;
}

/**
 * Create a meeting record and upload the audio file to Supabase Storage.
 * This function:
 * 1. Gets the current user session
 * 2. Generates a meeting ID
 * 3. Creates a meeting record in the database
 * 4. Reads the local audio file
 * 5. Uploads the file to Supabase Storage
 * 6. Updates the meeting record with upload status
 *
 * @param localUri - The local file URI of the recorded audio
 * @param durationMillis - Duration of the recording in milliseconds
 * @returns The meeting ID
 * @throws Error if user is not authenticated or upload fails
 */
export async function createMeetingAndUploadAudio(
  localUri: string,
  durationMillis: number
): Promise<{ meetingId: string }> {
  try {
    console.log('Starting createMeetingAndUploadAudio...');

    // 1. Get current user
    console.log('Getting user session...');
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    console.log('Session result:', {
      hasSession: !!session,
      hasUser: !!session?.user,
      sessionError: sessionError?.message
    });

    if (sessionError) {
      throw new Error(`Session error: ${sessionError.message}`);
    }

    if (!session?.user) {
      throw new Error('User not authenticated. Please sign in and try again.');
    }

    const userId = session.user.id;
    console.log('User ID:', userId);

    // 2. Generate meeting ID (client-side for stable storage path)
    const meetingId = generateUUID();
    const audioPath = `${userId}/${meetingId}.m4a`;

    console.log('Creating meeting record:', { meetingId, audioPath });

    // 3. Create meeting record in database
    const { data: insertData, error: insertError } = await supabase.from('meetings').insert({
      id: meetingId,
      user_id: userId,
      audio_path: audioPath,
      status: 'uploading',
      duration_millis: durationMillis,
    }).select();

    console.log('Insert result:', {
      hasData: !!insertData,
      hasError: !!insertError,
      errorDetails: insertError
    });

    if (insertError) {
      console.error('Failed to create meeting record:', insertError);
      throw new Error(`Failed to create meeting record: ${insertError.message}`);
    }

    console.log('Meeting record created, reading audio file...');

    // 4. Read local file as base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: 'base64',
    });

    // Convert base64 to binary
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    console.log('Audio file read, uploading to storage...');

    // 5. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('meeting-audio')
      .upload(audioPath, byteArray, {
        contentType: 'audio/m4a',
        upsert: false,
      });

    if (uploadError) {
      console.error('Failed to upload audio:', uploadError);

      // Update meeting status to upload_failed
      await supabase
        .from('meetings')
        .update({ status: 'upload_failed' })
        .eq('id', meetingId);

      throw new Error(`Failed to upload audio: ${uploadError.message}`);
    }

    console.log('Audio uploaded successfully, creating signed URL...');

    // 6. Create a signed URL for the backend to download the audio
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('meeting-audio')
      .createSignedUrl(audioPath, 3600); // 1 hour expiry

    if (signedUrlError || !signedUrlData) {
      console.error('Failed to create signed URL:', signedUrlError);
      // Update meeting status to upload_failed
      await supabase
        .from('meetings')
        .update({ status: 'upload_failed' })
        .eq('id', meetingId);
      throw new Error(`Failed to create signed URL: ${signedUrlError?.message || 'Unknown error'}`);
    }

    const audioUrl = signedUrlData.signedUrl;
    console.log('Signed URL created');

    // 7. Get user's push token
    const pushToken = await getCurrentPushToken();
    console.log('Push token retrieved:', pushToken ? 'yes' : 'no');

    // 8. Call backend to process the meeting
    try {
      console.log('Calling backend to process meeting...');

      // Update meeting status to processing immediately
      await supabase
        .from('meetings')
        .update({ status: 'processing' })
        .eq('id', meetingId);

      // Fire-and-forget call to backend (don't await to avoid blocking UI)
      postJson('/process-meeting', {
        audio_url: audioUrl,
        meeting_id: meetingId,
        push_token: pushToken,
      }).catch((error) => {
        console.error('Backend processing failed:', error);
        // Update meeting status to indicate backend failure
        supabase
          .from('meetings')
          .update({ status: 'queued_failed' })
          .eq('id', meetingId)
          .then(() => console.log('Meeting status updated to queued_failed'));
      });

      console.log('Backend processing initiated');
    } catch (error) {
      console.error('Failed to initiate backend processing:', error);
      // Update status to queued_failed
      await supabase
        .from('meetings')
        .update({ status: 'queued_failed' })
        .eq('id', meetingId);
    }

    console.log('Meeting created and uploaded successfully:', meetingId);

    return { meetingId };
  } catch (error) {
    console.error('Error in createMeetingAndUploadAudio:', error);
    throw error;
  }
}

/**
 * List all meetings for the current user, sorted by creation date (newest first).
 * @returns Array of meeting list items
 */
export async function listMeetings(): Promise<MeetingListItem[]> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('meetings')
      .select('id, created_at, status, duration_millis')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch meetings: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error('Error listing meetings:', error);
    throw error;
  }
}

/**
 * Get a single meeting by ID.
 * @param id - The meeting ID
 * @returns The meeting details
 */
export async function getMeeting(id: string): Promise<Meeting | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch meeting: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error('Error getting meeting:', error);
    throw error;
  }
}

/**
 * Format duration in milliseconds to a human-readable string.
 * @param millis - Duration in milliseconds
 * @returns Formatted duration string (e.g., "5:23")
 */
export function formatDuration(millis: number | null): string {
  if (!millis) return '0:00';

  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format a date string to a human-readable format.
 * @param dateString - ISO date string
 * @returns Formatted date string (e.g., "Feb 12, 2024")
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a date string to include time.
 * @param dateString - ISO date string
 * @returns Formatted date and time string (e.g., "Feb 12, 2024 at 3:45 PM")
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
