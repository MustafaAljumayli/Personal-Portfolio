import { createClient } from "@supabase/supabase-js";

function requireEnv(...names) {
  for (const name of names) {
    const v = process.env[name];
    if (v) return v;
  }
  throw new Error(`Missing required env var: ${names.join(" or ")}`);
}

function chunkText(text, { maxChars = 1200, overlap = 200 } = {}) {
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const chunks = [];
  let i = 0;
  while (i < normalized.length) {
    const end = Math.min(i + maxChars, normalized.length);
    chunks.push(normalized.slice(i, end));
    if (end === normalized.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
}

async function embedOpenAI(inputs, apiKey, model = "text-embedding-3-small") {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: inputs }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`OpenAI embeddings error: ${resp.status} ${t}`.trim());
  }
  const data = await resp.json();
  return data.data.map((d) => d.embedding);
}

async function chatOpenAI(messages, apiKey, model = "gpt-4o-mini") {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.4 }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`OpenAI chat error: ${resp.status} ${t}`.trim());
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function supabaseAdmin() {
  // Prefer non-VITE server env vars, but allow Vite-prefixed ones to reduce confusion in simple setups.
  const url = requireEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY", "VITE_SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function requireAdminFromBearer(req) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token) throw new Error("Missing Bearer token");

  const sb = supabaseAdmin();
  const { data: userRes, error: userErr } = await sb.auth.getUser(token);
  if (userErr) throw userErr;
  const user = userRes?.user;
  if (!user) throw new Error("Invalid auth token");

  const { data: roleRow, error: roleErr } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (roleErr) throw roleErr;
  if (!roleRow) throw new Error("Admin access required");
  return { userId: user.id };
}

export async function ragSync(body) {
  const sb = supabaseAdmin();
  const openaiKey = requireEnv("OPENAI_API_KEY", "VITE_OPENAI_API_KEY");
  const embedModel = process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small";

  const mode = body?.mode ?? "full"; // "full" | "knowledge" | "blog" | "seed"
  const knowledgeIds = body?.knowledgeIds ?? [];
  const blogPostIds = body?.blogPostIds ?? [];
  const seed = body?.seed ?? null;

  // Seed upsert into ai_knowledge (so it's part of the DB source-of-truth)
  if (seed && (mode === "seed" || mode === "full")) {
    const rows = [];
    if (seed.resumeText) rows.push({ type: "resume", title: "Resume (site data)", content: seed.resumeText, source_id: null });
    if (seed.projectsText) rows.push({ type: "projects", title: "Projects (site data)", content: seed.projectsText, source_id: null });
    if (seed.profileText) rows.push({ type: "bio", title: "Profile (site data)", content: seed.profileText, source_id: null });

    for (const r of rows) {
      await sb.from("ai_knowledge").delete().eq("title", r.title);
    }
    if (rows.length) {
      const { error } = await sb.from("ai_knowledge").insert(rows);
      if (error) throw error;
    }
  }

  // Fetch ai_knowledge rows
  let knowledgeRows = [];
  if (mode === "full" || mode === "knowledge" || mode === "seed") {
    const q = sb.from("ai_knowledge").select("id, title, type, content, source_id").order("created_at", { ascending: false });
    const { data, error } = knowledgeIds.length ? await q.in("id", knowledgeIds) : await q;
    if (error) throw error;
    knowledgeRows = data ?? [];
  }

  // Fetch published blog posts
  let blogRows = [];
  if (mode === "full" || mode === "blog") {
    const q = sb
      .from("blog_posts")
      .select("id, title, content, excerpt")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .limit(50);
    const { data, error } = blogPostIds.length ? await q.in("id", blogPostIds) : await q;
    if (error) throw error;
    blogRows = data ?? [];
  }

  // Clear existing chunks for targeted sources
  if (knowledgeIds.length) {
    await sb.from("ai_knowledge_chunks").delete().eq("source_type", "ai_knowledge").in("knowledge_id", knowledgeIds);
  } else if (mode === "full" || mode === "seed" || mode === "knowledge") {
    await sb.from("ai_knowledge_chunks").delete().eq("source_type", "ai_knowledge");
  }

  if (blogPostIds.length) {
    await sb.from("ai_knowledge_chunks").delete().eq("source_type", "blog_posts").in("source_id", blogPostIds);
  } else if (mode === "full" || mode === "blog") {
    await sb.from("ai_knowledge_chunks").delete().eq("source_type", "blog_posts");
  }

  const inserts = [];

  for (const k of knowledgeRows) {
    const content = `${k.title}\n\n${k.content}`;
    const chunks = chunkText(content);
    if (!chunks.length) continue;
    const embeddings = await embedOpenAI(chunks, openaiKey, embedModel);
    for (let i = 0; i < chunks.length; i++) {
      inserts.push({
        knowledge_id: k.id,
        source_type: "ai_knowledge",
        source_id: k.source_id,
        chunk_index: i,
        content: chunks[i],
        embedding: embeddings[i],
      });
    }
  }

  for (const p of blogRows) {
    const content = `${p.title}\n\n${p.excerpt ?? ""}\n\n${p.content}`;
    const chunks = chunkText(content);
    if (!chunks.length) continue;
    const embeddings = await embedOpenAI(chunks, openaiKey, embedModel);
    for (let i = 0; i < chunks.length; i++) {
      inserts.push({
        knowledge_id: p.id, // blog post ids are UUIDs; satisfies NOT NULL
        source_type: "blog_posts",
        source_id: p.id,
        chunk_index: i,
        content: chunks[i],
        embedding: embeddings[i],
      });
    }
  }

  const batchSize = 200;
  for (let i = 0; i < inserts.length; i += batchSize) {
    const batch = inserts.slice(i, i + batchSize);
    const { error } = await sb.from("ai_knowledge_chunks").insert(batch);
    if (error) throw error;
  }

  return {
    ok: true,
    indexed: { knowledge: knowledgeRows.length, blogPosts: blogRows.length, chunks: inserts.length },
  };
}

export async function ragChat(body) {
  const sb = supabaseAdmin();
  const openaiKey = requireEnv("OPENAI_API_KEY", "VITE_OPENAI_API_KEY");
  const embedModel = process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small";
  const chatModel = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

  const messages = body?.messages;
  if (!Array.isArray(messages) || !messages.length) throw new Error("messages required");
  const lastUser = [...messages].reverse().find((m) => m?.role === "user");
  const query = lastUser?.content?.toString?.() ?? "";
  if (!query) throw new Error("No user message found");

  const [queryEmbedding] = await embedOpenAI([query], openaiKey, embedModel);
  if (!queryEmbedding) throw new Error("Failed to embed query");

  const { data: matches, error: matchErr } = await sb.rpc("match_ai_knowledge_chunks", {
    query_embedding: queryEmbedding,
    match_count: 8,
    min_similarity: 0.2,
  });
  if (matchErr) throw matchErr;

  const top = (matches ?? []).slice(0, 8);
  const bestSim = top[0]?.similarity ?? 0;
  const haveContext = bestSim >= 0.25 && top.length > 0;

  const citations = top
    .map((m, idx) => `[#${idx + 1}] (sim=${Number(m.similarity).toFixed(2)}) ${m.content}`)
    .join("\n\n");

  const system = `You are Mustafa.ai — an AI assistant on Mustafa Aljumayli's personal site.

You have two jobs:
1) Answer questions about Mustafa using the provided context when it is relevant.
2) If the question is general (not about Mustafa) or the context doesn't contain the answer, answer normally using general knowledge, but be explicit that it's general knowledge.

Rules:
- If the user asks about Mustafa and the context does not support an answer, say you don't have that specific info and suggest contacting Mustafa.
- Do NOT invent facts about Mustafa.
- Keep responses concise and helpful.

When you use context, include a short "Sources:" section at the end listing the citation numbers you relied on (e.g., "Sources: #1, #3").`;

  const contextBlock = haveContext
    ? `Context about Mustafa (retrieved snippets):\n\n${citations}`
    : `Context about Mustafa (retrieved snippets):\n\n<none>`;

  const promptMessages = [
    { role: "system", content: system },
    { role: "system", content: contextBlock },
    ...messages.map((m) => ({ role: m.role, content: String(m.content ?? "") })),
  ];

  const answer = await chatOpenAI(promptMessages, openaiKey, chatModel);
  return { message: answer, debug: { haveContext, bestSim } };
}


