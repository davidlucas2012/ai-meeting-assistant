import { StyleSheet, Text, View, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { Link } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import * as MeetingService from '@/services/meetingService';
import type { MeetingListItem } from '@/services/meetingService';
import { signOut } from '@/lib/supabase';

export default function MeetingsScreen() {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMeetings = useCallback(async () => {
    try {
      const data = await MeetingService.listMeetings();
      setMeetings(data);
    } catch (error) {
      console.error('Failed to load meetings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
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
    const statusColor = item.status === 'ready' ? '#4CAF50' : item.status === 'upload_failed' ? '#FF3B30' : '#999';
    const statusText = item.status === 'ready' ? 'Ready' : item.status === 'upload_failed' ? 'Upload Failed' : item.status.charAt(0).toUpperCase() + item.status.slice(1);

    return (
      <Link href={`/meeting/${item.id}`} asChild>
        <TouchableOpacity style={styles.meetingItem}>
          <View style={styles.meetingHeader}>
            <Text style={styles.meetingDate}>
              {MeetingService.formatDateTime(item.created_at)}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
          </View>
          {item.duration_millis && (
            <Text style={styles.meetingDuration}>
              Duration: {MeetingService.formatDuration(item.duration_millis)}
            </Text>
          )}
        </TouchableOpacity>
      </Link>
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
  meetingItem: {
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 12,
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
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'uppercase',
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
