-- Move reactions to atomic counters on blog_posts.
-- Keep per-user reaction state table for toggle behavior (like/unlike/dislike/undislike).

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dislikes_count integer NOT NULL DEFAULT 0;

-- Backfill counters from existing per-user state rows.
UPDATE public.blog_posts p
SET
  likes_count = COALESCE(s.likes_count, 0),
  dislikes_count = COALESCE(s.dislikes_count, 0)
FROM (
  SELECT
    post_id,
    COUNT(*) FILTER (WHERE reaction = 'like')::int AS likes_count,
    COUNT(*) FILTER (WHERE reaction = 'dislike')::int AS dislikes_count
  FROM public.blog_post_reactions
  GROUP BY post_id
) s
WHERE p.id = s.post_id;

CREATE OR REPLACE FUNCTION public.set_blog_post_reaction(
  p_slug text,
  p_email text,
  p_reaction text
)
RETURNS TABLE (
  likes_count int,
  dislikes_count int,
  my_reaction text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id uuid;
  v_prev_reaction text;
  v_next_reaction text;
BEGIN
  IF p_reaction NOT IN ('like', 'dislike') THEN
    RAISE EXCEPTION 'Invalid reaction';
  END IF;

  SELECT id
  INTO v_post_id
  FROM public.blog_posts
  WHERE slug = p_slug AND published = true
  FOR UPDATE;

  IF v_post_id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  SELECT reaction
  INTO v_prev_reaction
  FROM public.blog_post_reactions
  WHERE post_id = v_post_id AND email = p_email
  FOR UPDATE;

  -- Toggle off when user clicks the same reaction again.
  IF v_prev_reaction = p_reaction THEN
    DELETE FROM public.blog_post_reactions
    WHERE post_id = v_post_id AND email = p_email;
    v_next_reaction := NULL;
  ELSE
    INSERT INTO public.blog_post_reactions (post_id, email, reaction, consent_at)
    VALUES (v_post_id, p_email, p_reaction, now())
    ON CONFLICT (post_id, email)
    DO UPDATE
    SET reaction = EXCLUDED.reaction,
        consent_at = EXCLUDED.consent_at,
        updated_at = now();
    v_next_reaction := p_reaction;
  END IF;

  -- Decrement previous reaction counter.
  IF v_prev_reaction = 'like' THEN
    UPDATE public.blog_posts
    SET likes_count = GREATEST(likes_count - 1, 0)
    WHERE id = v_post_id;
  ELSIF v_prev_reaction = 'dislike' THEN
    UPDATE public.blog_posts
    SET dislikes_count = GREATEST(dislikes_count - 1, 0)
    WHERE id = v_post_id;
  END IF;

  -- Increment new reaction counter.
  IF v_next_reaction = 'like' THEN
    UPDATE public.blog_posts
    SET likes_count = likes_count + 1
    WHERE id = v_post_id;
  ELSIF v_next_reaction = 'dislike' THEN
    UPDATE public.blog_posts
    SET dislikes_count = dislikes_count + 1
    WHERE id = v_post_id;
  END IF;

  RETURN QUERY
  SELECT p.likes_count, p.dislikes_count, v_next_reaction
  FROM public.blog_posts p
  WHERE p.id = v_post_id;
END;
$$;
