import InlineError from "@/components/InlineError";
import StatusBadge from "@/components/StatusBadge";
import * as MeetingService from "@/services/meetingService";
import { Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useId } from "./use[id]";
import { styles } from "./[id].styles";

export default function MeetingDetailScreen() {
  const { id: rawId } = useLocalSearchParams();
  // Handle case where id might be an array or undefined
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const {
    meeting,
    loading,
    notFound,
    errorMessage,
    jobError,
    diarizing,
    showDiarized,
    hasDiarization,
    diarizeButtonText,
    diarizeButtonAction,
  } = useId(id);

  // Helper to render transcript content based on current view mode
  const renderTranscriptContent = () => {
    if (!meeting) return null;

    if (showDiarized) {
      // Structured diarization available
      if (meeting.diarization_json) {
        return (
          <View>
            {meeting.diarization_json.segments.map((segment, index) => {
              const speaker = meeting.diarization_json!.speakers.find(
                (s) => s.id === segment.speaker_id,
              );
              const speakerLabel = speaker?.label || "Unknown Speaker";

              return (
                <View key={index} style={styles.diarizedSegment}>
                  <Text style={styles.speakerLabel}>{speakerLabel}</Text>
                  <Text style={styles.segmentText}>{segment.text}</Text>
                </View>
              );
            })}
          </View>
        );
      }

      // Legacy plain-text diarization
      if (meeting.transcript_diarized) {
        return (
          <Text style={styles.contentText}>
            {meeting.transcript_diarized}
          </Text>
        );
      }

      // No diarization available
      return (
        <Text style={styles.contentText}>
          {meeting.transcript || "No transcript available"}
          {"\n\n"}
          <Text style={styles.placeholder}>No speaker labeling yet</Text>
        </Text>
      );
    }

    // Show raw transcript
    return (
      <Text style={styles.contentText}>
        {meeting.transcript || "No transcript available"}
      </Text>
    );
  };

  // Helper to render status-specific content
  const renderStatusContent = () => {
    if (!meeting) return null;

    if (meeting.status === "processing") {
      return (
        <>
          <ActivityIndicator
            size="large"
            color="#2196F3"
            style={styles.processingSpinner}
          />
          <Text style={styles.processingTitle}>Processing...</Text>
          <Text style={styles.processingText}>
            Your meeting is being transcribed and summarized. You'll receive a
            notification when it's ready.
          </Text>
        </>
      );
    }

    if (meeting.status === "upload_failed") {
      return (
        <>
          <Text style={styles.errorTitle}>Upload Failed</Text>
          {jobError && <Text style={styles.errorDetail}>{jobError}</Text>}
          <Text style={styles.errorText}>
            The audio file failed to upload. Pull down to retry or check your
            connection.
          </Text>
        </>
      );
    }

    if (meeting.status === "queued_failed") {
      return (
        <>
          <Text style={styles.errorTitle}>Processing Failed</Text>
          {jobError && <Text style={styles.errorDetail}>{jobError}</Text>}
          <Text style={styles.errorText}>
            The meeting could not be queued for processing. Pull down to retry.
          </Text>
        </>
      );
    }

    return (
      <>
        <Text style={styles.processingTitle}>Not Yet Processed</Text>
        <Text style={styles.processingText}>
          This meeting is waiting to be processed. Processing will begin
          shortly.
        </Text>
      </>
    );
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
                    onPress={diarizeButtonAction}
                    disabled={diarizing}
                  >
                    {diarizing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.diarizeButtonText}>
                        {diarizeButtonText}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              {renderTranscriptContent()}
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
            {renderStatusContent()}
          </View>
        )}
      </ScrollView>
    </>
  );
}

