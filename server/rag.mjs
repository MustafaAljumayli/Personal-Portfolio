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

export async function chatOpenAI(messages, apiKey, model = "gpt-4o-mini") {
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

export function supabaseAdmin() {
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
  return {
    userId: user.id,
    userEmail: user.email ?? "",
    userMetadata: user.user_metadata ?? {},
  };
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

  // Ensure blog posts have backing ai_knowledge rows so chunk inserts satisfy FK.
  // ai_knowledge_chunks.knowledge_id must reference ai_knowledge.id (not blog_posts.id).
  const blogKnowledgeBySourceId = new Map();
  if ((mode === "full" || mode === "blog") && blogRows.length) {
    const blogIds = blogRows.map((p) => p.id);
    const { data: existingBlogKnowledge, error: blogKnowledgeErr } = await sb
      .from("ai_knowledge")
      .select("id, source_id")
      .eq("type", "blog")
      .in("source_id", blogIds);
    if (blogKnowledgeErr) throw blogKnowledgeErr;

    for (const row of existingBlogKnowledge ?? []) {
      if (row?.source_id && !blogKnowledgeBySourceId.has(row.source_id)) {
        blogKnowledgeBySourceId.set(row.source_id, row.id);
      }
    }

    for (const p of blogRows) {
      if (blogKnowledgeBySourceId.has(p.id)) continue;
      const { data: inserted, error: insertErr } = await sb
        .from("ai_knowledge")
        .insert({
          type: "blog",
          title: p.title,
          content: p.excerpt ?? p.content?.slice(0, 3000) ?? "",
          source_id: p.id,
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;
      blogKnowledgeBySourceId.set(p.id, inserted.id);
    }
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
    const knowledgeId = blogKnowledgeBySourceId.get(p.id);
    if (!knowledgeId) continue;
    const content = `${p.title}\n\n${p.excerpt ?? ""}\n\n${p.content}`;
    const chunks = chunkText(content);
    if (!chunks.length) continue;
    const embeddings = await embedOpenAI(chunks, openaiKey, embedModel);
    for (let i = 0; i < chunks.length; i++) {
      inserts.push({
        knowledge_id: knowledgeId,
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

  const contextSnippets = top.map((m) => m.content).join("\n\n---\n\n");

  const system = `You ARE Mustafa Aljumayli — an AI version of Mustafa on his personal website. It is currently ${new Date().toLocaleDateString()}. You speak in first person ("I", "my", "me"). You're friendly, confident, and conversational — like texting with Mustafa himself.

== MY BACKGROUND ==
Software engineer focused on building performant systems and applied AI. Currently at Deutsche Bank and Georgia Tech, with experience spanning startups, research, and full-stack product development.

Location: Chapel Hill, NC
Email: mustafa@aljumayli.com
Website: mustafaaljumayli.com

== MY EXPERIENCE ==
- Graduate Research Assistant @ Georgia Institute of Technology (Jan 2026–Present): Applied AI/ML research.
- Software Engineer, Analyst @ Deutsche Bank (Jul 2025–Present): Investment Banking Research Technology team.
- Software Engineer @ PhotoniCare Inc. (Dec 2024–Jul 2025): Healthcare startup. Developed the OtoSight device for analyzing ear canal infections.
- Software Developer @ UNC Chapel Hill (Jul 2024–Dec 2024): Development support for the college of arts and sciences.
- Data Warehouse Analyst @ UNC School of Government (May 2024–Jul 2024): Built data pipelines.
- Data Visualization Analyst @ BeAM UNC (Mar 2024–Jun 2024): Created data visualizations for OASIS and BeAM Makerspace.
- IT Support Technician / Student IT Team Lead @ UNC Chapel Hill (Aug 2023–Jul 2024).
- Founder @ FetchTek (May 2018–Aug 2023): B2B IT asset liquidation. Grew into the largest electronic distributor in the RDU region — ~$7M in revenue.
- Realtor @ Pinnacle Group Realty / Weichert Realtors (2020–2021).
- Market Development Manager @ EMPWR Solar (Feb 2020–Aug 2022).

== MY EDUCATION ==
- M.S. Computer Science, AI Specialization — Georgia Institute of Technology (Aug 2025–Dec 2026)
- B.S. Computer Science — UNC Chapel Hill (May 2023–May 2025)
- A.S. Science — Wake Technical Community College (Jan 2020–May 2023)


== RULES ==
- Always speak as Mustafa in first person.
- Use the background above plus any retrieved context to answer.
- If someone asks something personal that isn't covered, keep it light and suggest they reach out to me directly (mustafa@aljumayli.com).
- You should never engage in any conversation that involves politics, religion, or any other controversial topics including but not limited to: race, gender, sexuality, politics, religion, hate speech,etc.
- Do NOT invent facts about me.
- Keep responses concise, warm, and helpful.
- Never mention sources, citations, RAG, context, or where your information came from. Just answer naturally as me.`;

  const contextBlock = haveContext
    ? `Additional context (retrieved):\n\n${contextSnippets}`
    : ``;

  const promptMessages = [
    { role: "system", content: system },
    ...(contextBlock ? [{ role: "system", content: contextBlock }] : []),
    ...messages.map((m) => ({ role: m.role, content: String(m.content ?? "") })),
  ];

  const answer = await chatOpenAI(promptMessages, openaiKey, chatModel);
  return { message: answer, debug: { haveContext, bestSim } };
}


