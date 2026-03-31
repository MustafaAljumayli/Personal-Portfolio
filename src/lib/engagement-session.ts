import { fetchEngagementSession, type EngagementSession } from "@/lib/blog-api";

const STORAGE_KEY = "engagement_session_v1";

export interface StoredEngagementSession {
  token: string;
  session: EngagementSession;
}

export function getStoredEngagementSession(): StoredEngagementSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredEngagementSession;
    if (!parsed?.token || !parsed?.session?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredEngagementSession(value: StoredEngagementSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event("engagement-session-changed"));
}

export function clearStoredEngagementSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("engagement-session-changed"));
}

export async function validateStoredEngagementSession() {
  const stored = getStoredEngagementSession();
  if (!stored) return null;
  try {
    const session = await fetchEngagementSession(stored.token);
    const next = { token: stored.token, session };
    setStoredEngagementSession(next);
    return next;
  } catch {
    clearStoredEngagementSession();
    return null;
  }
}
