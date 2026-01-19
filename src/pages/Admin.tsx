import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, FileText, Brain, Trash2, Edit, Save, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { resumeEducation, resumeExperience, resumeProfile, resumeSkillCategories, resumeSummary } from "@/data/resume";
import { projects } from "@/data/projects";

const API_BASE_URL =
  ((import.meta.env.VITE_API_BASE_URL as string | undefined) ??
    (import.meta.env.VITE_CONTACT_API_BASE_URL as string | undefined) ??
    "").replace(/\/+$/, "");

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

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      navigate("/");
    }
  }, [user, isAdmin, isLoading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchPosts();
      fetchKnowledge();
    }
  }, [isAdmin]);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setPosts(data);
  };

  const fetchKnowledge = async () => {
    const { data } = await supabase
      .from("ai_knowledge")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setKnowledge(data);
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleCreatePost = async () => {
    if (!newPost.title || !newPost.content) {
      toast.error("Title and content are required");
      return;
    }

    setIsSavingPost(true);
    const { data: inserted, error } = await supabase.from("blog_posts").insert({
      title: newPost.title,
      slug: generateSlug(newPost.title),
      content: newPost.content,
      excerpt: newPost.excerpt || null,
      author_id: user!.id,
      published: true,
      published_at: new Date().toISOString(),
    }).select("id").single();

    if (error) {
      toast.error("Failed to create post");
    } else {
      toast.success("Post created!");
      setNewPost({ title: "", content: "", excerpt: "" });
      setIsCreatingPost(false);
      fetchPosts();

      // Re-index published posts for RAG
      if (inserted?.id) {
        if (!session?.access_token) throw new Error("Missing auth session");
        await fetch(`${API_BASE_URL}/api/rag/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ mode: "blog", blogPostIds: [inserted.id] }),
        }).then(async (r) => {
          const data = await r.json().catch(() => null);
          if (!r.ok) throw new Error(data?.error || "RAG sync failed");
        });
      }
    }
    setIsSavingPost(false);
  };

  const handleUpdatePost = async () => {
    if (!editingPost) return;

    setIsSavingPost(true);
    const { error } = await supabase
      .from("blog_posts")
      .update({
        title: editingPost.title,
        content: editingPost.content,
        excerpt: editingPost.excerpt,
      })
      .eq("id", editingPost.id);

    if (error) {
      toast.error("Failed to update post");
    } else {
      toast.success("Post updated!");
      setEditingPost(null);
      fetchPosts();

      // Re-index this post
      if (!session?.access_token) throw new Error("Missing auth session");
      await fetch(`${API_BASE_URL}/api/rag/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ mode: "blog", blogPostIds: [editingPost.id] }),
      }).then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) throw new Error(data?.error || "RAG sync failed");
      });
    }
    setIsSavingPost(false);
  };

  const handleDeletePost = async (id: string) => {
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete post");
    } else {
      toast.success("Post deleted");
      fetchPosts();
    }
  };

  const handleCreateKnowledge = async () => {
    if (!newKnowledge.title || !newKnowledge.content) {
      toast.error("Title and content are required");
      return;
    }

    setIsSavingKnowledge(true);
    const { data: inserted, error } = await supabase.from("ai_knowledge").insert({
      type: newKnowledge.type,
      title: newKnowledge.title,
      content: newKnowledge.content,
    }).select("id").single();

    if (error) {
      toast.error("Failed to add knowledge");
    } else {
      toast.success("Knowledge added!");
      setNewKnowledge({ type: "bio", title: "", content: "" });
      setIsCreatingKnowledge(false);
      fetchKnowledge();

      // Index the new knowledge item
      if (inserted?.id) {
        if (!session?.access_token) throw new Error("Missing auth session");
        await fetch(`${API_BASE_URL}/api/rag/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ mode: "knowledge", knowledgeIds: [inserted.id] }),
        }).then(async (r) => {
          const data = await r.json().catch(() => null);
          if (!r.ok) throw new Error(data?.error || "RAG sync failed");
        });
      }
    }
    setIsSavingKnowledge(false);
  };

  const handleSyncSiteDataForRag = async () => {
    setIsSavingKnowledge(true);
    try {
      const profileText = `${resumeProfile.name}\n${resumeProfile.headline}\n${resumeProfile.location}\n${resumeProfile.email}\n${resumeProfile.website}\n${resumeProfile.linkedin}\n${resumeProfile.github}\n${resumeProfile.twitter}`;
      const resumeText =
        `${resumeSummary}\n\nExperience:\n` +
        resumeExperience.map((e) => `- ${e.title} @ ${e.company} (${e.period}): ${e.description}`).join("\n") +
        `\n\nEducation:\n` +
        resumeEducation.map((e) => `- ${e.degree} — ${e.school} (${e.period})`).join("\n") +
        `\n\nSkills:\n` +
        resumeSkillCategories.map((c) => `${c.title}: ${c.skills.join(", ")}`).join("\n");
      const projectsText =
        `Projects:\n` +
        projects
          .map((p) => `- ${p.title}: ${p.description} (Tech: ${p.tech.join(", ")})`)
          .join("\n");

      if (!session?.access_token) throw new Error("Missing auth session");
      const res = await fetch(`${API_BASE_URL}/api/rag/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
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
    if (error) {
      toast.error("Failed to delete knowledge");
    } else {
      toast.success("Knowledge deleted");
      fetchKnowledge();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="star-field" />

      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
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

          <Tabs defaultValue="blog" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="blog" className="gap-2">
                <FileText className="w-4 h-4" />
                Blog Posts
              </TabsTrigger>
              <TabsTrigger value="knowledge" className="gap-2">
                <Brain className="w-4 h-4" />
                AI Knowledge
              </TabsTrigger>
            </TabsList>

            {/* Blog Posts Tab */}
            <TabsContent value="blog" className="space-y-6">
              {isCreatingPost ? (
                <div className="glass-panel p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold">New Post</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsCreatingPost(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Post Title"
                    value={newPost.title}
                    onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                    className="bg-secondary/30"
                  />
                  <Input
                    placeholder="Excerpt (optional)"
                    value={newPost.excerpt}
                    onChange={(e) => setNewPost({ ...newPost, excerpt: e.target.value })}
                    className="bg-secondary/30"
                  />
                  <Textarea
                    placeholder="Post Content"
                    value={newPost.content}
                    onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                    className="bg-secondary/30 min-h-[200px]"
                  />
                  <Button onClick={handleCreatePost} disabled={isSavingPost}>
                    {isSavingPost ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Publish Post
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setIsCreatingPost(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  New Post
                </Button>
              )}

              {editingPost && (
                <div className="glass-panel p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold">Edit Post</h3>
                    <Button variant="ghost" size="icon" onClick={() => setEditingPost(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <Input
                    value={editingPost.title}
                    onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                    className="bg-secondary/30"
                  />
                  <Input
                    placeholder="Excerpt"
                    value={editingPost.excerpt || ""}
                    onChange={(e) => setEditingPost({ ...editingPost, excerpt: e.target.value })}
                    className="bg-secondary/30"
                  />
                  <Textarea
                    value={editingPost.content}
                    onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
                    className="bg-secondary/30 min-h-[200px]"
                  />
                  <Button onClick={handleUpdatePost} disabled={isSavingPost}>
                    {isSavingPost ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Changes
                  </Button>
                </div>
              )}

              <div className="space-y-3">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="glass-panel p-4 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-semibold">{post.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(post.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingPost(post)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePost(post.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* AI Knowledge Tab */}
            <TabsContent value="knowledge" className="space-y-6">
              <p className="text-muted-foreground text-sm">
                Add information about yourself that the AI chatbot will use to answer questions.
              </p>

              <Button
                variant="secondary"
                onClick={handleSyncSiteDataForRag}
                disabled={isSavingKnowledge}
                className="gap-2"
              >
                {isSavingKnowledge ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                Sync & Reindex from Site Data
              </Button>

              {isCreatingKnowledge ? (
                <div className="glass-panel p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold">Add Knowledge</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsCreatingKnowledge(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <select
                    value={newKnowledge.type}
                    onChange={(e) => setNewKnowledge({ ...newKnowledge, type: e.target.value })}
                    className="w-full p-2 rounded-lg bg-secondary/30 border border-border/50"
                  >
                    <option value="bio">Bio</option>
                    <option value="resume">Resume</option>
                    <option value="custom">Custom</option>
                  </select>
                  <Input
                    placeholder="Title (e.g., 'Work Experience')"
                    value={newKnowledge.title}
                    onChange={(e) => setNewKnowledge({ ...newKnowledge, title: e.target.value })}
                    className="bg-secondary/30"
                  />
                  <Textarea
                    placeholder="Content (the information the AI will learn)"
                    value={newKnowledge.content}
                    onChange={(e) => setNewKnowledge({ ...newKnowledge, content: e.target.value })}
                    className="bg-secondary/30 min-h-[150px]"
                  />
                  <Button onClick={handleCreateKnowledge} disabled={isSavingKnowledge}>
                    {isSavingKnowledge ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Knowledge
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setIsCreatingKnowledge(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Knowledge
                </Button>
              )}

              <div className="space-y-3">
                {knowledge.map((item) => (
                  <div
                    key={item.id}
                    className="glass-panel p-4 flex items-start justify-between gap-4"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary uppercase">
                          {item.type}
                        </span>
                        <h4 className="font-semibold">{item.title}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {item.content}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteKnowledge(item.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}

                {knowledge.length === 0 && (
                  <div className="glass-panel p-8 text-center text-muted-foreground">
                    No knowledge added yet. Add some information about yourself!
                  </div>
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