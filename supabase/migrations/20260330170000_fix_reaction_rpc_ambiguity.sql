-- Fix ambiguous column references in set_blog_post_reaction().
-- The RETURNS TABLE output names (likes_count/dislikes_count) can shadow
-- unqualified column references inside PL/pgSQL.

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

  SELECT bp.id
  INTO v_post_id
  FROM public.blog_posts AS bp
  WHERE bp.slug = p_slug AND bp.published = true
  FOR UPDATE;

  IF v_post_id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  SELECT r.reaction
  INTO v_prev_reaction
  FROM public.blog_post_reactions AS r
  WHERE r.post_id = v_post_id AND r.email = p_email
  FOR UPDATE;

  IF v_prev_reaction = p_reaction THEN
    DELETE FROM public.blog_post_reactions AS r
    WHERE r.post_id = v_post_id AND r.email = p_email;
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

  IF v_prev_reaction = 'like' THEN
    UPDATE public.blog_posts AS bp
    SET likes_count = GREATEST(bp.likes_count - 1, 0)
    WHERE bp.id = v_post_id;
  ELSIF v_prev_reaction = 'dislike' THEN
    UPDATE public.blog_posts AS bp
    SET dislikes_count = GREATEST(bp.dislikes_count - 1, 0)
    WHERE bp.id = v_post_id;
  END IF;

  IF v_next_reaction = 'like' THEN
    UPDATE public.blog_posts AS bp
    SET likes_count = bp.likes_count + 1
    WHERE bp.id = v_post_id;
  ELSIF v_next_reaction = 'dislike' THEN
    UPDATE public.blog_posts AS bp
    SET dislikes_count = bp.dislikes_count + 1
    WHERE bp.id = v_post_id;
  END IF;

  RETURN QUERY
  SELECT bp.likes_count, bp.dislikes_count, v_next_reaction
  FROM public.blog_posts AS bp
  WHERE bp.id = v_post_id;
END;
$$;
