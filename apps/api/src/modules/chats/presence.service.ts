import { Injectable } from "@nestjs/common";

/**
 * MVP in-memory presence:
 * - Client sends presence.ping every ~20–30s while app is foregrounded.
 * - Online if last ping within ONLINE_WINDOW_MS.
 * - “idle” if within IDLE_WINDOW_MS but outside ONLINE window.
 */
@Injectable()
export class PresenceService {
  private lastPingByUser = new Map<string, number>();

  private ONLINE_WINDOW_MS = 60_000; // 60s
  private IDLE_WINDOW_MS = 5 * 60_000; // 5m

  notePing(userId: string) {
    this.lastPingByUser.set(userId, Date.now());
  }

  getPresence(userId: string) {
    const last = this.lastPingByUser.get(userId) ?? 0;
    const age = Date.now() - last;

    if (!last) {
      return { userId, status: "offline" as const, lastSeenAt: null as string | null };
    }

    if (age <= this.ONLINE_WINDOW_MS) {
      return { userId, status: "online" as const, lastSeenAt: new Date(last).toISOString() };
    }

    if (age <= this.IDLE_WINDOW_MS) {
      return { userId, status: "idle" as const, lastSeenAt: new Date(last).toISOString() };
    }

    return { userId, status: "offline" as const, lastSeenAt: new Date(last).toISOString() };
  }
}