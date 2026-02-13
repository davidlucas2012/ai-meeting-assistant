import { StyleSheet, Text, View, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import * as MeetingService from '@/services/meetingService';
import type { Meeting } from '@/services/meetingService';
import * as QueueService from '@/services/queueService';
import StatusBadge from '@/components/StatusBadge';
import InlineError from '@/components/InlineError';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const loadMeeting = useCallback(async () => {
    try {
      const data = await MeetingService.getMeeting(id as string);
      if (!data) {
        setNotFound(true);
      } else {
        setMeeting(data);
        setErrorMessage(null);

        // Load job error if exists
        const jobs = await QueueService.listJobs();
        const job = jobs.find((j) => j.meetingId === data.id);
        if (job && job.status === 'failed' && job.lastError) {
          setJobError(job.lastError);
        } else {
          setJobError(null);
        }
      }
    } catch (error) {
      console.error('Failed to load meeting:', error);
      const message = error instanceof Error ? error.message : 'Failed to load meeting';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadMeeting();
  }, [loadMeeting]);

  // Subscribe to realtime updates for this meeting
  useEffect(() => {
    if (!id) return;

    // Avoid duplicate subscriptions
    if (channelRef.current) {
      console.log('Realtime channel already active');
      return;
    }

    console.log(`Subscribing to realtime updates for meeting ${id}`);

    const channel = supabase
      .channel(`meeting-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meetings',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          console.log('Realtime update received:', payload);
          if (payload.new) {
            setMeeting(payload.new as Meeting);
            setErrorMessage(null);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime subscription active');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Realtime subscription failed:', status);
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        console.log('Unsubscribing from realtime updates');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [id]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF3B30" />
        </View>
      </>
    );
  }

  if (notFound || !meeting) {
    return (
      <>
        <Stack.Screen options={{ title: 'Meeting Not Found' }} />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Meeting not found</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Meeting Details' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.date}>{MeetingService.formatDateTime(meeting.created_at)}</Text>
          <StatusBadge status={meeting.status} />
        </View>

        <InlineError message={errorMessage} />

        {meeting.duration_millis && (
          <Text style={styles.duration}>
            Duration: {MeetingService.formatDuration(meeting.duration_millis)}
          </Text>
        )}

        {meeting.status === 'ready' ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Transcript</Text>
              <Text style={styles.contentText}>{meeting.transcript || 'No transcript available'}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Summary</Text>
              <Text style={styles.contentText}>{meeting.summary || 'No summary available'}</Text>
            </View>
          </>
        ) : (
          <View style={styles.processingContainer}>
            {meeting.status === 'processing' ? (
              <>
                <ActivityIndicator size="large" color="#2196F3" style={styles.processingSpinner} />
                <Text style={styles.processingTitle}>Processing...</Text>
                <Text style={styles.processingText}>
                  Your meeting is being transcribed and summarized. You'll receive a notification when it's ready.
                </Text>
              </>
            ) : meeting.status === 'upload_failed' ? (
              <>
                <Text style={styles.errorTitle}>Upload Failed</Text>
                {jobError && <Text style={styles.errorDetail}>{jobError}</Text>}
                <Text style={styles.errorText}>
                  The audio file failed to upload. Pull down to retry or check your connection.
                </Text>
              </>
            ) : meeting.status === 'queued_failed' ? (
              <>
                <Text style={styles.errorTitle}>Processing Failed</Text>
                {jobError && <Text style={styles.errorDetail}>{jobError}</Text>}
                <Text style={styles.errorText}>
                  The meeting could not be queued for processing. Pull down to retry.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.processingTitle}>Not Yet Processed</Text>
                <Text style={styles.processingText}>
                  This meeting is waiting to be processed. Processing will begin shortly.
                </Text>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  date: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  duration: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#333',
  },
  contentText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  placeholder: {
    fontSize: 15,
    color: '#999',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  processingSpinner: {
    marginBottom: 20,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  processingText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorDetail: {
    fontSize: 13,
    color: '#FF3B30',
    marginBottom: 8,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    textAlign: 'center',
  },
});
