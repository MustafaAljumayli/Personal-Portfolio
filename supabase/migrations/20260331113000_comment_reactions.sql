CREATE TABLE IF NOT EXISTS public.blog_comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.blog_post_comments(id) ON DELETE CASCADE,
  email text NOT NULL,
  reaction text NOT NULL CHECK (reaction IN ('like', 'dislike')),
  consent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, email)
);

CREATE INDEX IF NOT EXISTS blog_comment_reactions_comment_idx
  ON public.blog_comment_reactions (comment_id, reaction);

ALTER TABLE public.blog_comment_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read comment reactions" ON public.blog_comment_reactions;
CREATE POLICY "Public can read comment reactions"
ON public.blog_comment_reactions
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can insert own comment reactions" ON public.blog_comment_reactions;
CREATE POLICY "Public can insert own comment reactions"
ON public.blog_comment_reactions
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update own comment reactions" ON public.blog_comment_reactions;
CREATE POLICY "Public can update own comment reactions"
ON public.blog_comment_reactions
FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can delete own comment reactions" ON public.blog_comment_reactions;
CREATE POLICY "Public can delete own comment reactions"
ON public.blog_comment_reactions
FOR DELETE USING (true);

ALTER TABLE public.blog_post_comments
  ADD COLUMN IF NOT EXISTS likes_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dislikes_count integer NOT NULL DEFAULT 0;

WITH agg AS (
  SELECT
    comment_id,
    COUNT(*) FILTER (WHERE reaction = 'like')::integer AS likes_count,
    COUNT(*) FILTER (WHERE reaction = 'dislike')::integer AS dislikes_count
  FROM public.blog_comment_reactions
  GROUP BY comment_id
)
UPDATE public.blog_post_comments c
SET
  likes_count = COALESCE(agg.likes_count, 0),
  dislikes_count = COALESCE(agg.dislikes_count, 0)
FROM agg
WHERE agg.comment_id = c.id;

CREATE OR REPLACE FUNCTION public.set_blog_comment_reaction(
  p_comment_id uuid,
  p_email text,
  p_reaction text
)
RETURNS TABLE (
  comment_id uuid,
  likes_count integer,
  dislikes_count integer,
  my_reaction text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_reaction text;
  v_next_reaction text;
  v_likes_count integer;
  v_dislikes_count integer;
BEGIN
  IF p_reaction NOT IN ('like', 'dislike') THEN
    RAISE EXCEPTION 'Invalid reaction type';
  END IF;

  SELECT c.likes_count, c.dislikes_count
  INTO v_likes_count, v_dislikes_count
  FROM public.blog_post_comments AS c
  WHERE c.id = p_comment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;

  SELECT r.reaction
  INTO v_existing_reaction
  FROM public.blog_comment_reactions AS r
  WHERE r.comment_id = p_comment_id
    AND r.email = lower(trim(p_email))
  FOR UPDATE;

  IF v_existing_reaction = p_reaction THEN
    DELETE FROM public.blog_comment_reactions AS r
    WHERE r.comment_id = p_comment_id
      AND r.email = lower(trim(p_email));
    IF p_reaction = 'like' THEN
      v_likes_count := GREATEST(v_likes_count - 1, 0);
    ELSE
      v_dislikes_count := GREATEST(v_dislikes_count - 1, 0);
    END IF;
    v_next_reaction := NULL;
  ELSE
    IF v_existing_reaction IS NULL THEN
      INSERT INTO public.blog_comment_reactions (comment_id, email, reaction, consent_at)
      VALUES (p_comment_id, lower(trim(p_email)), p_reaction, now());
    ELSE
      UPDATE public.blog_comment_reactions AS r
      SET reaction = p_reaction, updated_at = now()
      WHERE r.comment_id = p_comment_id
        AND r.email = lower(trim(p_email));
      IF v_existing_reaction = 'like' THEN
        v_likes_count := GREATEST(v_likes_count - 1, 0);
      ELSE
        v_dislikes_count := GREATEST(v_dislikes_count - 1, 0);
      END IF;
    END IF;

    IF p_reaction = 'like' THEN
      v_likes_count := v_likes_count + 1;
    ELSE
      v_dislikes_count := v_dislikes_count + 1;
    END IF;
    v_next_reaction := p_reaction;
  END IF;

  UPDATE public.blog_post_comments AS c
  SET
    likes_count = v_likes_count,
    dislikes_count = v_dislikes_count
  WHERE c.id = p_comment_id;

  RETURN QUERY
  SELECT
    c.id AS comment_id,
    c.likes_count,
    c.dislikes_count,
    v_next_reaction AS my_reaction
  FROM public.blog_post_comments AS c
  WHERE c.id = p_comment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_blog_comment_reaction(uuid, text, text) TO anon, authenticated, service_role;

DROP TRIGGER IF EXISTS update_blog_comment_reactions_updated_at ON public.blog_comment_reactions;
CREATE TRIGGER update_blog_comment_reactions_updated_at
  BEFORE UPDATE ON public.blog_comment_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
