import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
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
