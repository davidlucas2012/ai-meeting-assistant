import { useCallback, useEffect, useRef, useState } from "react";
import type { AppStateStatus } from "react-native";
import { Alert, AppState } from "react-native";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import * as API from "@/lib/api";
import type { Meeting } from "@/services/meetingService";
import * as MeetingService from "@/services/meetingService";
import * as QueueService from "@/services/queueService";

export function useId(id: string | undefined) {
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

  const toggleDiarizedView = () => {
    setShowDiarized(!showDiarized);
  };

  // Derived values for cleaner component rendering
  const hasDiarization = Boolean(meeting?.diarization_json || meeting?.transcript_diarized);

  const getDiarizeButtonText = (): string => {
    if (!hasDiarization) {
      return "Generate Speaker Labels";
    }
    return showDiarized ? "Show Raw Transcript" : "Show Speaker View";
  };

  const getDiarizeButtonAction = () => {
    return hasDiarization ? toggleDiarizedView : handleDiarize;
  };

  return {
    meeting,
    loading,
    notFound,
    errorMessage,
    jobError,
    diarizing,
    showDiarized,
    hasDiarization,
    diarizeButtonText: getDiarizeButtonText(),
    diarizeButtonAction: getDiarizeButtonAction(),
    handleDiarize,
    toggleDiarizedView,
  };
}
