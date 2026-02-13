import { Text, View, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { Link } from 'expo-router';
import * as MeetingService from '@/services/meetingService';
import type { MeetingListItem } from '@/services/meetingService';
import StatusBadge from '@/components/StatusBadge';
import { useMeetings } from './useMeetings';
import { styles } from './meetings.styles';

export default function MeetingsScreen() {
  const {
    meetings,
    loading,
    refreshing,
    jobErrors,
    handleRefresh,
    handleRetry,
  } = useMeetings();

  const renderMeetingItem = ({ item }: { item: MeetingListItem }) => {
    const canRetry = item.status === 'upload_failed' || item.status === 'queued_failed';
    const jobError = jobErrors[item.id];

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
          <TouchableOpacity style={styles.retryButton} onPress={() => handleRetry(item.id)}>
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

