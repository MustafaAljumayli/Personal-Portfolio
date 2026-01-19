-- RAG embeddings support (pgvector + chunks + retrieval RPC)

-- Enable pgvector (Supabase typically uses the `extensions` schema)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Store chunked knowledge + embeddings
CREATE TABLE IF NOT EXISTS public.ai_knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id uuid REFERENCES public.ai_knowledge(id) ON DELETE CASCADE NOT NULL,
  source_type text NOT NULL, -- 'ai_knowledge' | 'blog_posts' | 'seed'
  source_id uuid, -- optional: blog_posts.id etc
  chunk_index int NOT NULL,
  content text NOT NULL,
  embedding extensions.vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_knowledge_chunks_unique
  ON public.ai_knowledge_chunks (knowledge_id, source_type, source_id, chunk_index);

-- Vector index for cosine similarity
CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_embedding_ivfflat
  ON public.ai_knowledge_chunks
  USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 100);

-- Filter/index helpers
CREATE INDEX IF NOT EXISTS ai_knowledge_chunks_source
  ON public.ai_knowledge_chunks (source_type, source_id);

ALTER TABLE public.ai_knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Anyone can read chunks (they only contain content you already mark public via ai_knowledge/blog_posts policies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_knowledge_chunks'
      AND policyname = 'Anyone can read knowledge chunks'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Anyone can read knowledge chunks"
        ON public.ai_knowledge_chunks
        FOR SELECT
        USING (true);
    $pol$;
  END IF;
END
$$;

-- Only admins can write chunks (defense-in-depth; service-role bypasses RLS anyway)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_knowledge_chunks'
      AND policyname = 'Admins can insert knowledge chunks'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Admins can insert knowledge chunks"
        ON public.ai_knowledge_chunks
        FOR INSERT
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    $pol$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_knowledge_chunks'
      AND policyname = 'Admins can delete knowledge chunks'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Admins can delete knowledge chunks"
        ON public.ai_knowledge_chunks
        FOR DELETE
        USING (public.has_role(auth.uid(), 'admin'));
    $pol$;
  END IF;
END
$$;

-- Retrieval RPC (cosine similarity)
CREATE OR REPLACE FUNCTION public.match_ai_knowledge_chunks(
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 8,
  min_similarity float DEFAULT 0.2
)
RETURNS TABLE (
  knowledge_id uuid,
  source_type text,
  source_id uuid,
  chunk_index int,
  content text,
  similarity float
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  SELECT
    c.knowledge_id,
    c.source_type,
    c.source_id,
    c.chunk_index,
    c.content,
    (1 - (c.embedding <=> query_embedding))::float AS similarity
  FROM public.ai_knowledge_chunks c
  WHERE (1 - (c.embedding <=> query_embedding)) > min_similarity
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;


