-- Threaded blog comments + default immediate publish

ALTER TABLE public.blog_post_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.blog_post_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS blog_post_comments_parent_idx
  ON public.blog_post_comments (parent_comment_id);

ALTER TABLE public.blog_post_comments
  ALTER COLUMN is_approved SET DEFAULT true;

UPDATE public.blog_post_comments
SET is_approved = true
WHERE is_approved = false;
