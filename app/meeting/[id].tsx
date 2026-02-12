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
        return '#4CAF50'; // Green
      case 'processing':
        return '#2196F3'; // Blue
      case 'upload_failed':
      case 'queued_failed':
        return '#FF3B30'; // Red
      case 'uploading':
        return '#FF9800'; // Orange
      default:
        return '#999'; // Gray
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ready':
        return 'Ready';
      case 'processing':
        return 'Processing';
      case 'upload_failed':
        return 'Upload Failed';
      case 'queued_failed':
        return 'Processing Failed';
      case 'uploading':
        return 'Uploading';
      case 'recorded':
        return 'Recorded';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
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
                <Text style={styles.errorText}>
                  The audio file failed to upload. Please try recording again.
                </Text>
              </>
            ) : meeting.status === 'queued_failed' ? (
              <>
                <Text style={styles.errorTitle}>Processing Failed</Text>
                <Text style={styles.errorText}>
                  The meeting could not be processed. Please contact support if this issue persists.
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
  errorText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    textAlign: 'center',
  },
});
