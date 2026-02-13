import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { Link } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import * as MeetingService from '@/services/meetingService';
import type { MeetingListItem } from '@/services/meetingService';
import * as QueueService from '@/services/queueService';
import { supabase } from '@/lib/supabase';
import StatusBadge from '@/components/StatusBadge';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

export default function MeetingsScreen() {
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

  const renderMeetingItem = ({ item }: { item: MeetingListItem }) => {
    const canRetry = item.status === 'upload_failed' || item.status === 'queued_failed';
    const jobError = jobErrors[item.id];

    const handleRetry = async () => {
      try {
        await MeetingService.retryMeeting(item.id);
        handleRefresh(); // Reload list
      } catch (error) {
        console.error('Retry failed:', error);
      }
    };

    return (
      <View style={styles.meetingItemContainer}>
        <Link href={`/meeting/${item.id}`} asChild>
          <TouchableOpacity style={styles.meetingItem}>
            <View style={styles.meetingHeader}>
              <Text style={styles.meetingTitle} numberOfLines={1}>
                {item.title || MeetingService.formatDateTime(item.created_at)}
              </Text>
              <StatusBadge status={item.status} />
            </View>
            <View style={styles.meetingMeta}>
              <Text style={styles.meetingDate}>
                {MeetingService.formatDateTime(item.created_at)}
              </Text>
              {item.duration_millis && (
                <>
                  <Text style={styles.metaSeparator}>•</Text>
                  <Text style={styles.meetingDuration}>
                    {MeetingService.formatDuration(item.duration_millis)}
                  </Text>
                </>
              )}
            </View>
            {jobError && (
              <Text style={styles.errorHint} numberOfLines={1}>
                Error: {jobError}
              </Text>
            )}
          </TouchableOpacity>
        </Link>
        {canRetry && (
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#FF3B30" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {meetings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No meetings yet</Text>
          <Text style={styles.emptySubtext}>Record your first meeting to get started</Text>
        </View>
      ) : (
        <FlatList
          data={meetings}
          renderItem={renderMeetingItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FF3B30" />
          }
        />
      )}
    </View>
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
  },
  listContainer: {
    padding: 20,
  },
  meetingItemContainer: {
    marginBottom: 12,
  },
  meetingItem: {
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  meetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  meetingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  meetingDate: {
    fontSize: 13,
    color: '#666',
  },
  metaSeparator: {
    fontSize: 13,
    color: '#999',
    marginHorizontal: 8,
  },
  meetingDuration: {
    fontSize: 13,
    color: '#666',
  },
  errorHint: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
    fontStyle: 'italic',
  },
  retryButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
});
