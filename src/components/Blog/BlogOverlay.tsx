import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import BlogArticleBody from "@/components/Blog/BlogArticleBody";
import { estimateReadMinutesMarkdown } from "@/lib/blogReadTime";
import { blogInnerVariants, blogListVariants, blogShellVariants } from "@/lib/uiMotion";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  published_at: string | null;
  created_at: string;
}

interface BlogOverlayProps {
  isVisible: boolean;
  onClose: () => void;
}

const BlogOverlay = ({ isVisible, onClose }: BlogOverlayProps) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<BlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isVisible) {
      fetchPosts();
    }
  }, [isVisible]);

  const fetchPosts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("published", true)
      .order("published_at", { ascending: false });

    if (!error && data) {
      setPosts(data);
    }
    setIsLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="blog-overlay"
          variants={blogShellVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          className="fixed inset-x-0 top-[10vh] bottom-[35vh] z-30 px-6"
        >
      <div className="h-full max-w-5xl mx-auto overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-xl">
        <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-8">
          <AnimatePresence mode="wait">
            {selectedPost ? (
              // Single Post View
              <motion.div
                key="post"
                variants={blogInnerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                <button
                  onClick={() => setSelectedPost(null)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Blog
                </button>

                <article className="glass-panel p-4 sm:p-8 flex flex-col gap-4">
                  {selectedPost.cover_image_url && (
                    <div className="order-1 md:order-3 w-full h-44 sm:h-52 md:h-64 rounded-lg overflow-hidden bg-secondary/30 flex items-center justify-center">
                      <img
                        src={selectedPost.cover_image_url}
                        alt={selectedPost.title}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <h1
                    className={`font-display text-2xl sm:text-3xl md:text-4xl font-bold ${selectedPost.cover_image_url ? "order-2 md:order-1" : ""}`}
                  >
                    {selectedPost.title}
                  </h1>

                  <div
                    className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-muted-foreground ${selectedPost.cover_image_url ? "order-3 md:order-2" : ""}`}
                  >
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(selectedPost.published_at || selectedPost.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {estimateReadMinutesMarkdown(selectedPost.content)} min read
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span>Author: Mustafa Aljumayli</span>
                    </span>
                  </div>
                  <BlogArticleBody
                    content={selectedPost.content}
                    className={`prose prose-invert prose-lg max-w-none text-foreground/90 [&_p]:leading-[1.75] ${selectedPost.cover_image_url ? "order-4" : ""}`}
                  />
                </article>
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
                    <h2 className="font-display text-3xl md:text-4xl font-bold">
                      <span className="text-gradient-unc">Blog</span>
                    </h2>
                    <p className="text-muted-foreground mt-1">
                      Thoughts, tutorials, and insights
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground bg-secondary/30 hover:bg-secondary/50 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>

                {isLoading ? (
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
                ) : posts.length === 0 ? (
                  <div className="glass-panel p-12 text-center">
                    <p className="text-muted-foreground">
                      No blog posts yet. Check back soon!
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    {posts.map((post, index) => (
                      <motion.article
                        key={post.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        onClick={() => setSelectedPost(post)}
                        className="glass-panel p-6 cursor-pointer hover:border-primary/50 transition-all group"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:gap-6 md:items-start">
                          {post.cover_image_url && (
                            <div className="w-full h-40 md:w-32 md:h-24 rounded-lg overflow-hidden flex-shrink-0">
                              <img
                                src={post.cover_image_url}
                                alt={post.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-display text-xl font-semibold group-hover:text-primary transition-colors">
                              {post.title}
                            </h3>
                            {post.excerpt && (
                              <p className="text-muted-foreground mt-2 line-clamp-2">
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
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BlogOverlay;