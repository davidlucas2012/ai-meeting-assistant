import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';

const DUMMY_MEETINGS = [
  { id: '1', title: 'Client Call - Project Kickoff', date: '2024-02-10' },
  { id: '2', title: 'Team Standup', date: '2024-02-11' },
];

export default function MeetingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meetings</Text>
      <View style={styles.listContainer}>
        {DUMMY_MEETINGS.map((meeting) => (
          <Link key={meeting.id} href={`/meeting/${meeting.id}`} asChild>
            <TouchableOpacity style={styles.meetingItem}>
              <Text style={styles.meetingTitle}>{meeting.title}</Text>
              <Text style={styles.meetingDate}>{meeting.date}</Text>
            </TouchableOpacity>
          </Link>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  listContainer: {
    flex: 1,
  },
  meetingItem: {
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 10,
  },
  meetingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  meetingDate: {
    fontSize: 14,
    color: '#666',
  },
});
