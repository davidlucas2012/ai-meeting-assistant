# Custom Hooks

This directory contains reusable React hooks for the application.

## `useRealtimeSubscription`

A custom hook for managing Supabase realtime subscriptions with built-in lifecycle management.

### Features

- ✅ Automatic subscription/unsubscription
- ✅ AppState management (unsubscribe on background, resubscribe on foreground)
- ✅ Cleanup on unmount
- ✅ Type-safe payload handling
- ✅ Support for multiple event types on a single channel
- ✅ Debug logging option

### Usage

#### Single Event Subscription

```tsx
import { useRealtimeSubscription } from '@/hooks';
import type { Meeting } from '@/services/meetingService';

function MeetingDetailScreen({ meetingId }: { meetingId: string }) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);

  useRealtimeSubscription<Meeting>({
    table: 'meetings',
    filter: `id=eq.${meetingId}`,
    events: {
      event: 'UPDATE',
      handler: (payload) => {
        if (payload.new) {
          setMeeting(payload.new);
        }
      },
    },
    debug: true, // Enable debug logging
  });

  return <div>{/* Your component */}</div>;
}
```

#### Multiple Event Subscriptions

```tsx
import { useRealtimeSubscription } from '@/hooks';
import type { MeetingListItem } from '@/services/meetingService';

function MeetingsListScreen({ userId }: { userId: string }) {
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);

  useRealtimeSubscription<MeetingListItem>({
    table: 'meetings',
    filter: `user_id=eq.${userId}`,
    channelName: 'meetings-list', // Optional custom channel name
    events: [
      {
        event: 'INSERT',
        handler: (payload) => {
          if (payload.new) {
            setMeetings((prev) => [payload.new, ...prev]);
          }
        },
      },
      {
        event: 'UPDATE',
        handler: (payload) => {
          if (payload.new) {
            setMeetings((prev) =>
              prev.map((m) => (m.id === payload.new.id ? payload.new : m))
            );
          }
        },
      },
      {
        event: 'DELETE',
        handler: (payload) => {
          if (payload.old) {
            setMeetings((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        },
      },
    ],
  });

  return <div>{/* Your component */}</div>;
}
```

#### Listen to All Events

```tsx
useRealtimeSubscription({
  table: 'meetings',
  events: {
    event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
    handler: (payload) => {
      console.log('Event type:', payload.eventType);
      console.log('New data:', payload.new);
      console.log('Old data:', payload.old);
    },
  },
});
```

### API

#### Configuration Options

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `table` | `string` | Yes | - | The database table to subscribe to |
| `events` | `EventHandler \| EventHandler[]` | Yes | - | Event handler(s) for the subscription |
| `schema` | `string` | No | `'public'` | The database schema |
| `filter` | `string` | No | - | Filter string (e.g., `'id=eq.123'`) |
| `channelName` | `string` | No | Auto-generated | Custom channel name |
| `onStatusChange` | `(status: string) => void` | No | - | Callback when subscription status changes |
| `handleAppState` | `boolean` | No | `true` | Auto-manage subscriptions on app background/foreground |
| `debug` | `boolean` | No | `false` | Enable debug logging |

#### Event Handler

```typescript
interface EventHandler<T> {
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  handler: (payload: RealtimePostgresChangesPayload<T>) => void;
}
```

#### Return Value

```typescript
{
  resubscribe: () => void;  // Manually trigger resubscription
  unsubscribe: () => void;  // Manually unsubscribe
}
```

### Best Practices

1. **Always provide a filter** when possible to reduce unnecessary updates
2. **Use type parameters** for type-safe payload handling
3. **Enable debug mode** during development to troubleshoot subscription issues
4. **Handle undefined filters** - the hook will skip subscription if filter is undefined
5. **Clean state updates** - use functional state updates when modifying arrays/objects

### Migration Example

**Before (without hook):**

```tsx
const channelRef = useRef<RealtimeChannel | null>(null);
const appState = useRef<AppStateStatus>(AppState.currentState);

const unsubscribeRealtime = useCallback(() => {
  if (channelRef.current) {
    supabase.removeChannel(channelRef.current);
    channelRef.current = null;
  }
}, []);

const subscribeRealtime = useCallback(() => {
  unsubscribeRealtime();

  const channel = supabase
    .channel(`meeting-${id}`)
    .on('postgres_changes', { event: 'UPDATE', table: 'meetings', filter: `id=eq.${id}` },
      (payload) => setMeeting(payload.new)
    )
    .subscribe();

  channelRef.current = channel;
}, [id]);

useEffect(() => {
  subscribeRealtime();
  return () => unsubscribeRealtime();
}, [subscribeRealtime, unsubscribeRealtime]);

useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextAppState) => {
    if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
      unsubscribeRealtime();
    }
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      subscribeRealtime();
    }
    appState.current = nextAppState;
  });
  return () => subscription.remove();
}, [subscribeRealtime, unsubscribeRealtime]);
```

**After (with hook):**

```tsx
useRealtimeSubscription({
  table: 'meetings',
  filter: id ? `id=eq.${id}` : undefined,
  events: {
    event: 'UPDATE',
    handler: (payload) => {
      if (payload.new) setMeeting(payload.new);
    },
  },
});
```

Much cleaner! 🎉
