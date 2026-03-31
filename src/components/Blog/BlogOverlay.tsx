import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Calendar, ChevronDown, ChevronRight, Clock, MoreHorizontal, Search, Shield, ThumbsDown, ThumbsUp, User, X } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import BlogArticleBody from "@/components/Blog/BlogArticleBody";
import { estimateReadMinutesMarkdown } from "@/lib/blogReadTime";
import {
  deleteAdminComment,
  deleteMyComment,
  fetchBlogEngagement,
  fetchBlogList,
  fetchBlogPost,
  submitCommentReaction,
  submitComment,
  submitReaction,
  type BlogComment,
  type BlogListItem,
  type BlogPost,
  updateAdminComment,
  updateMyComment,
} from "@/lib/blog-api";
import { clearStoredEngagementSession, getStoredEngagementSession, validateStoredEngagementSession } from "@/lib/engagement-session";
import { blogInnerVariants, blogListVariants, blogShellVariants } from "@/lib/uiMotion";
import { toast } from "sonner";

interface BlogOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  routeSlug?: string | null;
}

const BlogOverlay = ({ isVisible, onClose, routeSlug }: BlogOverlayProps) => {
  const { user, isAdmin, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10) || 1;
  const q = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") === "oldest" ? "oldest" : "newest";
  const year = searchParams.get("year");

  const [listItems, setListItems] = useState<BlogListItem[]>([]);
  const [listTotalPages, setListTotalPages] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingPost, setIsLoadingPost] = useState(false);
  const [searchInput, setSearchInput] = useState(q);

  const [reactionSubmitting, setReactionSubmitting] = useState<"like" | "dislike" | null>(null);
  const [myReaction, setMyReaction] = useState<"like" | "dislike" | null>(null);
  const [engagementToken, setEngagementToken] = useState<string | null>(null);
  const [engagementName, setEngagementName] = useState<string>("");
  const [engagementEmail, setEngagementEmail] = useState<string>("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [isCommentComposerOpen, setIsCommentComposerOpen] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [adminDeleteSubmittingId, setAdminDeleteSubmittingId] = useState<string | null>(null);
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(null);
  const [expandedRootThreads, setExpandedRootThreads] = useState<Set<string>>(new Set());
  const [avatarPreview, setAvatarPreview] = useState<{
    imageUrl: string | null;
    initial: string;
    seed: string;
    name: string;
  } | null>(null);
  const adminAccessToken = user && isAdmin ? (session?.access_token ?? null) : null;

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, idx) => current - idx);
  }, []);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  useEffect(() => {
    if (!isVisible) return;
    if (user && isAdmin) {
      clearStoredEngagementSession();
      setEngagementToken(null);
      setEngagementName("");
      setEngagementEmail("");
      return;
    }
    const stored = getStoredEngagementSession();
    if (!stored) {
      setEngagementToken(null);
      setEngagementName("");
      setEngagementEmail("");
      return;
    }
    validateStoredEngagementSession().then((result) => {
      if (!result) {
        setEngagementToken(null);
        setEngagementName("");
        setEngagementEmail("");
        return;
      }
      setEngagementToken(result.token);
      setEngagementName(result.session.name);
      setEngagementEmail(result.session.email);
    });
  }, [isVisible, isAdmin, user]);

  useEffect(() => {
    if (!avatarPreview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAvatarPreview(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [avatarPreview]);

  useEffect(() => {
    if (!isVisible || routeSlug) return;
    let cancelled = false;
    setIsLoadingList(true);
    fetchBlogList({
      page,
      pageSize: 6,
      q: q || undefined,
      year: year ? Number.parseInt(year, 10) : null,
      sort,
    })
      .then((result) => {
        if (cancelled) return;
        setListItems(result.items);
        setListTotalPages(result.totalPages);
        setListTotal(result.total);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load blog posts");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingList(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isVisible, page, q, routeSlug, sort, year]);

  useEffect(() => {
    if (!isVisible || !routeSlug) {
      setSelectedPost(null);
      setComments([]);
      setLikes(0);
      setDislikes(0);
      setMyReaction(null);
      return;
    }
    let cancelled = false;
    setIsLoadingPost(true);
    Promise.all([fetchBlogPost(routeSlug), fetchBlogEngagement(routeSlug, engagementToken, adminAccessToken)])
      .then(([post, engagement]) => {
        if (cancelled) return;
        setSelectedPost(post);
        setComments(engagement.comments);
        setLikes(engagement.likes);
        setDislikes(engagement.dislikes);
        setMyReaction(engagement.my_reaction);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load blog post");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPost(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adminAccessToken, engagementToken, isVisible, routeSlug]);

  const setParams = (next: Record<string, string | null>) => {
    const merged = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (!value) merged.delete(key);
      else merged.set(key, value);
    });
    setSearchParams(merged, { replace: false });
  };

  const onSubmitSearch = (e: FormEvent) => {
    e.preventDefault();
    setParams({ q: searchInput.trim() || null, page: "1" });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const absMs = Math.abs(diffMs);

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const month = 30 * day;
    const year = 365 * day;
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

    if (absMs < minute) return "just now";
    if (absMs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
    if (absMs < day) return rtf.format(Math.round(diffMs / hour), "hour");
    if (absMs < month) return rtf.format(Math.round(diffMs / day), "day");
    if (absMs < year) return rtf.format(Math.round(diffMs / month), "month");
    return rtf.format(Math.round(diffMs / year), "year");
  };

  const getInitialAvatarStyle = (seed: string) => {
    let hash = 0;
    for (let idx = 0; idx < seed.length; idx += 1) {
      hash = (hash * 31 + seed.charCodeAt(idx)) | 0;
    }
    const hue = Math.abs(hash) % 360;
    return {
      backgroundColor: `hsl(${hue} 68% 42%)`,
      color: "hsl(0 0% 100%)",
    };
  };

  const onOpenPost = (slug: string) => {
    navigate(`/blog/${encodeURIComponent(slug)}`);
  };

  const onBackToList = () => {
    navigate("/blog");
  };

  const redirectToEngagementAuth = () => {
    if (user && isAdmin) {
      toast.error("Sign out of admin account before using engagement sign-in.");
      return;
    }
    navigate("/auth");
  };

  const onReaction = async (reaction: "like" | "dislike") => {
    if (!selectedPost) return;
    const adminActor = !!(user && isAdmin && user.email);
    if (!engagementToken && !adminActor) {
      redirectToEngagementAuth();
      return;
    }
    setReactionSubmitting(reaction);
    try {
      const response = await submitReaction({
        slug: selectedPost.slug,
        email: engagementToken ? engagementEmail : (user?.email ?? ""),
        reaction,
        consent: true,
        termsAccepted: true,
        engagementToken: engagementToken ?? null,
      });
      setLikes(response.likes);
      setDislikes(response.dislikes);
      setMyReaction(response.my_reaction);
      toast.success("Thanks for your feedback!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit reaction");
    } finally {
      setReactionSubmitting(null);
    }
  };

  const onSubmitComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPost) return;
    const adminActor = !!(user && isAdmin && user.email);
    if (!engagementToken && !adminActor) {
      redirectToEngagementAuth();
      return;
    }
    setCommentSubmitting(true);
    try {
      const response = await submitComment({
        slug: selectedPost.slug,
        name: engagementToken
          ? engagementName
          : `${((user?.user_metadata?.display_name as string | undefined) ||
              user?.email?.split("@")[0] ||
              "Admin")} (Admin)`,
        email: engagementToken ? engagementEmail : (user?.email ?? ""),
        comment: commentBody,
        parentCommentId: replyToCommentId,
        consent: true,
        termsAccepted: true,
        engagementToken: engagementToken ?? null,
      });
      toast.success(response.message);
      setCommentBody("");
      setReplyToCommentId(null);
      setIsCommentComposerOpen(false);
      const refreshed = await fetchBlogEngagement(selectedPost.slug, engagementToken, adminAccessToken);
      setComments(refreshed.comments);
      setLikes(refreshed.likes);
      setDislikes(refreshed.dislikes);
      setMyReaction(refreshed.my_reaction);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit comment");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const openCommentComposer = (parentCommentId: string | null) => {
    const adminActor = !!(user && isAdmin && user.email);
    if (!engagementToken && !adminActor) {
      redirectToEngagementAuth();
      return;
    }
    setReplyToCommentId(parentCommentId);
    setCommentBody("");
    setIsCommentComposerOpen(true);
  };

  const closeCommentComposer = () => {
    setReplyToCommentId(null);
    setCommentBody("");
    setIsCommentComposerOpen(false);
  };

  const toggleRootThread = (commentId: string) => {
    setExpandedRootThreads((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const onCommentReaction = async (commentId: string, reaction: "like" | "dislike") => {
    const adminActor = !!(user && isAdmin && user.email);
    if (!engagementToken && !adminActor) {
      redirectToEngagementAuth();
      return;
    }
    try {
      const response = await submitCommentReaction({
        commentId,
        email: engagementToken ? engagementEmail : (user?.email ?? ""),
        reaction,
        consent: true,
        termsAccepted: true,
        engagementToken: engagementToken ?? null,
      });
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                likes_count: response.likes_count,
                dislikes_count: response.dislikes_count,
                my_reaction: response.my_reaction,
              }
            : comment
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to react to comment");
    }
  };

  const onEditMyComment = (comment: BlogComment) => {
    setEditingCommentId(comment.id);
    setEditingCommentBody(comment.comment_body);
  };

  const onSaveMyComment = async () => {
    if (!routeSlug || !editingCommentId) return;
    const adminActor = !!(user && isAdmin && session?.access_token);
    if (!engagementToken && !adminActor) return;
    try {
      const result = adminActor
        ? await updateAdminComment(session.access_token, editingCommentId, editingCommentBody)
        : await updateMyComment(editingCommentId, editingCommentBody, engagementToken as string);
      toast.success(result.message);
      setEditingCommentId(null);
      setEditingCommentBody("");
      const refreshed = await fetchBlogEngagement(routeSlug, engagementToken, adminAccessToken);
      setComments(refreshed.comments);
      setLikes(refreshed.likes);
      setDislikes(refreshed.dislikes);
      setMyReaction(refreshed.my_reaction);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update comment");
    }
  };

  const onDeleteMyComment = async (commentId: string) => {
    if (!routeSlug || !engagementToken) return;
    try {
      await deleteMyComment(commentId, engagementToken);
      toast.success("Comment deleted");
      const refreshed = await fetchBlogEngagement(routeSlug, engagementToken, adminAccessToken);
      setComments(refreshed.comments);
      setLikes(refreshed.likes);
      setDislikes(refreshed.dislikes);
      setMyReaction(refreshed.my_reaction);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete comment");
    }
  };

  const refreshEngagementState = async (slug: string) => {
    const refreshed = await fetchBlogEngagement(slug, engagementToken, adminAccessToken);
    setComments(refreshed.comments);
    setLikes(refreshed.likes);
    setDislikes(refreshed.dislikes);
    setMyReaction(refreshed.my_reaction);
  };

  const onAdminDeleteComment = async (commentId: string) => {
    if (!routeSlug || !session?.access_token) return;
    setAdminDeleteSubmittingId(commentId);
    try {
      await deleteAdminComment(session.access_token, commentId, { notify: false });
      toast.success("Comment deleted");
      await refreshEngagementState(routeSlug);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete comment");
    } finally {
      setAdminDeleteSubmittingId(null);
    }
  };

  const commentChildren = useMemo(() => {
    const map = new Map<string | null, BlogComment[]>();
    for (const item of comments) {
      const key = item.parent_comment_id ?? null;
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [comments]);

  const renderCommentThread = (parentId: string | null, depth = 0): JSX.Element[] => {
    const items = commentChildren.get(parentId) ?? [];
    const INDENT_PER_LEVEL_PX = 10;

    return items.map((item) => {
      const isNested = depth > 0;
      return (
      <article
        key={item.id}
        className={isNested ? "mt-2 border-l border-border/35 pl-2 sm:pl-3" : "rounded-lg border border-border/30 bg-background/50 p-3"}
        style={isNested ? { marginLeft: `${depth * INDENT_PER_LEVEL_PX}px` } : undefined}
      >
        <div className={isNested ? "rounded-md border border-border/20 bg-background/35 p-3" : ""}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {item.commenter_avatar_url ? (
              <button
                type="button"
                onClick={() =>
                  setAvatarPreview({
                    imageUrl: item.commenter_avatar_url ?? null,
                    initial: (item.commenter_name || "U").trim().charAt(0).toUpperCase(),
                    seed: item.commenter_name || "unknown",
                    name: item.commenter_name.replace(/\s*\(Admin\)\s*$/, ""),
                  })
                }
                className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full border border-border/50"
                aria-label={`Open ${item.commenter_name} profile photo`}
              >
                <img
                  src={item.commenter_avatar_url}
                  alt={`${item.commenter_name} avatar`}
                  className="h-8 w-8 object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  setAvatarPreview({
                    imageUrl: null,
                    initial: (item.commenter_name || "U").trim().charAt(0).toUpperCase(),
                    seed: item.commenter_name || "unknown",
                    name: item.commenter_name.replace(/\s*\(Admin\)\s*$/, ""),
                  })
                }
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-border/50 text-[11px] font-semibold"
                style={getInitialAvatarStyle(item.commenter_name || "unknown")}
                aria-label={`Open ${item.commenter_name} profile avatar`}
              >
                {(item.commenter_name || "U").trim().charAt(0).toUpperCase()}
              </button>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                <p className="font-medium">{item.commenter_name.replace(/\s*\(Admin\)\s*$/, "")}</p>
                {/\(Admin\)\s*$/.test(item.commenter_name) && (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <Shield className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Admin</span>
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <span
                  className="whitespace-nowrap text-xs text-muted-foreground"
                  title={new Date(item.created_at).toLocaleString()}
                >
                  {formatRelativeTime(item.created_at)}
                </span>
                {item.content_edited_at && (
                  <span className="text-[10px] uppercase text-muted-foreground/80">(edited)</span>
                )}
              </div>
            </div>
          </div>
          {((item.is_mine || (user && isAdmin)) && (engagementToken || (user && isAdmin))) && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenCommentMenuId((prev) => (prev === item.id ? null : item.id))}
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                aria-label="More comment actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {openCommentMenuId === item.id && (
                <div className="absolute right-0 top-7 z-20 min-w-28 rounded-md border border-border/40 bg-card/95 p-1 shadow-lg">
                  {(item.is_mine || (user && isAdmin)) && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenCommentMenuId(null);
                        onEditMyComment(item);
                      }}
                      className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-secondary/60"
                    >
                      Edit
                    </button>
                  )}
                  {(item.is_mine || (user && isAdmin)) && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenCommentMenuId(null);
                        if (user && isAdmin) {
                          void onAdminDeleteComment(item.id);
                        } else {
                          void onDeleteMyComment(item.id);
                        }
                      }}
                      className="block w-full rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-secondary/60"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.comment_body}</p>
        {item.admin_reply && (
          <div className="mt-2 rounded-md border border-primary/30 bg-primary/10 p-2">
            <p className="text-xs font-medium uppercase text-primary">Mustafa replied</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{item.admin_reply}</p>
          </div>
        )}
        {(engagementToken || (user && isAdmin)) && (
          <div className="mt-2 flex items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => onCommentReaction(item.id, "like")}
              className={`inline-flex items-center gap-1 hover:underline ${item.my_reaction === "like" ? "text-primary" : "text-muted-foreground"}`}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              <span>{item.likes_count ?? 0}</span>
            </button>
            <button
              type="button"
              onClick={() => onCommentReaction(item.id, "dislike")}
              className={`inline-flex items-center gap-1 hover:underline ${item.my_reaction === "dislike" ? "text-destructive" : "text-muted-foreground"}`}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
              <span>{item.dislikes_count ?? 0}</span>
            </button>
            <button
              type="button"
              onClick={() => openCommentComposer(item.id)}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              Reply
            </button>
          </div>
        )}
        {editingCommentId === item.id && (
          <div className="mt-2 space-y-2">
            <textarea
              value={editingCommentBody}
              onChange={(e) => setEditingCommentBody(e.target.value)}
              className="min-h-20 w-full rounded-md border border-border/40 bg-background p-2 text-sm"
            />
            <div className="flex gap-2">
              <button onClick={onSaveMyComment} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
                Save
              </button>
              <button
                onClick={() => {
                  setEditingCommentId(null);
                  setEditingCommentBody("");
                }}
                className="rounded-md border border-border/40 px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {isCommentComposerOpen && replyToCommentId === item.id && (
          <form onSubmit={onSubmitComment} className="mt-2 space-y-2 rounded-md border border-border/30 bg-background/40 p-3">
            <textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Write a comment..."
              className="min-h-20 w-full rounded-md border border-border/40 bg-background p-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={commentSubmitting}
                className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-70"
              >
                {commentSubmitting ? "Submitting..." : "Submit comment"}
              </button>
              <button
                type="button"
                onClick={closeCommentComposer}
                className="rounded-md border border-border/40 px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        {depth === 0 && (commentChildren.get(item.id)?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => toggleRootThread(item.id)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {expandedRootThreads.has(item.id) ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Hide thread
              </>
            ) : (
              <>
                <ChevronRight className="h-3.5 w-3.5" />
                Show thread ({commentChildren.get(item.id)?.length ?? 0} replies)
              </>
            )}
          </button>
        )}
        {(depth > 0 || expandedRootThreads.has(item.id)) && renderCommentThread(item.id, depth + 1)}
        </div>
      </article>
    )});
  };

  const shouldRenderListCovers = isVisible && !routeSlug;
  const shouldRenderPostCover = isVisible && !!routeSlug;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="blog-overlay"
          variants={blogShellVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+5.5rem)] bottom-[8vh] z-30 px-4 sm:px-6 md:bottom-[14vh] md:top-[10vh] max-md:[@media(orientation:landscape)]:z-[60] max-md:[@media(orientation:landscape)]:bottom-[2vh] max-md:[@media(orientation:landscape)]:top-[calc(env(safe-area-inset-top)+4rem)]"
        >
      <div className="h-full max-w-5xl mx-auto overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-xl">
        <div className="h-full overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8">
          <AnimatePresence mode="wait">
            {routeSlug ? (
              // Single Post View
              <motion.div
                key="post"
                variants={blogInnerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <button
                  onClick={onBackToList}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Blog
                </button>

                {isLoadingPost || !selectedPost ? (
                  <div className="glass-panel p-8 text-center text-muted-foreground">Loading post...</div>
                ) : (
                  <article className="glass-panel p-4 sm:p-8 flex flex-col gap-4">
                  {shouldRenderPostCover && selectedPost?.cover_image_url && (
                    <div className="order-1 md:order-3 w-full h-44 sm:h-52 md:h-64 rounded-lg overflow-hidden bg-secondary/30 flex items-center justify-center">
                      <img
                        src={selectedPost?.cover_image_url}
                        alt={selectedPost?.title}
                        className="w-full h-full object-contain"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  )}

                  <h1
                    className={`font-display text-3xl sm:text-3xl md:text-4xl font-bold ${selectedPost?.cover_image_url ? "order-2 md:order-1" : ""}`}
                  >
                    {selectedPost?.title}
                  </h1>

                  <div
                    className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:text-sm text-muted-foreground ${selectedPost?.cover_image_url ? "order-3 md:order-2" : ""}`}
                  >
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(selectedPost?.published_at || selectedPost?.created_at || new Date().toISOString())}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {estimateReadMinutesMarkdown(selectedPost?.content || "")} min read
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span>Author: Mustafa Aljumayli</span>
                    </span>
                  </div>
                  <BlogArticleBody
                    content={selectedPost?.content || ""}
                    className={`prose prose-invert prose-lg max-w-none text-foreground/90 [&_p]:text-base [&_p]:leading-[1.8] sm:[&_p]:text-[1.05rem] ${selectedPost?.cover_image_url ? "order-4" : ""}`}
                  />
                  </article>
                )}

                {selectedPost && (
                  <section className="mt-6 glass-panel p-4 sm:p-6 space-y-5">
                    <h3 className="font-display text-2xl font-semibold">Engage</h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onReaction("like")}
                        disabled={reactionSubmitting !== null}
                        className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm disabled:opacity-60 ${
                          myReaction === "like"
                            ? "border-primary/70 bg-primary/20 text-primary"
                            : "border-border/40 hover:bg-secondary/40"
                        }`}
                      >
                        <ThumbsUp className="w-4 h-4" /> {myReaction === "like" ? "Unlike" : "Like"} ({likes})
                      </button>
                      <button
                        onClick={() => onReaction("dislike")}
                        disabled={reactionSubmitting !== null}
                        className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm disabled:opacity-60 ${
                          myReaction === "dislike"
                            ? "border-destructive/70 bg-destructive/15 text-destructive"
                            : "border-border/40 hover:bg-secondary/40"
                        }`}
                      >
                        <ThumbsDown className="w-4 h-4" /> {myReaction === "dislike" ? "Undislike" : "Dislike"} ({dislikes})
                      </button>
                    </div>

                    <div className="space-y-3 border-t border-border/30 pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="font-display text-xl font-semibold">Comments</h4>
                        <button
                          type="button"
                          onClick={() => openCommentComposer(null)}
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                        >
                          Add comment
                        </button>
                      </div>
                    </div>

                    {isCommentComposerOpen && replyToCommentId === null && (
                      <form onSubmit={onSubmitComment} className="space-y-2 rounded-md border border-border/30 bg-background/40 p-3">
                        <textarea
                          value={commentBody}
                          onChange={(e) => setCommentBody(e.target.value)}
                          placeholder="Write a comment..."
                          className="min-h-24 w-full rounded-md border border-border/40 bg-background p-3 text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={commentSubmitting}
                            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-70"
                          >
                            {commentSubmitting ? "Submitting..." : "Submit comment"}
                          </button>
                          <button
                            type="button"
                            onClick={closeCommentComposer}
                            className="rounded-md border border-border/40 px-3 py-1.5 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="space-y-3">
                      {comments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No comments yet.</p>
                      ) : (
                        renderCommentThread(null)
                      )}
                    </div>
                  </section>
                )}
              </motion.div>
            ) : (
              // Blog List View
              <motion.div
                key="list"
                variants={blogListVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="font-display text-3xl sm:text-3xl md:text-4xl font-bold">
                      <span className="text-gradient-unc">Blog</span>
                    </h2>
                    <p className="text-base text-muted-foreground mt-1">
                      Thoughts, tutorials, and insights
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Link to="/privacy-policy" className="text-sm text-primary hover:underline">
                      Privacy Policy
                    </Link>
                    <Link to="/terms-and-conditions" className="text-sm text-primary hover:underline">
                      Terms
                    </Link>
                    <button
                      onClick={onClose}
                      aria-label="Close blog"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/50 text-foreground transition-colors hover:bg-secondary"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <form onSubmit={onSubmitSearch} className="mb-5 grid gap-2 md:grid-cols-12">
                  <label className="relative md:col-span-6">
                    <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <input
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Search by title or excerpt..."
                      className="h-11 w-full rounded-md border border-border/40 bg-background pl-9 pr-3 text-sm outline-none ring-primary/40 focus:ring-2"
                    />
                  </label>
                  <select
                    className="h-11 rounded-md border border-border/40 bg-background px-3 text-sm md:col-span-2"
                    value={sort}
                    onChange={(e) => setParams({ sort: e.target.value, page: "1" })}
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                  </select>
                  <select
                    className="h-11 rounded-md border border-border/40 bg-background px-3 text-sm md:col-span-2"
                    value={year ?? ""}
                    onChange={(e) => setParams({ year: e.target.value || null, page: "1" })}
                  >
                    <option value="">All years</option>
                    {yearOptions.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground md:col-span-2">
                    Search
                  </button>
                </form>

                {isLoadingList ? (
                  <div className="grid gap-6">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="glass-panel p-6 animate-pulse"
                      >
                        <div className="h-6 bg-secondary/50 rounded w-3/4 mb-4" />
                        <div className="h-4 bg-secondary/30 rounded w-full mb-2" />
                        <div className="h-4 bg-secondary/30 rounded w-2/3" />
                      </div>
                    ))}
                  </div>
                ) : listItems.length === 0 ? (
                  <div className="glass-panel p-12 text-center">
                    <p className="text-muted-foreground">
                      No blog posts yet. Check back soon!
                    </p>
                  </div>
                ) : (
                  <>
                  <div className="mb-3 text-sm text-muted-foreground">
                    Showing {listItems.length} of {listTotal} posts
                  </div>
                  <div className="grid gap-6">
                    {listItems.map((post, index) => (
                      <motion.article
                        key={post.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => onOpenPost(post.slug)}
                        className="glass-panel p-6 cursor-pointer hover:border-primary/50 transition-all group"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:gap-6 md:items-start">
                          {shouldRenderListCovers && post.cover_image_url && (
                            <div className="w-full h-40 md:w-32 md:h-24 rounded-lg overflow-hidden flex-shrink-0 bg-secondary/30">
                              <img
                                src={post.cover_image_url}
                                alt={post.title}
                                className="w-full h-full object-contain md:object-cover group-hover:scale-105 transition-transform"
                                loading="lazy"
                                decoding="async"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-display text-2xl sm:text-xl font-semibold group-hover:text-primary transition-colors">
                              {post.title}
                            </h3>
                            {post.excerpt && (
                              <p className="text-base text-muted-foreground mt-2 line-clamp-2">
                                {post.excerpt}
                              </p>
                            )}
                            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(post.published_at || post.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.article>
                    ))}
                  </div>
                  <div className="mt-6 flex items-center justify-center gap-3">
                    <button
                      disabled={page <= 1}
                      onClick={() => setParams({ page: String(page - 1) })}
                      className="rounded-md border border-border/40 px-3 py-2 text-sm disabled:opacity-60"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-muted-foreground">
                      Page {page} of {listTotalPages}
                    </span>
                    <button
                      disabled={page >= listTotalPages}
                      onClick={() => setParams({ page: String(page + 1) })}
                      className="rounded-md border border-border/40 px-3 py-2 text-sm disabled:opacity-60"
                    >
                      Next
                    </button>
                  </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
        </motion.div>
      )}
      {isVisible && avatarPreview && (
        <motion.div
          key="comment-avatar-preview"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setAvatarPreview(null)}
        >
          <div
            className="relative flex flex-col items-center gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setAvatarPreview(null)}
              className="absolute -right-2 -top-2 rounded-full bg-background/80 p-1.5 text-foreground shadow"
              aria-label="Close avatar preview"
            >
              <X className="h-4 w-4" />
            </button>
            {avatarPreview.imageUrl ? (
              <img
                src={avatarPreview.imageUrl}
                alt={`${avatarPreview.name} avatar`}
                className="h-44 w-44 rounded-full border border-border/40 object-cover shadow-xl sm:h-56 sm:w-56"
              />
            ) : (
              <div
                className="flex h-44 w-44 items-center justify-center rounded-full border border-border/40 text-5xl font-semibold shadow-xl sm:h-56 sm:w-56"
                style={getInitialAvatarStyle(avatarPreview.seed)}
              >
                {avatarPreview.initial}
              </div>
            )}
            <p className="text-sm text-white/90">{avatarPreview.name}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BlogOverlay;