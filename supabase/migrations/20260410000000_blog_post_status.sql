-- Add a status column to blog_posts for draft / published / archived workflow.
-- The existing `published` boolean is kept in sync via a trigger so RLS
-- policies and public-facing queries (`.eq("published", true)`) keep working.

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';

-- Backfill existing rows based on the current `published` flag.
UPDATE public.blog_posts
SET status = CASE WHEN published = true THEN 'published' ELSE 'draft' END;

-- Trigger: whenever status changes, keep `published` and `published_at` consistent.
CREATE OR REPLACE FUNCTION public.sync_blog_post_published()
RETURNS TRIGGER AS $$
BEGIN
  NEW.published = (NEW.status = 'published');

  -- Set published_at on first publish; keep it on draft/archive so a re-publish
  -- preserves the original date (admin can manually overwrite if desired).
  IF NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    NEW.published_at = COALESCE(NEW.published_at, now());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS sync_blog_post_published_trigger ON public.blog_posts;

CREATE TRIGGER sync_blog_post_published_trigger
  BEFORE INSERT OR UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_blog_post_published();
