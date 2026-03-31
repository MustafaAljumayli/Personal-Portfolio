import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Calendar, MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import BlogArticleBody from "@/components/Blog/BlogArticleBody";
import {
  fetchBlogEngagement,
  fetchBlogPost,
  submitComment,
  submitReaction,
  type BlogEngagement,
  type BlogPost,
} from "@/lib/blog-api";
import { toast } from "sonner";

function formatDate(value: string | null, fallback: string) {
  return new Date(value ?? fallback).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPostPage() {
  const { slug = "" } = useParams();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [engagement, setEngagement] = useState<BlogEngagement>({ likes: 0, dislikes: 0, comments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [reactionSubmitting, setReactionSubmitting] = useState<"like" | "dislike" | null>(null);

  const [commentName, setCommentName] = useState("");
  const [commentEmail, setCommentEmail] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentConsent, setCommentConsent] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchBlogPost(slug), fetchBlogEngagement(slug)])
      .then(([postData, engagementData]) => {
        if (cancelled) return;
        setPost(postData);
        setEngagement(engagementData);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load this post");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, []);

  const handleReaction = async (reaction: "like" | "dislike") => {
    if (!post) return;
    setReactionSubmitting(reaction);
    try {
      const result = await submitReaction({
        slug: post.slug,
        email,
        reaction,
        consent,
      });
      setEngagement((prev) => ({ ...prev, likes: result.likes, dislikes: result.dislikes }));
      toast.success("Thanks for your feedback!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit feedback");
    } finally {
      setReactionSubmitting(null);
    }
  };

  const handleCommentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!post) return;
    setCommentSubmitting(true);
    try {
      const result = await submitComment({
        slug: post.slug,
        name: commentName,
        email: commentEmail,
        comment: commentText,
        consent: commentConsent,
      });
      toast.success(result.message);
      setCommentText("");
      setCommentName("");
      setCommentEmail("");
      setCommentConsent(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit comment");
    } finally {
      setCommentSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link to="/blog" className="text-sm text-primary hover:underline">
            Back to blog
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/privacy-policy" className="text-sm text-primary hover:underline">
              Privacy Policy
            </Link>
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl).then(() => toast.success("Link copied"));
              }}
              className="rounded-md border border-border/40 px-3 py-2 text-sm hover:bg-secondary/40"
            >
              Copy share link
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-border/30 bg-card/60 p-8 text-center text-muted-foreground">
            Loading post...
          </div>
        ) : error || !post ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error ?? "Post not found"}
          </div>
        ) : (
          <div className="space-y-8">
            <article className="rounded-2xl border border-border/40 bg-card/70 p-5 sm:p-8">
              {post.cover_image_url && (
                <img
                  src={post.cover_image_url}
                  alt={post.title}
                  className="mb-5 h-56 w-full rounded-xl border border-border/30 object-cover"
                />
              )}
              <h1 className="font-display text-3xl font-bold sm:text-4xl">{post.title}</h1>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {formatDate(post.published_at, post.created_at)}
              </p>
              <BlogArticleBody content={post.content} className="prose prose-invert mt-8 max-w-none" />
            </article>

            <section className="rounded-2xl border border-border/40 bg-card/70 p-5 sm:p-6">
              <h2 className="font-display text-2xl font-semibold">Reactions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add your email, consent, then react. Your email is used for moderation and engagement tracking.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-11 rounded-md border border-border/40 bg-background px-3 text-sm"
                />
                <label className="flex items-center gap-2 rounded-md border border-border/30 px-3 text-sm">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  I consent to my email being stored for engagement features.
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => handleReaction("like")}
                  disabled={reactionSubmitting !== null}
                  className="inline-flex items-center gap-2 rounded-md border border-border/40 px-4 py-2 text-sm hover:bg-secondary/40 disabled:opacity-60"
                >
                  <ThumbsUp className="h-4 w-4" /> Like ({engagement.likes})
                </button>
                <button
                  onClick={() => handleReaction("dislike")}
                  disabled={reactionSubmitting !== null}
                  className="inline-flex items-center gap-2 rounded-md border border-border/40 px-4 py-2 text-sm hover:bg-secondary/40 disabled:opacity-60"
                >
                  <ThumbsDown className="h-4 w-4" /> Dislike ({engagement.dislikes})
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-border/40 bg-card/70 p-5 sm:p-6">
              <h2 className="font-display text-2xl font-semibold">Comments</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Comments are moderated. If Mustafa replies, you will get an email callback.
              </p>
              <form onSubmit={handleCommentSubmit} className="mt-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={commentName}
                    onChange={(e) => setCommentName(e.target.value)}
                    placeholder="Your name"
                    className="h-11 rounded-md border border-border/40 bg-background px-3 text-sm"
                  />
                  <input
                    value={commentEmail}
                    onChange={(e) => setCommentEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-11 rounded-md border border-border/40 bg-background px-3 text-sm"
                  />
                </div>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write your comment..."
                  className="min-h-28 w-full rounded-md border border-border/40 bg-background p-3 text-sm"
                />
                <label className="flex items-start gap-2 text-sm text-muted-foreground">
                  <input className="mt-0.5" type="checkbox" checked={commentConsent} onChange={(e) => setCommentConsent(e.target.checked)} />
                  <span>
                    I consent to my email and comment being stored for moderation and replies. See{" "}
                    <Link to="/privacy-policy" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={commentSubmitting}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-70"
                >
                  {commentSubmitting ? "Submitting..." : "Submit comment"}
                </button>
              </form>

              <div className="mt-8 space-y-4">
                {engagement.comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No approved comments yet.</p>
                ) : (
                  engagement.comments.map((item) => (
                    <article key={item.id} className="rounded-lg border border-border/30 bg-background/50 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                        <MessageCircle className="h-4 w-4" />
                        <span>{item.commenter_name}</span>
                        <span>-</span>
                        <span>{new Date(item.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{item.comment_body}</p>
                      {item.admin_reply && (
                        <div className="mt-3 rounded-md border border-primary/30 bg-primary/10 p-3">
                          <p className="text-xs font-medium uppercase tracking-wide text-primary">Mustafa replied</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm">{item.admin_reply}</p>
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
