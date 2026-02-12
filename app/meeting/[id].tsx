import { StyleSheet, Text, View, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import * as MeetingService from '@/services/meetingService';
import type { Meeting } from '@/services/meetingService';

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadMeeting();
  }, [id]);

  const loadMeeting = async () => {
    try {
      const data = await MeetingService.getMeeting(id as string);
      if (!data) {
        setNotFound(true);
      } else {
        setMeeting(data);
      }
    } catch (error) {
      console.error('Failed to load meeting:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return '#4CAF50';
      case 'upload_failed':
        return '#FF3B30';
      case 'processing':
        return '#FF9800';
      default:
        return '#999';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'upload_failed':
        return 'Upload Failed';
      case 'processing':
        return 'Processing';
      case 'uploading':
        return 'Uploading';
      default:
        return 'Recorded';
    }
  };

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
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(meeting.status) }]}>
            <Text style={styles.statusText}>{getStatusText(meeting.status)}</Text>
          </View>
        </View>

        {meeting.duration_millis && (
          <Text style={styles.duration}>
            Duration: {MeetingService.formatDuration(meeting.duration_millis)}
          </Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transcript</Text>
          {meeting.transcript ? (
            <Text style={styles.content}>{meeting.transcript}</Text>
          ) : (
            <Text style={styles.placeholder}>
              {meeting.status === 'processing'
                ? 'Processing transcript...'
                : meeting.status === 'upload_failed'
                ? 'Upload failed. Please try recording again.'
                : 'Transcript will be generated after processing.'}
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          {meeting.summary ? (
            <Text style={styles.content}>{meeting.summary}</Text>
          ) : (
            <Text style={styles.placeholder}>
              {meeting.status === 'processing'
                ? 'Generating summary...'
                : meeting.status === 'upload_failed'
                ? 'Upload failed. Please try recording again.'
                : 'Summary will be generated after processing.'}
            </Text>
          )}
        </View>
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
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'uppercase',
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
  placeholder: {
    fontSize: 15,
    color: '#999',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
});
