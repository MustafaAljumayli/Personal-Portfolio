ALTER TABLE public.blog_engagement_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.blog_post_comments
  ADD COLUMN IF NOT EXISTS commenter_avatar_url text;
