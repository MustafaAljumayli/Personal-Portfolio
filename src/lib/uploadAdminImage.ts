import { API_BASE_URL } from "@/lib/api";

/** Reuses blog-images bucket + admin route (same MIME limits). */
export async function uploadAdminImage(file: File, token: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE_URL}/api/blog/upload-image`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Upload failed");
  if (!data?.url) throw new Error("No image URL returned");
  return data.url as string;
}
