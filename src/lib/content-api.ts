import { API_BASE_URL } from "./api";
import { notifyContentUpdated } from "@/hooks/useResumeData";

export async function fetchSection<T>(section: string): Promise<T | null> {
  try {
    const sectionRes = await fetch(`${API_BASE_URL}/api/content/${section}`);
    if (sectionRes.ok) {
      return await sectionRes.json();
    }

    // Fallback for older/backlevel servers or transient section-route failures:
    // read the full content payload and extract the section client-side.
    const fullRes = await fetch(`${API_BASE_URL}/api/content`);
    if (!fullRes.ok) return null;
    const full = await fullRes.json();
    return (full?.[section] ?? null) as T | null;
  } catch {
    return null;
  }
}

export async function saveSection<T>(
  section: string,
  data: T,
  token: string
): Promise<void> {
  if (!token) {
    throw new Error("Not authenticated — please sign in again");
  }
  const res = await fetch(`${API_BASE_URL}/api/content/${section}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || "Failed to save");
  }
  notifyContentUpdated();
}
