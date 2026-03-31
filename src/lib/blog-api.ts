import { API_BASE_URL } from "@/lib/api";

export interface BlogListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published_at: string | null;
  created_at: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  published_at: string | null;
  created_at: string;
}

export interface BlogComment {
  id: string;
  commenter_name: string;
  commenter_avatar_url?: string | null;
  comment_body: string;
  parent_comment_id: string | null;
  is_mine: boolean;
  likes_count: number;
  dislikes_count: number;
  my_reaction: "like" | "dislike" | null;
  content_edited_at: string | null;
  admin_reply: string | null;
  admin_replied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogEngagement {
  likes: number;
  dislikes: number;
  my_reaction: "like" | "dislike" | null;
  comments: BlogComment[];
}

export interface BlogListResponse {
  items: BlogListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
  year: number | null;
  sort: "newest" | "oldest";
}

function buildQuery(params: Record<string, string | number | null | undefined>) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    usp.set(key, String(value));
  });
  const query = usp.toString();
  return query ? `?${query}` : "";
}

async function safeJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Request failed");
  }
  return data as T;
}

export async function requestAdminSignInCode(email: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/api/admin/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return safeJson<{ ok: true; message: string }>(res);
}

export async function verifyAdminSignInCode(email: string, password: string, code: string) {
  const res = await fetch(`${API_BASE_URL}/api/admin/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, code }),
  });
  return safeJson<{ ok: true; access_token: string; refresh_token: string }>(res);
}

export async function fetchBlogList(params: {
  q?: string;
  page?: number;
  pageSize?: number;
  year?: number | null;
  sort?: "newest" | "oldest";
}) {
  const query = buildQuery(params);
  const res = await fetch(`${API_BASE_URL}/api/blog/posts${query}`);
  return safeJson<BlogListResponse>(res);
}

export async function fetchBlogPost(slug: string) {
  const res = await fetch(`${API_BASE_URL}/api/blog/posts/${encodeURIComponent(slug)}`);
  return safeJson<BlogPost>(res);
}

export async function fetchBlogEngagement(
  slug: string,
  engagementToken?: string | null,
  adminAccessToken?: string | null
) {
  const headers: Record<string, string> = {};
  if (engagementToken) headers["x-engagement-token"] = engagementToken;
  if (adminAccessToken) headers["Authorization"] = `Bearer ${adminAccessToken}`;
  const response = await fetch(`${API_BASE_URL}/api/blog/posts/${encodeURIComponent(slug)}/engagement`, {
    headers,
  });
  return safeJson<BlogEngagement>(response);
}

export async function submitReaction(params: {
  slug: string;
  email: string;
  reaction: "like" | "dislike";
  consent: boolean;
  termsAccepted?: boolean;
  engagementToken?: string | null;
}) {
  const { slug, engagementToken, ...body } = params;
  const res = await fetch(`${API_BASE_URL}/api/blog/posts/${encodeURIComponent(slug)}/reactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(engagementToken ? { "x-engagement-token": engagementToken } : {}),
    },
    body: JSON.stringify(body),
  });
  return safeJson<{ ok: true; likes: number; dislikes: number; my_reaction: "like" | "dislike" | null }>(res);
}

export async function submitComment(params: {
  slug: string;
  name: string;
  email: string;
  comment: string;
  parentCommentId?: string | null;
  consent: boolean;
  termsAccepted?: boolean;
  engagementToken?: string | null;
}) {
  const { slug, engagementToken, ...body } = params;
  const res = await fetch(`${API_BASE_URL}/api/blog/posts/${encodeURIComponent(slug)}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(engagementToken ? { "x-engagement-token": engagementToken } : {}),
    },
    body: JSON.stringify(body),
  });
  return safeJson<{ ok: true; message: string }>(res);
}

export async function submitCommentReaction(params: {
  commentId: string;
  email: string;
  reaction: "like" | "dislike";
  consent: boolean;
  termsAccepted?: boolean;
  engagementToken?: string | null;
}) {
  const { commentId, engagementToken, ...body } = params;
  const res = await fetch(`${API_BASE_URL}/api/blog/comments/${encodeURIComponent(commentId)}/reactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(engagementToken ? { "x-engagement-token": engagementToken } : {}),
    },
    body: JSON.stringify(body),
  });
  return safeJson<{ ok: true; comment_id: string; likes_count: number; dislikes_count: number; my_reaction: "like" | "dislike" | null }>(res);
}

export interface EngagementSession {
  email: string;
  name: string;
  consentAt: string;
  avatarUrl?: string | null;
}

export async function requestEngagementCode(params: {
  email: string;
  mode: "signup" | "login";
  name?: string;
  consent?: boolean;
  termsAccepted?: boolean;
}) {
  const res = await fetch(`${API_BASE_URL}/api/engagement/auth/request-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return safeJson<{ ok: true; message: string }>(res);
}

export async function verifyEngagementCode(email: string, code: string) {
  const res = await fetch(`${API_BASE_URL}/api/engagement/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  return safeJson<{ ok: true; token: string; session: EngagementSession }>(res);
}

export async function fetchEngagementSession(token: string) {
  const res = await fetch(`${API_BASE_URL}/api/engagement/auth/session`, {
    headers: { "x-engagement-token": token },
  });
  return safeJson<EngagementSession>(res);
}

export async function updateEngagementProfile(token: string, name: string, avatarUrl?: string | null) {
  const res = await fetch(`${API_BASE_URL}/api/engagement/auth/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-engagement-token": token,
    },
    body: JSON.stringify({ name, avatarUrl: avatarUrl ?? null }),
  });
  return safeJson<{ ok: true; session: EngagementSession }>(res);
}

export async function uploadEngagementAvatar(token: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE_URL}/api/engagement/auth/profile/avatar`, {
    method: "POST",
    headers: {
      "x-engagement-token": token,
    },
    body: formData,
  });
  return safeJson<{ ok: true; avatarUrl: string; session: EngagementSession }>(res);
}

export interface MyBlogComment extends BlogComment {
  commenter_email: string;
  is_approved: boolean;
  updated_at: string;
}

export async function fetchMyComments(slug: string, engagementToken: string) {
  const res = await fetch(`${API_BASE_URL}/api/blog/posts/${encodeURIComponent(slug)}/comments/mine`, {
    headers: { "x-engagement-token": engagementToken },
  });
  return safeJson<{ items: MyBlogComment[] }>(res);
}

export async function updateMyComment(commentId: string, comment: string, engagementToken: string) {
  const res = await fetch(`${API_BASE_URL}/api/blog/comments/${encodeURIComponent(commentId)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-engagement-token": engagementToken,
    },
    body: JSON.stringify({ comment }),
  });
  return safeJson<{ ok: true; message: string }>(res);
}

export async function deleteMyComment(commentId: string, engagementToken: string) {
  const res = await fetch(`${API_BASE_URL}/api/blog/comments/${encodeURIComponent(commentId)}`, {
    method: "DELETE",
    headers: { "x-engagement-token": engagementToken },
  });
  return safeJson<{ ok: true }>(res);
}

export interface AdminBlogComment {
  id: string;
  post_id: string;
  commenter_name: string;
  commenter_email: string;
  comment_body: string;
  parent_comment_id: string | null;
  is_approved: boolean;
  admin_reply: string | null;
  admin_replied_at: string | null;
  created_at: string;
  updated_at: string;
  post: { id: string; slug: string; title: string } | null;
}

export async function fetchAdminComments(
  token: string,
  status: "all" | "pending" | "approved" = "all",
  postId?: string
) {
  const res = await fetch(`${API_BASE_URL}/api/blog/comments/admin${buildQuery({ status, postId })}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return safeJson<{ items: AdminBlogComment[] }>(res);
}

export async function approveAdminComment(token: string, commentId: string, approved: boolean) {
  const res = await fetch(`${API_BASE_URL}/api/blog/comments/${encodeURIComponent(commentId)}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ approved }),
  });
  return safeJson<{ ok: true }>(res);
}

export async function replyAdminComment(token: string, commentId: string, reply: string, approve = true) {
  const res = await fetch(`${API_BASE_URL}/api/blog/comments/${encodeURIComponent(commentId)}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ reply, approve }),
  });
  return safeJson<{ ok: true }>(res);
}

export async function deleteAdminComment(
  token: string,
  commentId: string,
  options?: { notify?: boolean; reason?: string }
) {
  const res = await fetch(`${API_BASE_URL}/api/blog/comments/${encodeURIComponent(commentId)}/admin-delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      notify: options?.notify === true,
      reason: options?.reason ?? "",
    }),
  });
  return safeJson<{ ok: true }>(res);
}

export async function updateAdminComment(token: string, commentId: string, comment: string) {
  const res = await fetch(`${API_BASE_URL}/api/blog/comments/${encodeURIComponent(commentId)}/admin-update`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ comment }),
  });
  return safeJson<{ ok: true; message: string }>(res);
}
