import { API_BASE_URL } from "./api";

export async function fetchSection<T>(section: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/content/${section}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function saveSection<T>(
  section: string,
  data: T,
  token: string
): Promise<void> {
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
}
