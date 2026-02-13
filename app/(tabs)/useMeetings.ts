import { useState, useEffect, useCallback } from 'react';
import * as MeetingService from '@/services/meetingService';
import type { MeetingListItem } from '@/services/meetingService';
import * as QueueService from '@/services/queueService';
import { supabase } from '@/lib/supabase';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

export function useMeetings() {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobErrors, setJobErrors] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string | null>(null);

  const loadMeetings = useCallback(async () => {
    try {
      const data = await MeetingService.listMeetings();
      setMeetings(data);

      // Load job errors for failed meetings
      const jobs = await QueueService.listJobs();
      const errors: Record<string, string> = {};
      jobs.forEach((job) => {
        if (job.status === 'failed' && job.lastError) {
          errors[job.meetingId] = job.lastError;
        }
      });
      setJobErrors(errors);
    } catch (error) {
      console.error('Failed to load meetings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  // Get user ID for realtime subscription
  useEffect(() => {
    const getUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUserId();
  }, []);

  // Subscribe to realtime updates for meetings
  useRealtimeSubscription<MeetingListItem>({
    table: 'meetings',
    filter: userId ? `user_id=eq.${userId}` : undefined,
    channelName: 'meetings-list',
    events: [
      {
        event: 'INSERT',
        handler: (payload) => {
          console.log('Realtime INSERT received for meetings list:', payload);
          if (payload.new) {
            const newMeeting = payload.new as MeetingListItem;
            setMeetings((prevMeetings) => [newMeeting, ...prevMeetings]);
          }
        },
      },
      {
        event: 'UPDATE',
        handler: (payload) => {
          console.log('Realtime UPDATE received for meetings list:', payload);
          if (payload.new) {
            const updatedMeeting = payload.new as MeetingListItem;
            console.log(`Updating meeting ${updatedMeeting.id} status to ${updatedMeeting.status}`);
            setMeetings((prevMeetings) => {
              // Check if meeting exists in the list
              const exists = prevMeetings.some(m => m.id === updatedMeeting.id);

              if (exists) {
                // Update existing meeting
                const updated = prevMeetings.map((meeting) =>
                  meeting.id === updatedMeeting.id ? updatedMeeting : meeting
                );
                console.log('Meeting updated in list');
                return updated;
              } else {
                // Meeting not in list yet (missed INSERT?), add it
                console.log('Meeting not found in list, adding it');
                return [updatedMeeting, ...prevMeetings];
              }
            });
          }
        },
      },
    ],
    debug: true,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMeetings();
    setRefreshing(false);
  }, [loadMeetings]);

  const handleRetry = useCallback(async (meetingId: string) => {
    try {
      await MeetingService.retryMeeting(meetingId);
      await handleRefresh();
    } catch (error) {
      console.error('Retry failed:', error);
    }
  }, [handleRefresh]);

  return {
    meetings,
    loading,
    refreshing,
    jobErrors,
    handleRefresh,
    handleRetry,
  };
}
