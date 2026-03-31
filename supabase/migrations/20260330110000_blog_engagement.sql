-- Blog engagement: reactions + comments with explicit consent tracking

CREATE TABLE public.blog_post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  email text NOT NULL,
  reaction text NOT NULL CHECK (reaction IN ('like', 'dislike')),
  consent_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, email)
);

CREATE INDEX blog_post_reactions_post_idx
  ON public.blog_post_reactions (post_id, reaction);

ALTER TABLE public.blog_post_reactions ENABLE ROW LEVEL SECURITY;

-- Public can read aggregate-friendly data through backend/API.
CREATE POLICY "Anyone can read blog reactions"
ON public.blog_post_reactions
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage blog reactions"
ON public.blog_post_reactions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.blog_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  commenter_name text NOT NULL,
  commenter_email text NOT NULL,
  comment_body text NOT NULL,
  is_approved boolean NOT NULL DEFAULT false,
  admin_reply text,
  admin_replied_at timestamptz,
  consent_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX blog_post_comments_post_idx
  ON public.blog_post_comments (post_id, is_approved, created_at);

ALTER TABLE public.blog_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read approved blog comments"
ON public.blog_post_comments
FOR SELECT
USING (is_approved = true);

CREATE POLICY "Admins can read all blog comments"
ON public.blog_post_comments
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage blog comments"
ON public.blog_post_comments
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_blog_post_reactions_updated_at
  BEFORE UPDATE ON public.blog_post_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blog_post_comments_updated_at
  BEFORE UPDATE ON public.blog_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
