import InlineError from "@/components/InlineError";
import StatusBadge from "@/components/StatusBadge";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import * as API from "@/lib/api";
import type { Meeting } from "@/services/meetingService";
import * as MeetingService from "@/services/meetingService";
import * as QueueService from "@/services/queueService";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppStateStatus } from "react-native";
import {
  ActivityIndicator,
  Alert,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function MeetingDetailScreen() {
  const { id: rawId } = useLocalSearchParams();
  // Handle case where id might be an array or undefined
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [diarizing, setDiarizing] = useState(false);
  const [showDiarized, setShowDiarized] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

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
        if (job && job.status === "failed" && job.lastError) {
          setJobError(job.lastError);
        } else {
          setJobError(null);
        }
      }
    } catch (error) {
      console.error("Failed to load meeting:", error);
      const message =
        error instanceof Error ? error.message : "Failed to load meeting";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadMeeting();
  }, [loadMeeting]);

  // Reload meeting when app comes back to foreground
  // This ensures we have the latest data even if realtime connection dropped
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      // App coming to foreground - refresh meeting data
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active"
      ) {
        console.log("App came to foreground, refreshing meeting data...");
        loadMeeting();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [loadMeeting]);

  // Subscribe to realtime updates for this meeting
  // Keep subscription active even in background to receive processing updates
  useRealtimeSubscription<Meeting>({
    table: "meetings",
    filter: id ? `id=eq.${id}` : undefined,
    events: {
      event: "UPDATE",
      handler: (payload) => {
        console.log("Realtime update received:", payload);
        if (payload.new) {
          setMeeting(payload.new as Meeting);
          setErrorMessage(null);
        }
      },
    },
    handleAppState: false, // Keep subscription active in background for processing updates
    debug: true,
  });

  const handleDiarize = async () => {
    if (!meeting) return;

    setDiarizing(true);
    try {
      console.log("Requesting speaker diarization...");
      await API.diarizeMeeting(meeting.id);

      // Refetch meeting to get updated transcript_diarized
      const updatedMeeting = await MeetingService.getMeeting(meeting.id);
      if (updatedMeeting) {
        setMeeting(updatedMeeting);
        setShowDiarized(true);
      }
    } catch (error) {
      console.error("Diarization failed:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to generate speaker labels";
      Alert.alert("Diarization Failed", message);
    } finally {
      setDiarizing(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Loading..." }} />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FF3B30" />
        </View>
      </>
    );
  }

  if (notFound || !meeting) {
    return (
      <>
        <Stack.Screen options={{ title: "Meeting Not Found" }} />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Meeting not found</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Meeting Details",
          headerRight: () => <StatusBadge status={meeting.status} />,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        {/* MeetingTitle */}
        <View style={styles.section}>
          <Text style={styles.title}>
            {meeting.title || MeetingService.formatDateTime(meeting.created_at)}
          </Text>
          <Text style={styles.date}>
            {MeetingService.formatDateTime(meeting.created_at)} <Text>• </Text>
            {meeting.duration_millis && (
              <Text style={styles.duration}>
                {MeetingService.formatDuration(meeting.duration_millis)}
              </Text>
            )}
          </Text>
        </View>

        <InlineError message={errorMessage} />

        {meeting.status === "ready" ? (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Transcript</Text>
                {meeting.transcript && (
                  <TouchableOpacity
                    style={[
                      styles.diarizeButton,
                      diarizing && styles.diarizeButtonDisabled,
                    ]}
                    onPress={
                      meeting.diarization_json || meeting.transcript_diarized
                        ? () => setShowDiarized(!showDiarized)
                        : handleDiarize
                    }
                    disabled={diarizing}
                  >
                    {diarizing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.diarizeButtonText}>
                        {meeting.diarization_json || meeting.transcript_diarized
                          ? showDiarized
                            ? "Show Raw Transcript"
                            : "Show Speaker View"
                          : "Generate Speaker Labels"}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              {showDiarized ? (
                meeting.diarization_json ? (
                  // Render structured diarization
                  <View>
                    {meeting.diarization_json.segments.map((segment, index) => {
                      const speaker = meeting.diarization_json!.speakers.find(
                        (s) => s.id === segment.speaker_id,
                      );
                      const speakerLabel = speaker?.label || "Unknown Speaker";

                      return (
                        <View key={index} style={styles.diarizedSegment}>
                          <Text style={styles.speakerLabel}>
                            {speakerLabel}
                          </Text>
                          <Text style={styles.segmentText}>{segment.text}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : meeting.transcript_diarized ? (
                  // Fallback to legacy plain-text diarization
                  <Text style={styles.contentText}>
                    {meeting.transcript_diarized}
                  </Text>
                ) : (
                  // No diarization available
                  <Text style={styles.contentText}>
                    {meeting.transcript || "No transcript available"}
                    {"\n\n"}
                    <Text style={styles.placeholder}>
                      No speaker labeling yet
                    </Text>
                  </Text>
                )
              ) : (
                // Show raw transcript
                <Text style={styles.contentText}>
                  {meeting.transcript || "No transcript available"}
                </Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Summary</Text>
              <Text style={styles.contentText}>
                {meeting.summary || "No summary available"}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.processingContainer}>
            {meeting.status === "processing" ? (
              <>
                <ActivityIndicator
                  size="large"
                  color="#2196F3"
                  style={styles.processingSpinner}
                />
                <Text style={styles.processingTitle}>Processing...</Text>
                <Text style={styles.processingText}>
                  Your meeting is being transcribed and summarized. You'll
                  receive a notification when it's ready.
                </Text>
              </>
            ) : meeting.status === "upload_failed" ? (
              <>
                <Text style={styles.errorTitle}>Upload Failed</Text>
                {jobError && <Text style={styles.errorDetail}>{jobError}</Text>}
                <Text style={styles.errorText}>
                  The audio file failed to upload. Pull down to retry or check
                  your connection.
                </Text>
              </>
            ) : meeting.status === "queued_failed" ? (
              <>
                <Text style={styles.errorTitle}>Processing Failed</Text>
                {jobError && <Text style={styles.errorDetail}>{jobError}</Text>}
                <Text style={styles.errorText}>
                  The meeting could not be queued for processing. Pull down to
                  retry.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.processingTitle}>Not Yet Processed</Text>
                <Text style={styles.processingText}>
                  This meeting is waiting to be processed. Processing will begin
                  shortly.
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
    backgroundColor: "#fff",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  date: {
    fontSize: 16,
    fontWeight: "600",
    color: "#676767",
    flex: 1,
    marginLeft: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    flex: 1,
  },
  duration: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
    alignSelf: "center",
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  diarizeButton: {
    backgroundColor: "#2196F3",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: "center",
  },
  diarizeButtonDisabled: {
    backgroundColor: "#BDBDBD",
  },
  diarizeButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  diarizedSegment: {
    marginBottom: 16,
  },
  speakerLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2196F3",
    marginBottom: 6,
  },
  segmentText: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
  },
  contentText: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
  },
  placeholder: {
    fontSize: 15,
    color: "#999",
    fontStyle: "italic",
    lineHeight: 22,
  },
  processingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  processingSpinner: {
    marginBottom: 20,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  processingText: {
    fontSize: 15,
    color: "#666",
    lineHeight: 22,
    textAlign: "center",
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FF3B30",
    marginBottom: 12,
    textAlign: "center",
  },
  errorDetail: {
    fontSize: 13,
    color: "#FF3B30",
    marginBottom: 8,
    fontFamily: "monospace",
    textAlign: "center",
  },
  errorText: {
    fontSize: 15,
    color: "#666",
    lineHeight: 22,
    textAlign: "center",
  },
});
