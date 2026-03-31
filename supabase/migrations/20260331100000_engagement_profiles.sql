CREATE TABLE IF NOT EXISTS public.blog_engagement_profiles (
  email text PRIMARY KEY,
  display_name text NOT NULL,
  consent_at timestamptz NOT NULL,
  terms_accepted_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(display_name) BETWEEN 1 AND 80)
);

DROP TRIGGER IF EXISTS update_blog_engagement_profiles_updated_at ON public.blog_engagement_profiles;

CREATE TRIGGER update_blog_engagement_profiles_updated_at
  BEFORE UPDATE ON public.blog_engagement_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
