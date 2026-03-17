import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, Plus, FileText, Brain, Trash2, Edit, Save, X, Loader2,
  Upload, CheckCircle, Sparkles, Settings, User, Briefcase, Code,
  Mail, GraduationCap,
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

import SiteSettingsTab from "@/components/Admin/SiteSettingsTab";
import AboutTab from "@/components/Admin/AboutTab";
import ProjectsTab from "@/components/Admin/ProjectsTab";
import SkillsTab from "@/components/Admin/SkillsTab";
import ContactTab from "@/components/Admin/ContactTab";
import ExperienceTab from "@/components/Admin/ExperienceTab";
import EducationTab from "@/components/Admin/EducationTab";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  published: boolean;
  created_at: string;
}

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
  const [newPost, setNewPost] = useState({ title: "", content: "", excerpt: "" });
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [isSavingPost, setIsSavingPost] = useState(false);

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
      title: newPost.title, slug: generateSlug(newPost.title), content: newPost.content,
      excerpt: newPost.excerpt || null, author_id: user!.id, published: true, published_at: new Date().toISOString(),
    }).select("id").single();
    if (error) { toast.error("Failed to create post"); }
    else {
      toast.success("Post created!");
      setNewPost({ title: "", content: "", excerpt: "" });
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
      title: editingPost.title, content: editingPost.content, excerpt: editingPost.excerpt,
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
    <div className="min-h-screen bg-background p-6 pb-24">
      <div className="star-field" />
      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>

          <h1 className="font-display text-3xl font-bold mb-8">
            Admin <span className="text-gradient-unc">Dashboard</span>
          </h1>

          <Tabs defaultValue="settings" className="w-full">
            <TabsList className="mb-6 flex flex-wrap gap-1 h-auto">
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
                  <Input placeholder="Post Title" value={newPost.title} onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} className="bg-secondary/30" />
                  <Input placeholder="Excerpt (optional)" value={newPost.excerpt} onChange={(e) => setNewPost({ ...newPost, excerpt: e.target.value })} className="bg-secondary/30" />
                  <Textarea placeholder="Post Content" value={newPost.content} onChange={(e) => setNewPost({ ...newPost, content: e.target.value })} className="bg-secondary/30 min-h-[200px]" />
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
                  <Input value={editingPost.title} onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })} className="bg-secondary/30" />
                  <Input placeholder="Excerpt" value={editingPost.excerpt || ""} onChange={(e) => setEditingPost({ ...editingPost, excerpt: e.target.value })} className="bg-secondary/30" />
                  <Textarea value={editingPost.content} onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })} className="bg-secondary/30 min-h-[200px]" />
                  <Button onClick={handleUpdatePost} disabled={isSavingPost}>
                    {isSavingPost ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Changes
                  </Button>
                </div>
              )}
              <div className="space-y-3">
                {posts.map((post) => (
                  <div key={post.id} className="glass-panel p-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{post.title}</h4>
                      <p className="text-sm text-muted-foreground">{new Date(post.created_at).toLocaleDateString()}</p>
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
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
};

export default Admin;
