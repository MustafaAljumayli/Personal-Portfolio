import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, FileText, Brain, Trash2, Edit, Save, X, Loader2,
  Upload, CheckCircle, Sparkles, Settings, User, Briefcase, Code,
  Mail, GraduationCap, MoreHorizontal, ChevronDown, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api";
import { notifyContentUpdated } from "@/hooks/useResumeData";
import {
  deleteAdminComment,
  fetchAdminComments as fetchBlogAdminComments,
  replyAdminComment,
  type AdminBlogComment,
} from "@/lib/blog-api";

import SiteSettingsTab from "@/components/Admin/SiteSettingsTab";
import AboutTab from "@/components/Admin/AboutTab";
import ProjectsTab from "@/components/Admin/ProjectsTab";
import SkillsTab from "@/components/Admin/SkillsTab";
import ContactTab from "@/components/Admin/ContactTab";
import ExperienceTab from "@/components/Admin/ExperienceTab";
import EducationTab from "@/components/Admin/EducationTab";
import BlogEditor, { type BlogEditorValues } from "@/components/Admin/BlogEditor";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  published: boolean;
  created_at: string;
}

const emptyBlogPost: BlogEditorValues = {
  title: "",
  content: "",
  excerpt: "",
  cover_image_url: "",
};

interface KnowledgeItem {
  id: string;
  type: string;
  title: string;
  content: string;
}

const Admin = () => {
  const { user, session, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const token = session?.access_token ?? "";

  // Blog state
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [newPost, setNewPost] = useState<BlogEditorValues>(emptyBlogPost);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [isSavingPost, setIsSavingPost] = useState(false);
  const [adminComments, setAdminComments] = useState<AdminBlogComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentActionId, setCommentActionId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [deleteReasons, setDeleteReasons] = useState<Record<string, string>>({});
  const [openCommentMenuId, setOpenCommentMenuId] = useState<string | null>(null);
  const [moderationPanel, setModerationPanel] = useState<{ id: string; mode: "reply" | "delete-silent" | "delete-notify" } | null>(null);
  const [commentSearch, setCommentSearch] = useState("");
  const [expandedCommentThreads, setExpandedCommentThreads] = useState<Set<string>>(new Set());

  // Knowledge base state
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [newKnowledge, setNewKnowledge] = useState({ type: "bio", title: "", content: "" });
  const [isCreatingKnowledge, setIsCreatingKnowledge] = useState(false);
  const [isSavingKnowledge, setIsSavingKnowledge] = useState(false);

  // Resume upload state
  const [hasResume, setHasResume] = useState<boolean | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [parseResult, setParseResult] = useState<Record<string, unknown> | null>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      navigate("/");
    }
  }, [user, isAdmin, isLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchPosts();
      fetchKnowledge();
      checkResumeExists();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (!editingPost) {
      setAdminComments([]);
      return;
    }
    fetchCommentQueue(editingPost.id);
  }, [editingPost, isAdmin]);

  // ── Resume helpers ──
  const checkResumeExists = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/resume/download`, { method: "HEAD" });
      setHasResume(res.ok);
    } catch {
      setHasResume(false);
    }
  };

  const handleResumeUpload = async (file: File) => {
    if (file.type !== "application/pdf") { toast.error("Please upload a PDF file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return; }
    setIsUploadingResume(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/resume/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/pdf", Authorization: `Bearer ${token}` },
        body: file,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Upload failed");
      toast.success("Resume uploaded!");
      setHasResume(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploadingResume(false);
      if (resumeInputRef.current) resumeInputRef.current.value = "";
    }
  };

  const handleParseAndApply = async () => {
    setIsParsingResume(true);
    setParseResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/resume/parse-and-apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Parse failed");
      setParseResult(data?.data ?? null);
      notifyContentUpdated();
      toast.success("Resume parsed and applied to site!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Parse failed");
    } finally {
      setIsParsingResume(false);
    }
  };

  // ── Blog helpers ──
  const fetchPosts = async () => {
    const { data } = await supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
    if (data) setPosts(data);
  };

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleCreatePost = async () => {
    if (!newPost.title || !newPost.content) { toast.error("Title and content are required"); return; }
    setIsSavingPost(true);
    const { data: inserted, error } = await supabase.from("blog_posts").insert({
      title: newPost.title,
      slug: generateSlug(newPost.title),
      content: newPost.content,
      excerpt: newPost.excerpt || null,
      cover_image_url: newPost.cover_image_url || null,
      author_id: user!.id,
      published: true,
      published_at: new Date().toISOString(),
    }).select("id").single();
    if (error) { toast.error("Failed to create post"); }
    else {
      toast.success("Post created!");
      setNewPost(emptyBlogPost);
      setIsCreatingPost(false);
      fetchPosts();
      if (inserted?.id) {
        await fetch(`${API_BASE_URL}/api/rag/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mode: "blog", blogPostIds: [inserted.id] }),
        }).catch(() => {});
      }
    }
    setIsSavingPost(false);
  };

  const handleUpdatePost = async () => {
    if (!editingPost) return;
    setIsSavingPost(true);
    const { error } = await supabase.from("blog_posts").update({
      title: editingPost.title,
      content: editingPost.content,
      excerpt: editingPost.excerpt,
      cover_image_url: editingPost.cover_image_url || null,
    }).eq("id", editingPost.id);
    if (error) { toast.error("Failed to update post"); }
    else {
      toast.success("Post updated!");
      setEditingPost(null);
      fetchPosts();
      await fetch(`${API_BASE_URL}/api/rag/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: "blog", blogPostIds: [editingPost.id] }),
      }).catch(() => {});
    }
    setIsSavingPost(false);
  };

  const handleDeletePost = async (id: string) => {
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) toast.error("Failed to delete post");
    else { toast.success("Post deleted"); fetchPosts(); }
  };

  const fetchCommentQueue = async (postId?: string) => {
    if (!token) return;
    setIsLoadingComments(true);
    try {
      const result = await fetchBlogAdminComments(token, "all", postId);
      setAdminComments(result.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load comments");
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleReplyComment = async (commentId: string) => {
    const reply = (replyDrafts[commentId] ?? "").trim();
    if (!reply) {
      toast.error("Write a reply first");
      return;
    }
    setCommentActionId(commentId);
    try {
      await replyAdminComment(token, commentId, reply, true);
      toast.success("Reply posted to thread and emailed");
      setReplyDrafts((prev) => ({ ...prev, [commentId]: "" }));
      setModerationPanel(null);
      await fetchCommentQueue(editingPost?.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setCommentActionId(null);
    }
  };

  const handleDeleteComment = async (commentId: string, notify: boolean) => {
    setCommentActionId(commentId);
    try {
      await deleteAdminComment(token, commentId, {
        notify,
        reason: deleteReasons[commentId] ?? "",
      });
      toast.success(notify ? "Comment deleted and user notified" : "Comment deleted silently");
      setModerationPanel(null);
      await fetchCommentQueue(editingPost?.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete comment");
    } finally {
      setCommentActionId(null);
    }
  };

  const openModerationPanel = (commentId: string, mode: "reply" | "delete-silent" | "delete-notify") => {
    setOpenCommentMenuId(null);
    setModerationPanel({ id: commentId, mode });
  };

  const toggleCommentThread = (commentId: string) => {
    setExpandedCommentThreads((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const adminCommentChildren = useMemo(() => {
    const map = new Map<string | null, AdminBlogComment[]>();
    for (const item of adminComments) {
      const key = item.parent_comment_id ?? null;
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [adminComments]);

  const filteredCommentIds = useMemo(() => {
    const query = commentSearch.trim().toLowerCase();
    if (!query) return new Set(adminComments.map((c) => c.id));

    const byId = new Map(adminComments.map((c) => [c.id, c]));
    const directMatches = adminComments.filter((c) =>
      `${c.comment_body} ${c.commenter_name} ${c.commenter_email}`.toLowerCase().includes(query)
    );
    const included = new Set<string>();

    const includeDescendants = (id: string) => {
      const children = adminCommentChildren.get(id) ?? [];
      for (const child of children) {
        if (included.has(child.id)) continue;
        included.add(child.id);
        includeDescendants(child.id);
      }
    };

    for (const match of directMatches) {
      included.add(match.id);
      includeDescendants(match.id);
      let parentId = match.parent_comment_id;
      while (parentId) {
        if (included.has(parentId)) break;
        included.add(parentId);
        parentId = byId.get(parentId)?.parent_comment_id ?? null;
      }
    }

    return included;
  }, [adminCommentChildren, adminComments, commentSearch]);

  const renderAdminCommentThread = (parentId: string | null, depth = 0): JSX.Element[] => {
    const items = (adminCommentChildren.get(parentId) ?? []).filter((item) => filteredCommentIds.has(item.id));
    return items.map((item) => {
      const childCount = (adminCommentChildren.get(item.id) ?? []).filter((c) => filteredCommentIds.has(c.id)).length;
      const isRootExpanded = commentSearch.trim() ? true : expandedCommentThreads.has(item.id);
      return (
        <div
          key={item.id}
          className="rounded-lg border border-border/40 p-3 bg-background/50"
          style={{ marginLeft: depth > 0 ? `${Math.min(depth, 4) * 14}px` : 0 }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{new Date(item.created_at).toLocaleString()}</span>
              <span>{item.commenter_name} ({item.commenter_email})</span>
            </div>
            <div className="relative">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setOpenCommentMenuId((prev) => (prev === item.id ? null : item.id))}
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
              {openCommentMenuId === item.id && (
                <div className="absolute right-0 top-8 z-20 min-w-40 rounded-md border border-border/40 bg-card/95 p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => openModerationPanel(item.id, "reply")}
                    className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-secondary/60"
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => openModerationPanel(item.id, "delete-silent")}
                    className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-secondary/60"
                  >
                    Delete Silently
                  </button>
                  <button
                    type="button"
                    onClick={() => openModerationPanel(item.id, "delete-notify")}
                    className="block w-full rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-secondary/60"
                  >
                    Delete + Notify
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm">{item.comment_body}</p>
          {moderationPanel?.id === item.id && moderationPanel.mode === "reply" && (
            <div className="mt-2 space-y-2 rounded-md border border-border/30 bg-secondary/10 p-3">
              <Textarea
                value={replyDrafts[item.id] ?? ""}
                onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                placeholder="Write a threaded reply"
                className="bg-secondary/20 min-h-[84px]"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleReplyComment(item.id)} disabled={commentActionId === item.id}>
                  Reply
                </Button>
                <Button size="sm" variant="outline" onClick={() => setModerationPanel(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {moderationPanel?.id === item.id && (moderationPanel.mode === "delete-silent" || moderationPanel.mode === "delete-notify") && (
            <div className="mt-2 space-y-2 rounded-md border border-border/30 bg-secondary/10 p-3">
              <Input
                value={deleteReasons[item.id] ?? ""}
                onChange={(e) => setDeleteReasons((prev) => ({ ...prev, [item.id]: e.target.value }))}
                placeholder="Optional moderation reason"
                className="bg-secondary/20"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={moderationPanel.mode === "delete-notify" ? "destructive" : "outline"}
                  onClick={() => handleDeleteComment(item.id, moderationPanel.mode === "delete-notify")}
                  disabled={commentActionId === item.id}
                >
                  {moderationPanel.mode === "delete-notify" ? "Delete + Notify" : "Delete Silently"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setModerationPanel(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {depth === 0 && childCount > 0 && (
            <button
              type="button"
              onClick={() => toggleCommentThread(item.id)}
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {isRootExpanded ? (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Hide thread
                </>
              ) : (
                <>
                  <ChevronRight className="h-3.5 w-3.5" />
                  Show thread ({childCount} replies)
                </>
              )}
            </button>
          )}
          {(depth > 0 || isRootExpanded) && renderAdminCommentThread(item.id, depth + 1)}
        </div>
      );
    });
  };

  // ── Knowledge helpers ──
  const fetchKnowledge = async () => {
    const { data } = await supabase.from("ai_knowledge").select("*").order("created_at", { ascending: false });
    if (data) setKnowledge(data);
  };

  const handleCreateKnowledge = async () => {
    if (!newKnowledge.title || !newKnowledge.content) { toast.error("Title and content are required"); return; }
    setIsSavingKnowledge(true);
    const { data: inserted, error } = await supabase.from("ai_knowledge").insert({
      type: newKnowledge.type, title: newKnowledge.title, content: newKnowledge.content,
    }).select("id").single();
    if (error) { toast.error("Failed to add knowledge"); }
    else {
      toast.success("Knowledge added!");
      setNewKnowledge({ type: "bio", title: "", content: "" });
      setIsCreatingKnowledge(false);
      fetchKnowledge();
      if (inserted?.id) {
        await fetch(`${API_BASE_URL}/api/rag/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mode: "knowledge", knowledgeIds: [inserted.id] }),
        }).catch(() => {});
      }
    }
    setIsSavingKnowledge(false);
  };

  const handleSyncSiteDataForRag = async () => {
    setIsSavingKnowledge(true);
    try {
      const contentRes = await fetch(`${API_BASE_URL}/api/content`);
      const content = contentRes.ok ? await contentRes.json() : {};
      const prof = content.profile ?? {};
      const exp = content.experience ?? [];
      const edu = content.education ?? [];
      const skills = content.skillCategories ?? [];
      const projs = content.projects ?? [];

      const profileText = `${prof.name ?? ""}\n${prof.headline ?? ""}\n${prof.location ?? ""}\n${prof.email ?? ""}\n${prof.website ?? ""}\n${prof.linkedin ?? ""}\n${prof.github ?? ""}\n${prof.twitter ?? ""}`;
      const resumeText =
        `${content.summary ?? ""}\n\nExperience:\n` +
        exp.map((e: any) => `- ${e.title} @ ${e.company} (${e.period}): ${(e.bullets ?? []).join("; ")}`).join("\n") +
        `\n\nEducation:\n` +
        edu.map((e: any) => `- ${e.degree} — ${e.school} (${e.period})`).join("\n") +
        `\n\nSkills:\n` +
        skills.map((c: any) => `${c.title}: ${(c.skills ?? []).join(", ")}`).join("\n");
      const projectsText =
        `Projects:\n` +
        projs.map((p: any) => `- ${p.title}: ${(p.bullets ?? [p.description ?? ""]).join("; ")} (Tech: ${(p.tech ?? []).join(", ")})`).join("\n");

      const res = await fetch(`${API_BASE_URL}/api/rag/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: "seed", seed: { profileText, resumeText, projectsText } }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "RAG sync failed");
      toast.success("RAG index updated from site data");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sync site data");
    } finally {
      setIsSavingKnowledge(false);
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    const { error } = await supabase.from("ai_knowledge").delete().eq("id", id);
    if (error) toast.error("Failed to delete knowledge");
    else { toast.success("Knowledge deleted"); fetchKnowledge(); }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background">
      <div className="star-field" />
      <div className="max-w-4xl mx-auto relative z-10 flex flex-col flex-1 min-h-0 w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col flex-1 min-h-0"
        >
          <Tabs defaultValue="settings" className="flex flex-col flex-1 min-h-0 w-full">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
              <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/40 px-4 sm:px-6 pt-4 sm:pt-6 pb-3">
                <button
                  onClick={() => navigate("/")}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Home
                </button>

                <h1 className="font-display text-2xl sm:text-3xl font-bold mb-4">
                  Admin <span className="text-gradient-unc">Dashboard</span>
                </h1>

                <TabsList className="flex flex-wrap gap-1 h-auto w-full justify-start">
              <TabsTrigger value="settings" className="gap-1.5 text-xs">
                <Settings className="w-3.5 h-3.5" /> Site
              </TabsTrigger>
              <TabsTrigger value="about" className="gap-1.5 text-xs">
                <User className="w-3.5 h-3.5" /> About
              </TabsTrigger>
              <TabsTrigger value="experience" className="gap-1.5 text-xs">
                <Briefcase className="w-3.5 h-3.5" /> Experience
              </TabsTrigger>
              <TabsTrigger value="education" className="gap-1.5 text-xs">
                <GraduationCap className="w-3.5 h-3.5" /> Education
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-1.5 text-xs">
                <Briefcase className="w-3.5 h-3.5" /> Projects
              </TabsTrigger>
              <TabsTrigger value="skills" className="gap-1.5 text-xs">
                <Code className="w-3.5 h-3.5" /> Skills
              </TabsTrigger>
              <TabsTrigger value="contact" className="gap-1.5 text-xs">
                <Mail className="w-3.5 h-3.5" /> Contact
              </TabsTrigger>
              <TabsTrigger value="resume" className="gap-1.5 text-xs">
                <Upload className="w-3.5 h-3.5" /> Resume
              </TabsTrigger>
              <TabsTrigger value="blog" className="gap-1.5 text-xs">
                <FileText className="w-3.5 h-3.5" /> Blog
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="gap-1.5 text-xs">
                <Brain className="w-3.5 h-3.5" /> AI
              </TabsTrigger>
            </TabsList>
              </div>

              <div className="px-4 sm:px-6 pb-20 pt-4 [&_[role=tabpanel]]:!mt-0">
            {/* ── Site Settings ── */}
            <TabsContent value="settings">
              <SiteSettingsTab token={token} />
            </TabsContent>

            {/* ── About ── */}
            <TabsContent value="about">
              <AboutTab token={token} />
            </TabsContent>

            {/* ── Experience ── */}
            <TabsContent value="experience">
              <ExperienceTab token={token} />
            </TabsContent>

            {/* ── Education ── */}
            <TabsContent value="education">
              <EducationTab token={token} />
            </TabsContent>

            {/* ── Projects ── */}
            <TabsContent value="projects">
              <ProjectsTab token={token} />
            </TabsContent>

            {/* ── Skills ── */}
            <TabsContent value="skills">
              <SkillsTab token={token} />
            </TabsContent>

            {/* ── Contact ── */}
            <TabsContent value="contact">
              <ContactTab token={token} />
            </TabsContent>

            {/* ── Resume PDF ── */}
            <TabsContent value="resume" className="space-y-6">
              <div className="glass-panel p-6 space-y-4">
                <h3 className="font-display font-semibold text-lg">Resume PDF</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your resume PDF. Visitors will download this file when they click the PDF button in the Resume section.
                </p>
                {hasResume && (
                  <div className="flex items-center gap-2 text-sm text-green-400">
                    <CheckCircle className="w-4 h-4" /> Resume uploaded
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <input ref={resumeInputRef} type="file" accept="application/pdf"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f); }}
                    className="hidden"
                  />
                  <Button onClick={() => resumeInputRef.current?.click()} disabled={isUploadingResume} className="gap-2">
                    {isUploadingResume ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {hasResume ? "Replace Resume" : "Upload Resume"}
                  </Button>
                  {hasResume && (
                    <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE_URL}/api/resume/download`, "_blank")}>
                      Preview
                    </Button>
                  )}
                </div>
                {hasResume && (
                  <div className="border-t border-border/30 pt-4 mt-4 space-y-3">
                    <h4 className="font-display font-semibold">Auto-Update Site</h4>
                    <p className="text-sm text-muted-foreground">
                      Parse your uploaded resume with AI and update experience, education, skills, and projects automatically.
                    </p>
                    <Button onClick={handleParseAndApply} disabled={isParsingResume} variant="secondary" className="gap-2">
                      {isParsingResume ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {isParsingResume ? "Parsing resume..." : "Parse & Update Site"}
                    </Button>
                    {parseResult && (
                      <div className="mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-400">
                        <p className="font-semibold mb-1">Site updated successfully!</p>
                        <p className="text-green-400/70">
                          Parsed {(parseResult as any).experience?.length ?? 0} experience,{" "}
                          {(parseResult as any).education?.length ?? 0} education,{" "}
                          {(parseResult as any).skillCategories?.length ?? 0} skills, and{" "}
                          {(parseResult as any).projects?.length ?? 0} projects.
                          Refresh to see changes.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Blog ── */}
            <TabsContent value="blog" className="space-y-6">
              {isCreatingPost ? (
                <div className="glass-panel p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold">New Post</h3>
                    <Button variant="ghost" size="icon" onClick={() => setIsCreatingPost(false)}><X className="w-4 h-4" /></Button>
                  </div>
                  <BlogEditor values={newPost} onChange={setNewPost} token={token} autoFocus />
                  <Button onClick={handleCreatePost} disabled={isSavingPost}>
                    {isSavingPost ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Publish Post
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setIsCreatingPost(true)} className="gap-2"><Plus className="w-4 h-4" /> New Post</Button>
              )}
              {editingPost && (
                <div className="glass-panel p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold">Edit Post</h3>
                    <Button variant="ghost" size="icon" onClick={() => setEditingPost(null)}><X className="w-4 h-4" /></Button>
                  </div>
                  <BlogEditor
                    values={{
                      title: editingPost.title,
                      excerpt: editingPost.excerpt ?? "",
                      content: editingPost.content,
                      cover_image_url: editingPost.cover_image_url ?? "",
                    }}
                    onChange={(next) =>
                      setEditingPost((prev) =>
                        prev
                          ? {
                              ...prev,
                              title: next.title,
                              excerpt: next.excerpt || null,
                              content: next.content,
                              cover_image_url: next.cover_image_url || null,
                            }
                          : null
                      )
                    }
                    token={token}
                  />
                  <Button onClick={handleUpdatePost} disabled={isSavingPost}>
                    {isSavingPost ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Changes
                  </Button>

                  <div className="rounded-lg border border-border/40 p-4 bg-secondary/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-display font-semibold">Comments for this post</h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchCommentQueue(editingPost.id)}
                        disabled={isLoadingComments}
                      >
                        Refresh
                      </Button>
                    </div>
                    {isLoadingComments ? (
                      <p className="text-sm text-muted-foreground">Loading comments...</p>
                    ) : adminComments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No comments on this post yet.</p>
                    ) : (
                      <div className="space-y-3">
                        <Input
                          value={commentSearch}
                          onChange={(e) => setCommentSearch(e.target.value)}
                          placeholder="Search comments by content or user"
                          className="bg-secondary/20"
                        />
                        {renderAdminCommentThread(null)}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-3">
                {posts.map((post) => (
                  <div key={post.id} className="glass-panel p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1 flex items-center gap-4">
                      {post.cover_image_url ? (
                        <a
                          href={post.cover_image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-24 h-16 rounded-md overflow-hidden border border-border/40 shrink-0"
                        >
                          <img
                            src={post.cover_image_url}
                            alt={`${post.title} cover`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </a>
                      ) : (
                        <div className="w-24 h-16 rounded-md border border-dashed border-border/40 shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">
                          No cover
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-semibold">{post.title}</h4>
                        <p className="text-sm text-muted-foreground">{new Date(post.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setEditingPost(post)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeletePost(post.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ── AI Knowledge ── */}
            <TabsContent value="knowledge" className="space-y-6">
              <p className="text-muted-foreground text-sm">Add information about yourself that the AI chatbot will use to answer questions.</p>
              <Button variant="secondary" onClick={handleSyncSiteDataForRag} disabled={isSavingKnowledge} className="gap-2">
                {isSavingKnowledge ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                Sync & Reindex from Site Data
              </Button>
              {isCreatingKnowledge ? (
                <div className="glass-panel p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold">Add Knowledge</h3>
                    <Button variant="ghost" size="icon" onClick={() => setIsCreatingKnowledge(false)}><X className="w-4 h-4" /></Button>
                  </div>
                  <select value={newKnowledge.type} onChange={(e) => setNewKnowledge({ ...newKnowledge, type: e.target.value })}
                    className="w-full p-2 rounded-lg bg-secondary/30 border border-border/50">
                    <option value="bio">Bio</option>
                    <option value="resume">Resume</option>
                    <option value="custom">Custom</option>
                  </select>
                  <Input placeholder="Title (e.g., 'Work Experience')" value={newKnowledge.title} onChange={(e) => setNewKnowledge({ ...newKnowledge, title: e.target.value })} className="bg-secondary/30" />
                  <Textarea placeholder="Content (the information the AI will learn)" value={newKnowledge.content} onChange={(e) => setNewKnowledge({ ...newKnowledge, content: e.target.value })} className="bg-secondary/30 min-h-[150px]" />
                  <Button onClick={handleCreateKnowledge} disabled={isSavingKnowledge}>
                    {isSavingKnowledge ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Knowledge
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setIsCreatingKnowledge(true)} className="gap-2"><Plus className="w-4 h-4" /> Add Knowledge</Button>
              )}
              <div className="space-y-3">
                {knowledge.map((item) => (
                  <div key={item.id} className="glass-panel p-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary uppercase">{item.type}</span>
                        <h4 className="font-semibold">{item.title}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{item.content}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteKnowledge(item.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {knowledge.length === 0 && (
                  <div className="glass-panel p-8 text-center text-muted-foreground">No knowledge added yet.</div>
                )}
              </div>
            </TabsContent>
              </div>
            </div>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default Admin;
