import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { Link } from 'expo-router';
import { useState, useEffect, useCallback, useRef } from 'react';
import * as MeetingService from '@/services/meetingService';
import type { MeetingListItem } from '@/services/meetingService';
import * as QueueService from '@/services/queueService';
import { signOut } from '@/lib/supabase';
import StatusBadge from '@/components/StatusBadge';

export default function MeetingsScreen() {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobErrors, setJobErrors] = useState<Record<string, string>>({});
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const lastRefreshTime = useRef<number>(Date.now());

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

      lastRefreshTime.current = Date.now();
    } catch (error) {
      console.error('Failed to load meetings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  // AppState listener for auto-refresh when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // App transitioned from background to active
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Debounce: only refresh if it's been more than 500ms since last refresh
        const timeSinceLastRefresh = Date.now() - lastRefreshTime.current;
        if (timeSinceLastRefresh > 500) {
          console.log('App came to foreground, refreshing meetings...');
          loadMeetings();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [loadMeetings]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMeetings();
    setRefreshing(false);
  }, [loadMeetings]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

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
              <Text style={styles.meetingDate}>
                {MeetingService.formatDateTime(item.created_at)}
              </Text>
              <StatusBadge status={item.status} />
            </View>
            {item.duration_millis && (
              <Text style={styles.meetingDuration}>
                Duration: {MeetingService.formatDuration(item.duration_millis)}
              </Text>
            )}
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
      <View style={styles.header}>
        <Text style={styles.title}>Meetings</Text>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  signOutButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
  },
  signOutText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
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
    marginBottom: 8,
  },
  meetingDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
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
