import { useEffect, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { apiGet } from './api';
import { useAuth } from '../store/auth';
import type { RealtimeEvent } from './types';

type LivePosition = { lat: number; lng: number; at: string; orderId?: string | null };

/**
 * Live rider positions, fed by the event feed and consumed by the tracking map.
 * Kept outside react-query because it changes every few seconds.
 */
export const useLiveRiders = create<{
  positions: Record<string, LivePosition>;
  set: (runnerId: string, position: LivePosition) => void;
  clear: () => void;
}>((set) => ({
  positions: {},
  set: (runnerId, position) => set((state) => ({ positions: { ...state.positions, [runnerId]: position } })),
  clear: () => set({ positions: {} }),
}));

const POLL_MS = 5_000;

async function fetchEvents(since: number) {
  return apiGet<{ events: RealtimeEvent[]; cursor: number }>(`/realtime/events?since=${since}`);
}

/**
 * Authorized polling loop: five seconds while the tab is visible, paused when it
 * is hidden, and it resumes from the last seen id so nothing is missed.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const token = useAuth((state) => state.token);
  const queryClient = useQueryClient();
  const cursor = useRef(0);
  const setPosition = useLiveRiders((state) => state.set);

  useEffect(() => {
    if (!token) return;
    let stopped = false;
    let timer: number | undefined;

    const handle = (event: RealtimeEvent) => {
      const payload = event.payload as { orderId?: string; runnerId?: string; lat?: number; lng?: number };

      switch (event.event) {
        case 'rider:location':
          if (payload.runnerId && payload.lat != null && payload.lng != null) {
            setPosition(payload.runnerId, {
              lat: payload.lat,
              lng: payload.lng,
              at: event.createdAt,
              orderId: payload.orderId ?? null,
            });
          }
          break;
        case 'order:updated':
        case 'order:created':
          void queryClient.invalidateQueries({ queryKey: ['orders'] });
          if (payload.orderId) void queryClient.invalidateQueries({ queryKey: ['order', payload.orderId] });
          void queryClient.invalidateQueries({ queryKey: ['merchant', 'orders'] });
          void queryClient.invalidateQueries({ queryKey: ['runner', 'deliveries'] });
          void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
          break;
        case 'chat:message':
          if (payload.orderId) void queryClient.invalidateQueries({ queryKey: ['order', payload.orderId] });
          break;
        case 'notification':
          void queryClient.invalidateQueries({ queryKey: ['notifications'] });
          break;
        case 'shop:updated':
          void queryClient.invalidateQueries({ queryKey: ['shops'] });
          void queryClient.invalidateQueries({ queryKey: ['merchant', 'shop'] });
          break;
        default:
          break;
      }
    };

    const tick = async () => {
      if (stopped) return;
      try {
        const data = await fetchEvents(cursor.current);
        for (const event of data.events) handle(event);
        if (typeof data.cursor === 'number') cursor.current = data.cursor;
      } catch {
        /* transient errors are fine — the next tick retries */
      } finally {
        if (!stopped) timer = window.setTimeout(tick, POLL_MS);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        window.clearTimeout(timer);
        void tick();
      }
    };

    void tick();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [token, queryClient, setPosition]);

  return <>{children}</>;
}
