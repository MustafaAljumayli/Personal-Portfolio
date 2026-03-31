ALTER TABLE public.blog_post_comments
  ADD COLUMN IF NOT EXISTS content_edited_at timestamptz;

CREATE TABLE IF NOT EXISTS public.blog_comment_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.blog_post_comments(id) ON DELETE CASCADE,
  editor_email text NOT NULL,
  previous_body text NOT NULL,
  next_body text NOT NULL,
  edited_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blog_comment_revisions_comment_idx
  ON public.blog_comment_revisions (comment_id, edited_at DESC);

ALTER TABLE public.blog_comment_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read comment revisions" ON public.blog_comment_revisions;
CREATE POLICY "Public can read comment revisions"
ON public.blog_comment_revisions
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can write comment revisions" ON public.blog_comment_revisions;
CREATE POLICY "Service role can write comment revisions"
ON public.blog_comment_revisions
FOR INSERT WITH CHECK (true);
