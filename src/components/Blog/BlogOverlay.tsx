import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -100 }}
      transition={{ type: "spring", damping: 25 }}
      className="fixed inset-x-0 top-20 bottom-[30vh] z-30 overflow-hidden"
    >
      {/* Gradient fade at bottom to blend with globe */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background/90 to-transparent pointer-events-none z-10" />

      <div className="h-full overflow-y-auto custom-scrollbar pt-8 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence mode="wait">
            {selectedPost ? (
              // Single Post View
              <motion.div
                key="post"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <button
                  onClick={() => setSelectedPost(null)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Blog
                </button>

                <article className="glass-panel p-8">
                  {selectedPost.cover_image_url && (
                    <div className="w-full h-48 rounded-lg overflow-hidden mb-6">
                      <img
                        src={selectedPost.cover_image_url}
                        alt={selectedPost.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <h1 className="font-display text-3xl md:text-4xl font-bold mb-4">
                    {selectedPost.title}
                  </h1>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(selectedPost.published_at || selectedPost.created_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {Math.ceil(selectedPost.content.length / 1000)} min read
                    </span>
                  </div>

                  <div className="prose prose-invert max-w-none">
                    {selectedPost.content.split("\n").map((paragraph, index) => (
                      <p key={index} className="mb-4 text-foreground/90">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </article>
              </motion.div>
            ) : (
              // Blog List View
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="font-display text-3xl md:text-4xl font-bold">
                      <span className="text-gradient">Blog</span>
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
                        <div className="flex gap-6">
                          {post.cover_image_url && (
                            <div className="w-32 h-24 rounded-lg overflow-hidden flex-shrink-0">
                              <img
                                src={post.cover_image_url}
                                alt={post.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            </div>
                          )}
                          <div className="flex-1">
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
  );
};

export default BlogOverlay;