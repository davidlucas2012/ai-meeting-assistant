import { useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface EventHandler<T extends Record<string, any> = any> {
  /** The event type to listen for */
  event: RealtimeEvent;
  /** Callback when this event occurs */
  handler: (payload: RealtimePostgresChangesPayload<T>) => void;
}

export interface RealtimeSubscriptionConfig<T extends Record<string, any> = any> {
  /** The database table to subscribe to */
  table: string;
  /** The database schema (default: 'public') */
  schema?: string;
  /** Filter string (e.g., 'id=eq.123') */
  filter?: string;
  /**
   * Event handlers - can be a single event or array of events to handle
   * For single event: { event: 'UPDATE', handler: (payload) => {...} }
   * For multiple events: [{ event: 'INSERT', handler: ... }, { event: 'UPDATE', handler: ... }]
   */
  events: EventHandler<any> | EventHandler<any>[];
  /** Callback when subscription status changes */
  onStatusChange?: (status: string) => void;
  /** Whether to automatically unsubscribe when app goes to background (default: true) */
  handleAppState?: boolean;
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Custom channel name (auto-generated if not provided) */
  channelName?: string;
}

/**
 * Custom hook for managing Supabase realtime subscriptions
 *
 * Features:
 * - Automatic subscription/unsubscription
 * - AppState management (unsubscribe on background, resubscribe on foreground)
 * - Cleanup on unmount
 * - Type-safe payload handling
 * - Support for multiple event types on a single channel
 *
 * @example
 * Single event:
 * ```tsx
 * useRealtimeSubscription({
 *   table: 'meetings',
 *   events: { event: 'UPDATE', handler: (payload) => setMeeting(payload.new) },
 *   filter: `id=eq.${meetingId}`,
 * });
 * ```
 *
 * Multiple events:
 * ```tsx
 * useRealtimeSubscription({
 *   table: 'meetings',
 *   events: [
 *     { event: 'INSERT', handler: (payload) => addMeeting(payload.new) },
 *     { event: 'UPDATE', handler: (payload) => updateMeeting(payload.new) },
 *   ],
 *   filter: `user_id=eq.${userId}`,
 * });
 * ```
 */
export function useRealtimeSubscription<T extends Record<string, any> = any>({
  table,
  schema = 'public',
  filter,
  events,
  onStatusChange,
  handleAppState = true,
  debug = false,
  channelName,
}: RealtimeSubscriptionConfig<T>) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  // Store the latest event handlers in a ref to avoid recreating subscriptions
  const eventHandlersRef = useRef(events);

  // Update the ref when events change, but don't trigger resubscription
  useEffect(() => {
    eventHandlersRef.current = events;
  }, [events]);

  const log = useCallback((...args: any[]) => {
    if (debug) {
      console.log('[useRealtimeSubscription]', ...args);
    }
  }, [debug]);

  // Helper to unsubscribe from realtime
  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      log('Unsubscribing from realtime updates');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, [log]);

  // Helper to subscribe to realtime
  const subscribe = useCallback(() => {
    if (!table) {
      log('No table specified, skipping subscription');
      return;
    }

    // Skip if filter is explicitly undefined or empty (waiting for data like userId)
    if (filter === undefined || filter === '') {
      log(`Filter is ${filter === undefined ? 'undefined' : 'empty'}, skipping subscription (waiting for filter value)`);
      return;
    }

    // Clean up existing subscription first
    unsubscribe();

    log(`Setting up subscription for table: ${table}, filter: ${filter}`);

    // Generate channel name
    const generatedChannelName = channelName || (filter
      ? `${table}-${filter.replace(/[^a-zA-Z0-9]/g, '-')}`
      : `${table}-all`);

    // Get current event handlers from ref
    const currentEvents = eventHandlersRef.current;
    const eventHandlers = Array.isArray(currentEvents) ? currentEvents : [currentEvents];

    log(`Subscribing to ${generatedChannelName} (table: ${table}, events: ${eventHandlers.map(e => e.event).join(', ')}, filter: ${filter || 'none'})`);

    // Start building the channel
    let channel = supabase.channel(generatedChannelName);

    // Add event listeners for each event type
    eventHandlers.forEach(({ event }) => {
      channel = channel.on(
        'postgres_changes',
        {
          event,
          schema,
          table,
          ...(filter && { filter }),
        },
        (payload) => {
          log(`Realtime ${event} received:`, payload);
          // Always use the latest handler from the ref
          const latestEvents = eventHandlersRef.current;
          const latestHandlers = Array.isArray(latestEvents) ? latestEvents : [latestEvents];
          // Find the matching handler by event type (more robust than index)
          const handler = latestHandlers.find(h => h.event === event);
          if (handler) {
            log(`Calling handler for ${event} event`);
            handler.handler(payload as RealtimePostgresChangesPayload<T>);
          } else {
            log(`No handler found for ${event} event`);
          }
        }
      );
    });

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        log('Realtime subscription active');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        log('Realtime subscription failed:', status);
      }
      onStatusChange?.(status);
    });

    channelRef.current = channel;
  }, [table, schema, filter, onStatusChange, unsubscribe, log, channelName]);

  // AppState listener: unsubscribe on background, resubscribe on foreground
  useEffect(() => {
    if (!handleAppState) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      // App going to background - unsubscribe to avoid connection errors
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        log('App going to background, unsubscribing from realtime');
        unsubscribe();
      }

      // App coming to foreground - resubscribe
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        log('App came to foreground, resubscribing to realtime');
        subscribe();
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [subscribe, unsubscribe, handleAppState, log]);

  // Subscribe to realtime updates on mount
  useEffect(() => {
    subscribe();

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [subscribe, unsubscribe]);

  return {
    /** Manually trigger resubscription */
    resubscribe: subscribe,
    /** Manually unsubscribe */
    unsubscribe,
  };
}
