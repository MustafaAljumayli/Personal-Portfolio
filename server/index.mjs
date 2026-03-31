import "dotenv/config";
import express from "express";
import nodemailer from "nodemailer";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";
import { ragChat, ragSync, requireAdminFromBearer, supabaseAdmin, chatOpenAI } from "./rag.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// If you're behind a reverse proxy (Render, Nginx, Cloudflare Tunnel), this makes req.ip use X-Forwarded-For.
// Set TRUST_PROXY=0 if you run locally without a proxy and want to ignore forwarded headers.
app.set("trust proxy", process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : true);
app.use(express.json({ limit: "200kb" }));

let adminAuthClient;
function getAdminAuthClient() {
  if (adminAuthClient) return adminAuthClient;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const authKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing required env var: SUPABASE_URL or VITE_SUPABASE_URL");
  if (!authKey) {
    throw new Error(
      "Missing Supabase auth key: SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY (or service-role fallback)"
    );
  }
  adminAuthClient = createClient(url, authKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return adminAuthClient;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function withTimeout(promise, ms, label = "operation") {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

function parseAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const MAX_COMMENT_THREAD_DEPTH = 3;

async function resolveThreadParentAtMaxDepth(sb, requestedParentId, expectedPostId) {
  if (!requestedParentId) return null;

  const chain = [];
  const visited = new Set();
  let cursorId = requestedParentId;
  let guard = 0;

  while (cursorId) {
    guard += 1;
    if (guard > 30) throw new Error("Invalid parent comment");
    if (visited.has(cursorId)) throw new Error("Invalid parent comment");
    visited.add(cursorId);

    const { data: node, error: nodeErr } = await sb
      .from("blog_post_comments")
      .select("id, post_id, parent_comment_id")
      .eq("id", cursorId)
      .maybeSingle();
    if (nodeErr) throw nodeErr;
    if (!node) throw new Error("Invalid parent comment");
    if (expectedPostId && node.post_id !== expectedPostId) throw new Error("Invalid parent comment");

    chain.push(node);
    cursorId = node.parent_comment_id ?? null;
  }

  const rootToLeaf = [...chain].reverse();
  const targetDepth = rootToLeaf.length - 1;

  if (targetDepth < MAX_COMMENT_THREAD_DEPTH) return requestedParentId;

  // Keep replies at depth 3 by pinning parent to depth 2.
  return rootToLeaf[MAX_COMMENT_THREAD_DEPTH - 1]?.id ?? requestedParentId;
}

const allowedOrigins = parseAllowedOrigins();
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-engagement-token");
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return next();
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/admin/auth/sign-in", async (req, res) => {
  const limitKey = guardProgressiveAttempts(req, res, "admin-sign-in");
  if (!limitKey) return;
  try {
    cleanupAdminAuthState();
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!isValidEmail(email) || !password) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const authResult = await authenticateAdminCredentials(email, password);
    if (!authResult.ok) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(authResult.status).json({ error: authResult.error });
    }

    const code = String(randomInt(100000, 1000000));
    adminAuthCodes.set(email, {
      code,
      expiresAt: Date.now() + ADMIN_AUTH_CODE_TTL_MS,
      attempts: 0,
    });

    await sendPortfolioEmail({
      to: email,
      subject: "Your admin sign-in verification code",
      text:
        `Hi,\n\nYour admin verification code is: ${code}\n\n` +
        "It expires in 10 minutes. If you didn't request this, ignore this email.",
    });

    registerProgressiveAttemptResult(limitKey, true);
    return res.json({ ok: true, message: "Verification code sent" });
  } catch (err) {
    console.error("admin auth sign-in error:", err);
    registerProgressiveAttemptResult(limitKey, false);
    return res.status(500).json({ error: "Failed to sign in" });
  }
});

app.post("/api/admin/auth/verify-code", async (req, res) => {
  const limitKey = guardProgressiveAttempts(req, res, "admin-sign-in");
  if (!limitKey) return;
  try {
    cleanupAdminAuthState();
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!isValidEmail(email) || !password || !/^\d{6}$/.test(code)) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({ error: "Invalid email, password, or verification code" });
    }

    const pending = adminAuthCodes.get(email);
    if (!pending || pending.expiresAt <= Date.now()) {
      adminAuthCodes.delete(email);
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({ error: "Code expired. Request a new one." });
    }

    if (!codesMatch(pending.code, code)) {
      pending.attempts += 1;
      if (pending.attempts >= 6) adminAuthCodes.delete(email);
      else adminAuthCodes.set(email, pending);
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({ error: "Incorrect verification code" });
    }

    adminAuthCodes.delete(email);
    const authResult = await authenticateAdminCredentials(email, password);
    if (!authResult.ok) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(authResult.status).json({ error: authResult.error });
    }

    registerProgressiveAttemptResult(limitKey, true);
    return res.json({
      ok: true,
      access_token: authResult.signInData.session.access_token,
      refresh_token: authResult.signInData.session.refresh_token,
    });
  } catch (err) {
    console.error("admin auth verify-code error:", err);
    registerProgressiveAttemptResult(limitKey, false);
    return res.status(500).json({ error: "Failed to verify code" });
  }
});

app.put("/api/admin/profile/display-name", async (req, res) => {
  try {
    const admin = await requireAdminFromBearer(req);
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
    if (!displayName || displayName.length > 80) {
      return res.status(400).json({ error: "Display name must be 1-80 characters" });
    }
    const adminEmail = normalizeEmail(admin.userEmail);
    if (!isValidEmail(adminEmail)) {
      return res.status(400).json({ error: "Admin email is missing or invalid" });
    }

    const sb = supabaseAdmin();
    const { error } = await sb
      .from("blog_post_comments")
      .update({ commenter_name: `${displayName} (Admin)` })
      .eq("commenter_email", adminEmail);
    if (error) throw error;

    return res.json({ ok: true });
  } catch (err) {
    console.error("admin profile display-name update error:", err);
    const msg = err instanceof Error ? err.message : "Failed to update admin display name";
    const statusCode = msg.includes("Admin access required") || msg.includes("Missing Bearer token") ? 401 : 500;
    return res.status(statusCode).json({ error: msg });
  }
});

app.post("/api/admin/profile/avatar", (req, res, next) => {
  profileAvatarUpload.single("file")(req, res, (err) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, async (req, res) => {
  try {
    const admin = await requireAdminFromBearer(req);
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file provided" });
    if (!ALLOWED_PROFILE_AVATAR_TYPES.has(file.mimetype)) {
      return res.status(400).json({ error: "Only JPEG, PNG, WebP, or GIF images are allowed" });
    }

    const adminEmail = normalizeEmail(admin.userEmail);
    if (!isValidEmail(adminEmail)) {
      return res.status(400).json({ error: "Admin email is missing or invalid" });
    }

    await ensureProfileAvatarsBucket();
    const sb = supabaseAdmin();
    const ext = PROFILE_AVATAR_EXT[file.mimetype] ?? "bin";
    const emailHash = createHash("sha256").update(adminEmail).digest("hex").slice(0, 24);
    const fileHash = createHash("sha256").update(file.buffer).digest("hex");
    const objectPath = `avatars/admin-${emailHash}/${fileHash}.${ext}`;
    const { error: uploadErr } = await sb.storage.from(PROFILE_AVATARS_BUCKET).upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });
    if (uploadErr) throw uploadErr;

    const { data } = sb.storage.from(PROFILE_AVATARS_BUCKET).getPublicUrl(objectPath);
    const avatarUrl = data.publicUrl;

    if (admin.userId) {
      const nextMeta = {
        ...(typeof admin.userMetadata === "object" && admin.userMetadata ? admin.userMetadata : {}),
        avatar_url: avatarUrl,
      };
      await sb.auth.admin.updateUserById(admin.userId, { user_metadata: nextMeta });
    }

    const { error: commentErr } = await sb
      .from("blog_post_comments")
      .update({ commenter_avatar_url: avatarUrl })
      .eq("commenter_email", adminEmail);
    if (commentErr) throw commentErr;

    return res.json({ ok: true, avatarUrl });
  } catch (err) {
    console.error("admin avatar upload error:", err);
    const msg = err instanceof Error ? err.message : "Failed to upload avatar";
    const statusCode = msg.includes("Admin access required") || msg.includes("Missing Bearer token") ? 401 : 500;
    return res.status(statusCode).json({ error: msg });
  }
});

app.post("/api/rag/chat", async (req, res) => {
  try {
    const result = await ragChat(req.body);
    return res.json(result);
  } catch (err) {
    console.error("rag chat error:", err);
    const msg =
      process.env.NODE_ENV === "production"
        ? "Failed to chat"
        : err instanceof Error
          ? err.message
          : "Failed to chat";
    return res.status(500).json({ error: msg });
  }
});

app.post("/api/rag/sync", async (req, res) => {
  try {
    await requireAdminFromBearer(req);
    const result = await ragSync(req.body);
    return res.json(result);
  } catch (err) {
    console.error("rag sync error:", err);
    const msg =
      process.env.NODE_ENV === "production"
        ? "Failed to sync"
        : err instanceof Error
          ? err.message
          : "Failed to sync";
    const status = msg.includes("Admin access required") || msg.includes("Missing Bearer token") ? 401 : 500;
    return res.status(status).json({ error: msg });
  }
});

// ── Resume PDF upload/download ──────────────────────────────────────────────

const RESUME_BUCKET = "resume";
const RESUME_FILE = "resume.pdf";

async function ensureResumeBucket() {
  const sb = supabaseAdmin();
  const { data: buckets } = await sb.storage.listBuckets();
  if (!buckets?.find((b) => b.name === RESUME_BUCKET)) {
    await sb.storage.createBucket(RESUME_BUCKET, { public: false });
  }
}

app.post(
  "/api/resume/upload",
  express.raw({ type: "application/pdf", limit: "10mb" }),
  async (req, res) => {
    try {
      await requireAdminFromBearer(req);
      const buffer = req.body;
      if (!buffer || !buffer.length) {
        return res.status(400).json({ error: "No file provided" });
      }

      await ensureResumeBucket();
      const sb = supabaseAdmin();
      const { error } = await sb.storage
        .from(RESUME_BUCKET)
        .upload(RESUME_FILE, buffer, { contentType: "application/pdf", upsert: true });

      if (error) throw error;
      return res.json({ ok: true });
    } catch (err) {
      console.error("resume upload error:", err);
      const msg = err instanceof Error ? err.message : "Upload failed";
      const status = msg.includes("Admin access required") || msg.includes("Missing Bearer token") ? 401 : 500;
      return res.status(status).json({ error: msg });
    }
  }
);

app.get("/api/resume/download", async (_req, res) => {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.storage.from(RESUME_BUCKET).download(RESUME_FILE);
    if (error || !data) {
      return res.status(404).json({ error: "No resume uploaded yet" });
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Mustafa_Aljumayli_Resume.pdf"');
    return res.send(buffer);
  } catch (err) {
    console.error("resume download error:", err);
    return res.status(500).json({ error: "Failed to download resume" });
  }
});

app.head("/api/resume/download", async (_req, res) => {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.storage.from(RESUME_BUCKET).list("", { search: RESUME_FILE });
    if (error || !data?.length) return res.status(404).end();
    return res.status(200).end();
  } catch {
    return res.status(500).end();
  }
});

// ── Blog inline images (public bucket; admin-only upload) ───────────────────

const BLOG_IMAGES_BUCKET = "blog-images";
const ALLOWED_BLOG_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const BLOG_IMAGE_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const PROFILE_AVATARS_BUCKET = "profile-avatars";
const ALLOWED_PROFILE_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const PROFILE_AVATAR_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function ensureBlogImagesBucket() {
  const sb = supabaseAdmin();
  const { data: buckets } = await sb.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BLOG_IMAGES_BUCKET)) {
    await sb.storage.createBucket(BLOG_IMAGES_BUCKET, { public: true });
  }
}

async function ensureProfileAvatarsBucket() {
  const sb = supabaseAdmin();
  const { data: buckets } = await sb.storage.listBuckets();
  if (!buckets?.find((b) => b.name === PROFILE_AVATARS_BUCKET)) {
    await sb.storage.createBucket(PROFILE_AVATARS_BUCKET, { public: true });
  }
}

const blogImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const profileAvatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
});

app.post("/api/blog/upload-image", (req, res, next) => {
  blogImageUpload.single("file")(req, res, (err) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, async (req, res) => {
  try {
    await requireAdminFromBearer(req);
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }
    if (!ALLOWED_BLOG_IMAGE_TYPES.has(file.mimetype)) {
      return res.status(400).json({ error: "Only JPEG, PNG, WebP, or GIF images are allowed" });
    }

    await ensureBlogImagesBucket();
    const sb = supabaseAdmin();
    const ext = BLOG_IMAGE_EXT[file.mimetype] ?? "bin";
    // Content-addressed path: same bytes → same key → no duplicate blobs when re-uploading the same image.
    const hash = createHash("sha256").update(file.buffer).digest("hex");
    const objectPath = `inline/${hash}.${ext}`;
    const { error } = await sb.storage.from(BLOG_IMAGES_BUCKET).upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });
    if (error) throw error;

    const { data } = sb.storage.from(BLOG_IMAGES_BUCKET).getPublicUrl(objectPath);
    return res.json({ url: data.publicUrl });
  } catch (err) {
    console.error("blog image upload error:", err);
    const msg = err instanceof Error ? err.message : "Upload failed";
    const status =
      msg.includes("Admin access required") || msg.includes("Missing Bearer token") ? 401 : 500;
    return res.status(status).json({ error: msg });
  }
});

const RESUME_DATA_FILE = "data.json";

const RESUME_PARSE_PROMPT = `You are a resume parser. Extract structured JSON from the resume text below.
Return ONLY valid JSON (no markdown fences) matching this exact schema:
{
  "profile": {
    "name": "string",
    "headline": "string (short professional title, e.g. 'Software Engineer')",
    "location": "string",
    "email": "string",
    "website": "string (domain only, no https://)",
    "linkedin": "string (domain path, e.g. linkedin.com/in/...)",
    "github": "string (domain path, e.g. github.com/...)",
    "twitter": "string or (https://x.com/aljumayli2145 if null)"
  },
  "summary": "string (the summary/objective section)",
  "experience": [
    {
      "title": "string (job title)",
      "company": "string",
      "period": "string (e.g. 'July 2025 - Present')",
      "bullets": ["string (each bullet point as a separate string)"]
    }
  ],
  "education": [
    {
      "degree": "string (degree name only, do NOT include awards or GPA here)",
      "school": "string",
      "period": "string",
      "gpa": "string or null",
      "awards": ["string (each award/honor as a separate string)"]
    }
  ],
  "skillCategories": [
    { "title": "string (category name)", "skills": ["string"] }
  ],
  "projects": [
    {
      "title": "string",
      "bullets": ["string (each bullet point as a separate string)"],
      "tech": ["string"],
      "githubUrl": "string or null",
      "liveUrl": "string or null"
    }
  ]
}

Rules:
- For experience, keep EACH bullet point as a separate string in the "bullets" array. Do NOT merge them into a paragraph.
- For education, put ONLY the degree name in "degree". GPA goes in "gpa". Awards and honors go in the "awards" array — do NOT attach them to the degree or school.
- For projects, keep EACH bullet point as a separate string in the "bullets" array. Extract any GitHub or live URLs if present.
- Order experience, education, and projects chronologically (most recent first).
- Extract ALL entries, do not skip any.`;

app.post("/api/resume/parse-and-apply", async (req, res) => {
  try {
    await requireAdminFromBearer(req);

    const sb = supabaseAdmin();
    const { data: pdfBlob, error: dlErr } = await sb.storage.from(RESUME_BUCKET).download(RESUME_FILE);
    if (dlErr || !pdfBlob) {
      return res.status(404).json({ error: "Upload a resume PDF first" });
    }

    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
    const parser = new PDFParse({ data: pdfBuffer });
    const { text } = await parser.getText();
    if (!text?.trim()) {
      return res.status(400).json({ error: "Could not extract text from PDF" });
    }

    const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    if (!openaiKey) throw new Error("Missing OPENAI_API_KEY");

    const chatModel = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
    const answer = await chatOpenAI(
      [
        { role: "system", content: RESUME_PARSE_PROMPT },
        { role: "user", content: text },
      ],
      openaiKey,
      chatModel
    );

    let parsed;
    try {
      const cleaned = answer.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ error: "Failed to parse AI response as JSON", raw: answer });
    }

    const existing = await readContentJson();
    const merged = { ...existing, ...parsed };
    await writeContentJson(merged);

    return res.json({ ok: true, data: parsed });
  } catch (err) {
    console.error("resume parse error:", err);
    const msg = err instanceof Error ? err.message : "Parse failed";
    const status = msg.includes("Admin access required") || msg.includes("Missing Bearer token") ? 401 : 500;
    return res.status(status).json({ error: msg });
  }
});

app.get("/api/resume/data", async (_req, res) => {
  try {
    const content = await readContentJson();
    if (!content || Object.keys(content).length === 0) {
      return res.status(404).json({ error: "No parsed resume data" });
    }
    return res.json(content);
  } catch (err) {
    console.error("resume data error:", err);
    return res.status(500).json({ error: "Failed to fetch resume data" });
  }
});

// ── Content CRUD (section-level read/write on data.json) ──────────────────────

const CONTENT_SECTIONS = ["settings", "about", "profile", "experience", "education", "skillCategories", "projects"];

async function readContentJson() {
  const sb = supabaseAdmin();
  const { data, error } = await sb.storage.from(RESUME_BUCKET).download(RESUME_DATA_FILE);
  if (error || !data) return {};
  const text = await data.text();
  try { return JSON.parse(text); } catch { return {}; }
}

async function writeContentJson(content) {
  await ensureResumeBucket();
  const sb = supabaseAdmin();
  const buf = Buffer.from(JSON.stringify(content, null, 2));
  const { error } = await sb.storage
    .from(RESUME_BUCKET)
    .upload(RESUME_DATA_FILE, buf, { contentType: "application/json", upsert: true });
  if (error) throw error;
}

app.get("/api/content", async (_req, res) => {
  try {
    const content = await readContentJson();
    return res.json(content);
  } catch (err) {
    console.error("content read error:", err);
    return res.status(500).json({ error: "Failed to read content" });
  }
});

app.get("/api/content/:section", async (req, res) => {
  const { section } = req.params;
  if (!CONTENT_SECTIONS.includes(section)) {
    return res.status(400).json({ error: `Invalid section: ${section}` });
  }
  try {
    const content = await readContentJson();
    return res.json(content[section] ?? null);
  } catch (err) {
    console.error("content section read error:", err);
    return res.status(500).json({ error: "Failed to read section" });
  }
});

app.put("/api/content/:section", async (req, res) => {
  const { section } = req.params;
  if (!CONTENT_SECTIONS.includes(section)) {
    return res.status(400).json({ error: `Invalid section: ${section}` });
  }
  try {
    await requireAdminFromBearer(req);
    const content = await readContentJson();
    content[section] = req.body;
    await writeContentJson(content);
    return res.json({ ok: true });
  } catch (err) {
    console.error("content section write error:", err);
    const msg = err instanceof Error ? err.message : "Failed to write section";
    const status = msg.includes("Admin access required") || msg.includes("Missing Bearer token") ? 401 : 500;
    return res.status(status).json({ error: msg });
  }
});

// Create a pooled transporter once so we don't pay DNS/TLS handshake costs on every request.
let transporter;
function getTransporter() {
  if (transporter) return transporter;

  const SMTP_HOST = requireEnv("SMTP_HOST");
  const SMTP_PORT = Number(process.env.SMTP_PORT ?? "587");
  const SMTP_USER = requireEnv("SMTP_USER");
  const SMTP_PASS = requireEnv("SMTP_PASS");
  const smtpDebug = process.env.SMTP_DEBUG === "1" || process.env.SMTP_DEBUG === "true";

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    logger: smtpDebug,
    debug: smtpDebug,
    // Prevent "hang forever" behavior in production.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return transporter;
}

// Validate SMTP creds early so failures show up on boot, not only when a user submits the form.
async function verifySmtpIfConfigured() {
  const transportMode = process.env.EMAIL_TRANSPORT ?? (process.env.RESEND_API_KEY ? "resend" : "smtp");
  if (transportMode !== "smtp") return;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  try {
    await withTimeout(getTransporter().verify(), 10_000, "SMTP verify");
    console.log("[smtp] verified");
  } catch (e) {
    console.error("[smtp] verify failed:", e);
  }
}

async function sendViaResend({ to, from, replyTo, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing required env var: RESEND_API_KEY");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      reply_to: replyTo,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend error: ${res.status} ${body}`.trim());
  }
}

async function sendPortfolioEmail({ to, subject, text, replyTo }) {
  const fromEmail = requireEnv("CONTACT_FROM_EMAIL");
  const transportMode = process.env.EMAIL_TRANSPORT ?? (process.env.RESEND_API_KEY ? "resend" : "smtp");

  if (transportMode === "smtp") {
    await withTimeout(
      getTransporter().sendMail({
        from: `Mustafa Portfolio <${fromEmail}>`,
        to,
        replyTo,
        subject,
        text,
      }),
      25_000,
      "SMTP sendMail"
    );
    return;
  }

  if (transportMode === "resend") {
    await withTimeout(
      sendViaResend({
        to,
        from: `Mustafa Portfolio <${fromEmail}>`,
        replyTo,
        subject,
        text,
      }),
      25_000,
      "Resend send"
    );
    return;
  }

  throw new Error(`Unknown EMAIL_TRANSPORT: ${transportMode}`);
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const ENGAGEMENT_CODE_TTL_MS = 10 * 60 * 1000;
const ENGAGEMENT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ADMIN_AUTH_CODE_TTL_MS = 10 * 60 * 1000;
const engagementAuthCodes = new Map();
const engagementSessions = new Map();
const adminAuthCodes = new Map();
const progressiveAttemptState = new Map();
const commentBurstState = new Map();

function cleanupEngagementAuthState() {
  const now = Date.now();
  for (const [key, value] of engagementAuthCodes.entries()) {
    if (value.expiresAt <= now) engagementAuthCodes.delete(key);
  }
  for (const [key, value] of engagementSessions.entries()) {
    if (value.expiresAt <= now) engagementSessions.delete(key);
  }
}

function cleanupAdminAuthState() {
  const now = Date.now();
  for (const [key, value] of adminAuthCodes.entries()) {
    if (value.expiresAt <= now) adminAuthCodes.delete(key);
  }
}

function codesMatch(expectedCode, providedCode) {
  if (typeof expectedCode !== "string" || typeof providedCode !== "string") return false;
  if (expectedCode.length !== providedCode.length) return false;
  return timingSafeEqual(Buffer.from(expectedCode), Buffer.from(providedCode));
}

function createEngagementToken(email) {
  const seed = randomBytes(32).toString("hex");
  const rand = createHash("sha256").update(`${email}:${Date.now()}:${seed}`).digest("hex");
  return `eng_${rand}`;
}

async function authenticateAdminCredentials(email, password) {
  const authClient = getAdminAuthClient();
  const { data: signInData, error: signInErr } = await authClient.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !signInData.session || !signInData.user) {
    return { ok: false, status: 401, error: "Invalid credentials" };
  }

  const sb = supabaseAdmin();
  const { data: roleRow, error: roleErr } = await sb
    .from("user_roles")
    .select("role")
    .eq("user_id", signInData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (roleErr || !roleRow) {
    return { ok: false, status: 403, error: "Admin access required" };
  }

  return { ok: true, signInData };
}

function getEngagementSessionFromReq(req) {
  cleanupEngagementAuthState();
  const token = typeof req.headers["x-engagement-token"] === "string" ? req.headers["x-engagement-token"].trim() : "";
  if (!token) return null;
  const session = engagementSessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    engagementSessions.delete(token);
    return null;
  }
  return { token, ...session };
}

async function getEngagementProfileByEmail(email) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("blog_engagement_profiles")
    .select("email, display_name, avatar_url, consent_at, terms_accepted_at")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function upsertEngagementProfile({
  email,
  displayName,
  avatarUrl,
  consentAt,
  termsAcceptedAt,
}) {
  const sb = supabaseAdmin();
  const payload = {
    email,
    display_name: displayName,
    avatar_url: avatarUrl ?? null,
    consent_at: consentAt,
    terms_accepted_at: termsAcceptedAt,
  };
  const { data, error } = await sb
    .from("blog_engagement_profiles")
    .upsert(payload, { onConflict: "email" })
    .select("email, display_name, avatar_url, consent_at, terms_accepted_at")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function createEngagementProfile({
  email,
  displayName,
  avatarUrl,
  consentAt,
  termsAcceptedAt,
}) {
  const sb = supabaseAdmin();
  const payload = {
    email,
    display_name: displayName,
    avatar_url: avatarUrl ?? null,
    consent_at: consentAt,
    terms_accepted_at: termsAcceptedAt,
  };
  const { data, error } = await sb
    .from("blog_engagement_profiles")
    .insert(payload)
    .select("email, display_name, avatar_url, consent_at, terms_accepted_at")
    .maybeSingle();
  if (error) throw error;
  return data;
}

let adminEmailCache = { expiresAt: 0, emails: new Set() };
async function getAdminEmailsCached() {
  const now = Date.now();
  if (adminEmailCache.expiresAt > now) return adminEmailCache.emails;

  const sb = supabaseAdmin();
  const { data: roles, error: rolesErr } = await sb
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (rolesErr) throw rolesErr;

  const emails = new Set();
  const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id).filter(Boolean)));
  for (const userId of ids) {
    const { data, error } = await sb.auth.admin.getUserById(userId);
    if (error) continue;
    const email = normalizeEmail(data?.user?.email);
    if (email) emails.add(email);
  }

  adminEmailCache = {
    emails,
    expiresAt: now + 5 * 60_000,
  };
  return emails;
}

async function isAdminEmail(email) {
  const emails = await getAdminEmailsCached();
  return emails.has(normalizeEmail(email));
}

async function recoverEngagementProfileFromComments(email) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("blog_post_comments")
    .select("commenter_name, consent_at, created_at")
    .eq("commenter_email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.commenter_name) return null;
  return upsertEngagementProfile({
    email,
    displayName: String(data.commenter_name).trim().slice(0, 80) || email.split("@")[0],
    consentAt: data.consent_at || new Date().toISOString(),
    termsAcceptedAt: new Date().toISOString(),
  });
}

function progressiveLimiterKey(req, scope) {
  const bodyEmail = normalizeEmail(req.body?.email);
  const keyEmail = bodyEmail || "anon";
  return `${scope}:${req.ip || "unknown"}:${keyEmail}`;
}

function guardProgressiveAttempts(req, res, scope) {
  const key = progressiveLimiterKey(req, scope);
  const now = Date.now();
  const state = progressiveAttemptState.get(key) ?? { failures: 0, penaltyUntil: 0, lastAt: now };
  state.lastAt = now;
  if (state.penaltyUntil > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((state.penaltyUntil - now) / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      error: `Too many failed attempts. Try again in ${retryAfterSeconds}s.`,
      retry_after_seconds: retryAfterSeconds,
    });
    return null;
  }
  progressiveAttemptState.set(key, state);
  return key;
}

function registerProgressiveAttemptResult(key, success) {
  if (!key) return;
  const now = Date.now();
  const state = progressiveAttemptState.get(key) ?? { failures: 0, penaltyUntil: 0, lastAt: now };
  state.lastAt = now;
  if (success) {
    state.failures = 0;
    state.penaltyUntil = 0;
    progressiveAttemptState.set(key, state);
    return;
  }
  state.failures += 1;
  if (state.failures > 3) {
    const minutes = Math.min(state.failures - 3, 5);
    state.penaltyUntil = now + minutes * 60_000;
  }
  progressiveAttemptState.set(key, state);
}

function guardCommentBurstLimit(req, res, email) {
  const now = Date.now();
  const normalizedEmail = normalizeEmail(email) || "anon";
  const key = `comment-burst:${req.ip || "unknown"}:${normalizedEmail}`;
  const windowMs = 30_000;
  const limit = 3;
  const existing = commentBurstState.get(key) ?? [];
  const recent = existing.filter((ts) => now - ts < windowMs);
  if (recent.length >= limit) {
    const retryAfterMs = windowMs - (now - recent[0]);
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      error: `Too many comments too quickly. Try again in ${retryAfterSeconds}s.`,
      retry_after_seconds: retryAfterSeconds,
    });
    commentBurstState.set(key, recent);
    return false;
  }
  recent.push(now);
  commentBurstState.set(key, recent);
  return true;
}

function parsePositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function parseBlogYear(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 2000 || parsed > 2100) return null;
  return parsed;
}

async function resolvePublishedPostBySlug(slug) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("blog_posts")
    .select("id, title, slug")
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getReactionCounts(postId) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("blog_posts")
    .select("likes_count, dislikes_count")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  return {
    likes: data?.likes_count ?? 0,
    dislikes: data?.dislikes_count ?? 0,
  };
}

app.post("/api/engagement/auth/request-code", async (req, res) => {
  const limitKey = guardProgressiveAttempts(req, res, "engagement-auth");
  if (!limitKey) return;
  try {
    cleanupEngagementAuthState();
    const email = normalizeEmail(req.body?.email);
    const mode = req.body?.mode === "login" ? "login" : "signup";
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const consent = req.body?.consent === true;
    const termsAccepted = req.body?.termsAccepted === true;
    if (!isValidEmail(email)) return res.status(400).json({ error: "A valid email is required" });
    if (await isAdminEmail(email)) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(403).json({
        error: "This email is an admin account. Use admin sign-in.",
        code: "ENGAGEMENT_ADMIN_EMAIL_BLOCKED",
      });
    }

    let profile = null;
    if (mode === "signup") {
      profile = await getEngagementProfileByEmail(email);
      if (profile) {
        registerProgressiveAttemptResult(limitKey, false);
        return res.status(409).json({
          error: "An account already exists for this email. Please log in instead.",
          code: "ENGAGEMENT_PROFILE_EXISTS",
        });
      }
      if (!name || name.length > 80) {
        return res.status(400).json({ error: "Name must be 1-80 characters" });
      }
      if (!consent) return res.status(400).json({ error: "Consent is required" });
      if (!termsAccepted) return res.status(400).json({ error: "You must agree to Terms and Conditions" });
      profile = await createEngagementProfile({
        email,
        displayName: name.slice(0, 80),
        avatarUrl: null,
        consentAt: new Date().toISOString(),
        termsAcceptedAt: new Date().toISOString(),
      });
    } else {
      profile = await getEngagementProfileByEmail(email);
      if (!profile) {
        return res.status(404).json({
          error: "No engagement profile found for this email. Please sign up first.",
          code: "ENGAGEMENT_PROFILE_NOT_FOUND",
        });
      }
    }

    const code = String(randomInt(100000, 1000000));
    engagementAuthCodes.set(email, {
      code,
      name: profile?.display_name || name.slice(0, 80) || email.split("@")[0],
      avatarUrl: profile?.avatar_url || null,
      consentAt: profile?.consent_at || new Date().toISOString(),
      expiresAt: Date.now() + ENGAGEMENT_CODE_TTL_MS,
      attempts: 0,
    });

    await sendPortfolioEmail({
      to: email,
      subject: "Your Mustafa Blog verification code",
      text:
        `Hi,\n\nYour verification code is: ${code}\n\n` +
        "It expires in 10 minutes. If you didn't request this, ignore this email.",
    });

    registerProgressiveAttemptResult(limitKey, true);
    return res.json({ ok: true, message: "Verification code sent" });
  } catch (err) {
    console.error("engagement auth request-code error:", err);
    registerProgressiveAttemptResult(limitKey, false);
    return res.status(500).json({ error: "Failed to send verification code" });
  }
});

app.post("/api/engagement/auth/verify-code", async (req, res) => {
  const limitKey = guardProgressiveAttempts(req, res, "engagement-auth");
  if (!limitKey) return;
  try {
    cleanupEngagementAuthState();
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({ error: "Invalid email or verification code" });
    }

    const pending = engagementAuthCodes.get(email);
    if (!pending || pending.expiresAt <= Date.now()) {
      engagementAuthCodes.delete(email);
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({ error: "Code expired. Request a new one." });
    }
    if (pending.code !== code) {
      pending.attempts += 1;
      engagementAuthCodes.set(email, pending);
      if (pending.attempts >= 6) engagementAuthCodes.delete(email);
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({ error: "Incorrect verification code" });
    }

    engagementAuthCodes.delete(email);
    const token = createEngagementToken(email);
    const session = {
      email,
      name: pending.name,
      avatarUrl: pending.avatarUrl || null,
      consentAt: pending.consentAt || new Date().toISOString(),
      expiresAt: Date.now() + ENGAGEMENT_SESSION_TTL_MS,
    };
    engagementSessions.set(token, session);
    registerProgressiveAttemptResult(limitKey, true);
    return res.json({
      ok: true,
      token,
      session: {
        email: session.email,
        name: session.name,
        avatarUrl: session.avatarUrl || null,
        consentAt: session.consentAt,
      },
    });
  } catch (err) {
    console.error("engagement auth verify-code error:", err);
    registerProgressiveAttemptResult(limitKey, false);
    return res.status(500).json({ error: "Failed to verify code" });
  }
});

app.get("/api/engagement/auth/session", async (req, res) => {
  const session = getEngagementSessionFromReq(req);
  if (!session) return res.status(401).json({ error: "Session expired" });
  return res.json({
    email: session.email,
    name: session.name,
    avatarUrl: session.avatarUrl || null,
    consentAt: session.consentAt,
  });
});

app.put("/api/engagement/auth/profile", async (req, res) => {
  try {
    const session = getEngagementSessionFromReq(req);
    if (!session) return res.status(401).json({ error: "Session expired" });
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const avatarUrl =
      typeof req.body?.avatarUrl === "string" && req.body.avatarUrl.trim()
        ? req.body.avatarUrl.trim()
        : null;
    if (!name || name.length > 80) {
      return res.status(400).json({ error: "Name must be 1-80 characters" });
    }

    const existing = await getEngagementProfileByEmail(session.email);
    const profile = await upsertEngagementProfile({
      email: session.email,
      displayName: name.slice(0, 80),
      avatarUrl: avatarUrl ?? existing?.avatar_url ?? null,
      consentAt: existing?.consent_at || session.consentAt || new Date().toISOString(),
      termsAcceptedAt: existing?.terms_accepted_at || new Date().toISOString(),
    });

    const sb = supabaseAdmin();
    const { error: renameErr } = await sb
      .from("blog_post_comments")
      .update({
        commenter_name: profile?.display_name || name.slice(0, 80),
        commenter_avatar_url: profile?.avatar_url || null,
      })
      .eq("commenter_email", session.email);
    if (renameErr) throw renameErr;

    engagementSessions.set(session.token, {
      ...session,
      name: profile?.display_name || name.slice(0, 80),
      avatarUrl: profile?.avatar_url || null,
      expiresAt: session.expiresAt,
    });

    return res.json({
      ok: true,
      session: {
        email: session.email,
        name: profile?.display_name || name.slice(0, 80),
        avatarUrl: profile?.avatar_url || null,
        consentAt: session.consentAt,
      },
    });
  } catch (err) {
    console.error("engagement auth profile update error:", err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

app.post("/api/engagement/auth/profile/avatar", (req, res, next) => {
  profileAvatarUpload.single("file")(req, res, (err) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, async (req, res) => {
  try {
    const session = getEngagementSessionFromReq(req);
    if (!session) return res.status(401).json({ error: "Session expired" });
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file provided" });
    if (!ALLOWED_PROFILE_AVATAR_TYPES.has(file.mimetype)) {
      return res.status(400).json({ error: "Only JPEG, PNG, WebP, or GIF images are allowed" });
    }

    await ensureProfileAvatarsBucket();
    const sb = supabaseAdmin();
    const ext = PROFILE_AVATAR_EXT[file.mimetype] ?? "bin";
    const emailHash = createHash("sha256").update(session.email).digest("hex").slice(0, 24);
    const fileHash = createHash("sha256").update(file.buffer).digest("hex");
    const objectPath = `avatars/${emailHash}/${fileHash}.${ext}`;
    const { error: uploadErr } = await sb.storage.from(PROFILE_AVATARS_BUCKET).upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });
    if (uploadErr) throw uploadErr;

    const { data } = sb.storage.from(PROFILE_AVATARS_BUCKET).getPublicUrl(objectPath);
    const avatarUrl = data.publicUrl;

    const existing = await getEngagementProfileByEmail(session.email);
    const profile = await upsertEngagementProfile({
      email: session.email,
      displayName: existing?.display_name || session.name || session.email.split("@")[0],
      avatarUrl,
      consentAt: existing?.consent_at || session.consentAt || new Date().toISOString(),
      termsAcceptedAt: existing?.terms_accepted_at || new Date().toISOString(),
    });

    const { error: commentUpdateErr } = await sb
      .from("blog_post_comments")
      .update({ commenter_avatar_url: avatarUrl })
      .eq("commenter_email", session.email);
    if (commentUpdateErr) throw commentUpdateErr;

    const nextSession = {
      ...session,
      name: profile?.display_name || session.name,
      avatarUrl,
      expiresAt: session.expiresAt,
    };
    engagementSessions.set(session.token, nextSession);

    return res.json({
      ok: true,
      avatarUrl,
      session: {
        email: nextSession.email,
        name: nextSession.name,
        avatarUrl: nextSession.avatarUrl || null,
        consentAt: nextSession.consentAt,
      },
    });
  } catch (err) {
    console.error("engagement avatar upload error:", err);
    return res.status(500).json({ error: "Failed to upload avatar" });
  }
});

app.get("/api/blog/posts", async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1000);
    const pageSize = parsePositiveInt(req.query.pageSize, 6, 24);
    const q = (typeof req.query.q === "string" ? req.query.q : "").trim().slice(0, 120);
    const year = parseBlogYear(req.query.year);
    const sort = req.query.sort === "oldest" ? "oldest" : "newest";

    const sb = supabaseAdmin();
    let query = sb
      .from("blog_posts")
      .select("id, title, slug, excerpt, cover_image_url, published_at, created_at", { count: "exact" })
      .eq("published", true);

    if (q) {
      const queryText = q.replace(/[%_,]/g, " ");
      query = query.or(`title.ilike.%${queryText}%,excerpt.ilike.%${queryText}%`);
    }

    if (year) {
      query = query
        .gte("published_at", `${year}-01-01T00:00:00.000Z`)
        .lt("published_at", `${year + 1}-01-01T00:00:00.000Z`);
    }

    query = query.order("published_at", { ascending: sort === "oldest" });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query.range(from, to);
    if (error) throw error;

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return res.json({
      items: data ?? [],
      total,
      page,
      pageSize,
      totalPages,
      query: q,
      year,
      sort,
    });
  } catch (err) {
    console.error("blog list error:", err);
    return res.status(500).json({ error: "Failed to fetch blog posts" });
  }
});

app.get("/api/blog/posts/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug ?? "").trim();
    if (!slug) return res.status(400).json({ error: "Invalid slug" });

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("blog_posts")
      .select("id, title, slug, excerpt, content, cover_image_url, published_at, created_at")
      .eq("slug", slug)
      .eq("published", true)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "Post not found" });
    return res.json(data);
  } catch (err) {
    console.error("blog post error:", err);
    return res.status(500).json({ error: "Failed to fetch blog post" });
  }
});

app.get("/api/blog/posts/:slug/engagement", async (req, res) => {
  try {
    const slug = String(req.params.slug ?? "").trim();
    if (!slug) return res.status(400).json({ error: "Invalid slug" });

    const post = await resolvePublishedPostBySlug(slug);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const sb = supabaseAdmin();
    const session = getEngagementSessionFromReq(req);
    let actorEmail = session?.email ?? null;
    if (!actorEmail) {
      const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
      if (authHeader.startsWith("Bearer ")) {
        try {
          const admin = await requireAdminFromBearer(req);
          actorEmail = normalizeEmail(admin.userEmail);
        } catch {
          actorEmail = null;
        }
      }
    }
    const { likes, dislikes } = await getReactionCounts(post.id);
    const { data: comments, error } = await sb
      .from("blog_post_comments")
      .select("id, commenter_name, commenter_email, commenter_avatar_url, comment_body, parent_comment_id, likes_count, dislikes_count, content_edited_at, admin_reply, admin_replied_at, created_at, updated_at")
      .eq("post_id", post.id)
      .eq("is_approved", true)
      .order("created_at", { ascending: true });
    if (error) throw error;

    let commentReactionById = new Map();
    if (actorEmail && (comments ?? []).length > 0) {
      const ids = (comments ?? []).map((c) => c.id);
      const { data: myCommentReactions, error: myCommentReactionErr } = await sb
        .from("blog_comment_reactions")
        .select("comment_id, reaction")
        .in("comment_id", ids)
        .eq("email", actorEmail);
      if (myCommentReactionErr) throw myCommentReactionErr;
      commentReactionById = new Map((myCommentReactions ?? []).map((r) => [r.comment_id, r.reaction]));
    }

    let myReaction = null;
    if (actorEmail) {
      const { data: mine, error: mineErr } = await sb
        .from("blog_post_reactions")
        .select("reaction")
        .eq("post_id", post.id)
        .eq("email", actorEmail)
        .maybeSingle();
      if (mineErr) throw mineErr;
      myReaction = mine?.reaction ?? null;
    }

    return res.json({
      likes,
      dislikes,
      my_reaction: myReaction,
      comments: (comments ?? []).map((c) => ({
        id: c.id,
        commenter_name: c.commenter_name,
        commenter_avatar_url: c.commenter_avatar_url,
        comment_body: c.comment_body,
        parent_comment_id: c.parent_comment_id,
        likes_count: c.likes_count ?? 0,
        dislikes_count: c.dislikes_count ?? 0,
        my_reaction: commentReactionById.get(c.id) ?? null,
        content_edited_at: c.content_edited_at,
        admin_reply: c.admin_reply,
        admin_replied_at: c.admin_replied_at,
        created_at: c.created_at,
        updated_at: c.updated_at,
        is_mine: !!actorEmail && c.commenter_email === actorEmail,
      })),
    });
  } catch (err) {
    console.error("blog engagement read error:", err);
    return res.status(500).json({ error: "Failed to fetch engagement data" });
  }
});

app.post("/api/blog/comments/:id/reactions", async (req, res) => {
  const limitKey = guardProgressiveAttempts(req, res, "engagement-reaction");
  if (!limitKey) return;
  try {
    const commentId = String(req.params.id ?? "").trim();
    const session = getEngagementSessionFromReq(req);
    const email = session?.email ?? normalizeEmail(req.body?.email);
    const reaction = req.body?.reaction === "dislike" ? "dislike" : req.body?.reaction === "like" ? "like" : null;
    const consent = session ? true : req.body?.consent === true;
    const termsAccepted = session ? true : req.body?.termsAccepted === true;

    if (!commentId || !reaction) return res.status(400).json({ error: "Invalid payload" });
    if (!isValidEmail(email)) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({ error: "A valid email is required" });
    }
    if (!guardCommentBurstLimit(req, res, email)) return;
    if (!consent) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({ error: "Consent is required before submitting a reaction" });
    }
    if (!termsAccepted) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({ error: "You must agree to Terms and Conditions before submitting a reaction" });
    }

    const sb = supabaseAdmin();
    const { data: commentRow, error: commentErr } = await sb
      .from("blog_post_comments")
      .select("id, post_id")
      .eq("id", commentId)
      .maybeSingle();
    if (commentErr) throw commentErr;
    if (!commentRow) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(404).json({ error: "Comment not found" });
    }

    const { data: postRow, error: postErr } = await sb
      .from("blog_posts")
      .select("id, published")
      .eq("id", commentRow.post_id)
      .maybeSingle();
    if (postErr) throw postErr;
    if (!postRow?.published) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(404).json({ error: "Comment not found" });
    }

    const { data: updated, error: rpcErr } = await sb.rpc("set_blog_comment_reaction", {
      p_comment_id: commentId,
      p_email: email,
      p_reaction: reaction,
    });
    if (rpcErr) throw rpcErr;
    const row = Array.isArray(updated) ? updated[0] : updated;
    registerProgressiveAttemptResult(limitKey, true);
    return res.json({
      ok: true,
      comment_id: row?.comment_id ?? commentId,
      likes_count: Number(row?.likes_count ?? 0),
      dislikes_count: Number(row?.dislikes_count ?? 0),
      my_reaction: row?.my_reaction ?? null,
    });
  } catch (err) {
    console.error("blog comment reaction error:", err);
    registerProgressiveAttemptResult(limitKey, false);
    return res.status(500).json({ error: "Failed to submit comment reaction" });
  }
});

app.post("/api/blog/posts/:slug/reactions", async (req, res) => {
  const limitKey = guardProgressiveAttempts(req, res, "engagement-reaction");
  if (!limitKey) return;
  try {
    const slug = String(req.params.slug ?? "").trim();
    const session = getEngagementSessionFromReq(req);
    const email = session?.email ?? normalizeEmail(req.body?.email);
    const reaction = req.body?.reaction === "dislike" ? "dislike" : req.body?.reaction === "like" ? "like" : null;
    const consent = session ? true : req.body?.consent === true;
    const termsAccepted = session ? true : req.body?.termsAccepted === true;

    if (!slug || !reaction) return res.status(400).json({ error: "Invalid payload" });
    if (!isValidEmail(email)) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({ error: "A valid email is required" });
    }
    if (!consent) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({
        error: "Consent is required before submitting a reaction",
      });
    }
    if (!termsAccepted) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({
        error: "You must agree to Terms and Conditions before submitting a reaction",
      });
    }

    const post = await resolvePublishedPostBySlug(slug);
    if (!post) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(404).json({ error: "Post not found" });
    }

    const sb = supabaseAdmin();
    const { data: updated, error: rpcErr } = await sb.rpc("set_blog_post_reaction", {
      p_slug: slug,
      p_email: email,
      p_reaction: reaction,
    });
    if (rpcErr) throw rpcErr;
    const row = Array.isArray(updated) ? updated[0] : updated;
    const counts = {
      likes: Number(row?.likes_count ?? 0),
      dislikes: Number(row?.dislikes_count ?? 0),
    };
    const myReaction = row?.my_reaction ?? null;
    registerProgressiveAttemptResult(limitKey, true);
    return res.json({ ok: true, ...counts, my_reaction: myReaction });
  } catch (err) {
    console.error("blog reaction error:", err);
    registerProgressiveAttemptResult(limitKey, false);
    return res.status(500).json({ error: "Failed to submit reaction" });
  }
});

app.post("/api/blog/posts/:slug/comments", async (req, res) => {
  const limitKey = guardProgressiveAttempts(req, res, "engagement-comment");
  if (!limitKey) return;
  try {
    const slug = String(req.params.slug ?? "").trim();
    const session = getEngagementSessionFromReq(req);
    const name = (typeof req.body?.name === "string" ? req.body.name.trim() : "") || session?.name || "";
    const email = session?.email ?? normalizeEmail(req.body?.email);
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
    const parentCommentId = typeof req.body?.parentCommentId === "string" ? req.body.parentCommentId.trim() : null;
    const consent = session ? true : req.body?.consent === true;
    const termsAccepted = session ? true : req.body?.termsAccepted === true;

    if (!slug) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({ error: "Invalid slug" });
    }
    if (!name || name.length > 80) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({ error: "Name must be 1-80 characters" });
    }
    if (!isValidEmail(email)) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({ error: "A valid email is required" });
    }
    if (!comment || comment.length < 2 || comment.length > 2500) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({ error: "Comment must be 2-2500 characters" });
    }
    if (!consent) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({
        error: "Consent is required before submitting a comment",
      });
    }
    if (!termsAccepted) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({
        error: "You must agree to Terms and Conditions before submitting a comment",
      });
    }

    const post = await resolvePublishedPostBySlug(slug);
    if (!post) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(404).json({ error: "Post not found" });
    }

    const sb = supabaseAdmin();
    let effectiveParentCommentId = null;
    try {
      effectiveParentCommentId = await resolveThreadParentAtMaxDepth(sb, parentCommentId, post.id);
    } catch (parentErr) {
      registerProgressiveAttemptResult(limitKey, false);
      return res.status(400).json({ error: "Invalid parent comment" });
    }

    const profile = session?.avatarUrl ? null : await getEngagementProfileByEmail(email).catch(() => null);
    const commenterAvatarUrl = session?.avatarUrl || profile?.avatar_url || null;

    const { error } = await sb.from("blog_post_comments").insert({
      post_id: post.id,
      commenter_name: name,
      commenter_email: email,
      commenter_avatar_url: commenterAvatarUrl,
      comment_body: comment,
      parent_comment_id: effectiveParentCommentId,
      is_approved: true,
      consent_at: new Date().toISOString(),
    });
    if (error) throw error;

    if (process.env.CONTACT_TO_EMAIL && process.env.CONTACT_FROM_EMAIL) {
      void sendPortfolioEmail({
        to: process.env.CONTACT_TO_EMAIL,
        subject: `New blog comment on: ${post.title}`,
        text: `Post: ${post.title}\nFrom: ${name} <${email}>\n\n${comment}\n\nModerate in your admin dashboard if needed.`,
        replyTo: `${name} <${email}>`,
      }).catch((mailErr) => {
        console.error("blog comment admin notify failed:", mailErr);
      });
    }

    return res.json({
      ok: true,
      message: "Comment posted.",
    });
    registerProgressiveAttemptResult(limitKey, true);
  } catch (err) {
    console.error("blog comment error:", err);
    registerProgressiveAttemptResult(limitKey, false);
    return res.status(500).json({ error: "Failed to submit comment" });
  }
});

app.get("/api/blog/posts/:slug/comments/mine", async (req, res) => {
  try {
    const session = getEngagementSessionFromReq(req);
    if (!session) return res.status(401).json({ error: "Please verify your email first" });
    const slug = String(req.params.slug ?? "").trim();
    if (!slug) return res.status(400).json({ error: "Invalid slug" });

    const post = await resolvePublishedPostBySlug(slug);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const sb = supabaseAdmin();
    const { data, error } = await sb
      .from("blog_post_comments")
      .select("id, commenter_name, commenter_email, commenter_avatar_url, comment_body, parent_comment_id, is_approved, content_edited_at, admin_reply, admin_replied_at, created_at, updated_at")
      .eq("post_id", post.id)
      .eq("commenter_email", session.email)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return res.json({ items: data ?? [] });
  } catch (err) {
    console.error("my comments fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch your comments" });
  }
});

app.put("/api/blog/comments/:id", async (req, res) => {
  try {
    const session = getEngagementSessionFromReq(req);
    if (!session) return res.status(401).json({ error: "Please verify your email first" });
    const id = String(req.params.id ?? "").trim();
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
    if (!id || comment.length < 2 || comment.length > 2500) {
      return res.status(400).json({ error: "Comment must be 2-2500 characters" });
    }

    const sb = supabaseAdmin();
    const { data: existing, error: existingErr } = await sb
      .from("blog_post_comments")
      .select("id, commenter_email, comment_body")
      .eq("id", id)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (!existing || existing.commenter_email !== session.email) {
      return res.status(403).json({ error: "You can only edit your own comments" });
    }

    if (existing.comment_body !== comment) {
      const { error: revisionErr } = await sb.from("blog_comment_revisions").insert({
        comment_id: id,
        editor_email: session.email,
        previous_body: existing.comment_body,
        next_body: comment,
      });
      if (revisionErr) throw revisionErr;
    }

    const { error } = await sb
      .from("blog_post_comments")
      .update({
        comment_body: comment,
        commenter_name: session.name,
        content_edited_at: new Date().toISOString(),
        is_approved: true,
      })
      .eq("id", id);
    if (error) throw error;
    return res.json({ ok: true, message: "Comment updated" });
  } catch (err) {
    console.error("my comment update error:", err);
    return res.status(500).json({ error: "Failed to update comment" });
  }
});

app.delete("/api/blog/comments/:id", async (req, res) => {
  try {
    const session = getEngagementSessionFromReq(req);
    if (!session) return res.status(401).json({ error: "Please verify your email first" });
    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "Invalid comment id" });

    const sb = supabaseAdmin();
    const { data: existing, error: existingErr } = await sb
      .from("blog_post_comments")
      .select("id, commenter_email")
      .eq("id", id)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (!existing || existing.commenter_email !== session.email) {
      return res.status(403).json({ error: "You can only delete your own comments" });
    }

    const { error } = await sb.from("blog_post_comments").delete().eq("id", id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    console.error("my comment delete error:", err);
    return res.status(500).json({ error: "Failed to delete comment" });
  }
});

app.get("/api/blog/comments/admin", async (req, res) => {
  try {
    await requireAdminFromBearer(req);
    const status = req.query.status === "approved" || req.query.status === "pending" ? req.query.status : "all";
    const limit = parsePositiveInt(req.query.limit, 100, 300);
    const postId = typeof req.query.postId === "string" ? req.query.postId.trim() : "";

    const sb = supabaseAdmin();
    let query = sb
      .from("blog_post_comments")
      .select("id, post_id, commenter_name, commenter_email, commenter_avatar_url, comment_body, parent_comment_id, is_approved, content_edited_at, admin_reply, admin_replied_at, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status === "approved") query = query.eq("is_approved", true);
    if (status === "pending") query = query.eq("is_approved", false);
    if (postId) query = query.eq("post_id", postId);

    const { data: comments, error } = await query;
    if (error) throw error;

    const postIds = Array.from(new Set((comments ?? []).map((c) => c.post_id)));
    let postMap = new Map();
    if (postIds.length > 0) {
      const { data: posts, error: postsErr } = await sb
        .from("blog_posts")
        .select("id, slug, title")
        .in("id", postIds);
      if (postsErr) throw postsErr;
      postMap = new Map((posts ?? []).map((p) => [p.id, p]));
    }

    return res.json({
      items: (comments ?? []).map((c) => ({
        ...c,
        post: postMap.get(c.post_id) ?? null,
      })),
    });
  } catch (err) {
    console.error("admin comments fetch error:", err);
    const msg = err instanceof Error ? err.message : "Failed to fetch comments";
    const statusCode = msg.includes("Admin access required") || msg.includes("Missing Bearer token") ? 401 : 500;
    return res.status(statusCode).json({ error: msg });
  }
});

app.post("/api/blog/comments/:id/approve", async (req, res) => {
  try {
    await requireAdminFromBearer(req);
    const id = String(req.params.id ?? "").trim();
    const approved = req.body?.approved !== false;
    if (!id) return res.status(400).json({ error: "Invalid comment id" });

    const sb = supabaseAdmin();
    const { error } = await sb
      .from("blog_post_comments")
      .update({ is_approved: approved })
      .eq("id", id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    console.error("admin approve comment error:", err);
    const msg = err instanceof Error ? err.message : "Failed to update comment";
    const statusCode = msg.includes("Admin access required") || msg.includes("Missing Bearer token") ? 401 : 500;
    return res.status(statusCode).json({ error: msg });
  }
});

app.post("/api/blog/comments/:id/reply", async (req, res) => {
  try {
    const admin = await requireAdminFromBearer(req);
    const id = String(req.params.id ?? "").trim();
    const reply = typeof req.body?.reply === "string" ? req.body.reply.trim() : "";
    if (!id || !reply || reply.length > 2500) {
      return res.status(400).json({ error: "Reply must be 1-2500 characters" });
    }

    const sb = supabaseAdmin();
    const { data: comment, error: commentErr } = await sb
      .from("blog_post_comments")
      .select("id, post_id, commenter_name, commenter_email")
      .eq("id", id)
      .maybeSingle();
    if (commentErr) throw commentErr;
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const { data: post, error: postErr } = await sb
      .from("blog_posts")
      .select("title, slug")
      .eq("id", comment.post_id)
      .maybeSingle();
    if (postErr) throw postErr;

    const adminEmail = normalizeEmail(admin.userEmail);
    const metadataName =
      typeof admin.userMetadata?.display_name === "string" ? admin.userMetadata.display_name.trim() : "";
    const metadataAvatar =
      typeof admin.userMetadata?.avatar_url === "string"
        ? admin.userMetadata.avatar_url.trim()
        : typeof admin.userMetadata?.picture === "string"
          ? admin.userMetadata.picture.trim()
          : null;
    const fallbackName = adminEmail ? adminEmail.split("@")[0] : "Admin";
    const adminName = `${(metadataName || fallbackName).slice(0, 80)} (Admin)`;

    const effectiveParentCommentId = await resolveThreadParentAtMaxDepth(sb, comment.id, comment.post_id);

    const { error: insertErr } = await sb.from("blog_post_comments").insert({
      post_id: comment.post_id,
      commenter_name: adminName,
      commenter_email: adminEmail || "admin@portfolio.local",
      commenter_avatar_url: metadataAvatar || null,
      comment_body: reply,
      parent_comment_id: effectiveParentCommentId,
      is_approved: true,
      consent_at: new Date().toISOString(),
    });
    if (insertErr) throw insertErr;

    const publicBase = (process.env.PUBLIC_SITE_URL || allowedOrigins[0] || "").replace(/\/+$/, "");
    const postUrl = post?.slug && publicBase ? `${publicBase}/blog/${post.slug}` : null;

    if (process.env.CONTACT_FROM_EMAIL) {
      await sendPortfolioEmail({
        to: comment.commenter_email,
        subject: `Reply to your comment on "${post?.title ?? "Mustafa's blog"}"`,
        text:
          `Hi ${comment.commenter_name},\n\n` +
          `Mustafa replied to your comment:\n\n${reply}\n\n` +
          (postUrl ? `You can view the post here: ${postUrl}\n\n` : "") +
          "Thanks for engaging on the blog.",
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("admin reply comment error:", err);
    const msg = err instanceof Error ? err.message : "Failed to reply to comment";
    const statusCode = msg.includes("Admin access required") || msg.includes("Missing Bearer token") ? 401 : 500;
    return res.status(statusCode).json({ error: msg });
  }
});

app.put("/api/blog/comments/:id/admin-update", async (req, res) => {
  try {
    const admin = await requireAdminFromBearer(req);
    const id = String(req.params.id ?? "").trim();
    const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
    if (!id || comment.length < 2 || comment.length > 2500) {
      return res.status(400).json({ error: "Comment must be 2-2500 characters" });
    }

    const sb = supabaseAdmin();
    const { data: existing, error: existingErr } = await sb
      .from("blog_post_comments")
      .select("id, comment_body")
      .eq("id", id)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (!existing) return res.status(404).json({ error: "Comment not found" });

    const adminEmail = normalizeEmail(admin.userEmail) || "admin@portfolio.local";
    if (existing.comment_body !== comment) {
      const { error: revisionErr } = await sb.from("blog_comment_revisions").insert({
        comment_id: id,
        editor_email: adminEmail,
        previous_body: existing.comment_body,
        next_body: comment,
      });
      if (revisionErr) throw revisionErr;
    }

    const { error } = await sb
      .from("blog_post_comments")
      .update({
        comment_body: comment,
        content_edited_at: new Date().toISOString(),
        is_approved: true,
      })
      .eq("id", id);
    if (error) throw error;
    return res.json({ ok: true, message: "Comment updated" });
  } catch (err) {
    console.error("admin update comment error:", err);
    const msg = err instanceof Error ? err.message : "Failed to update comment";
    const statusCode = msg.includes("Admin access required") || msg.includes("Missing Bearer token") ? 401 : 500;
    return res.status(statusCode).json({ error: msg });
  }
});

app.post("/api/blog/comments/:id/admin-delete", async (req, res) => {
  try {
    await requireAdminFromBearer(req);
    const id = String(req.params.id ?? "").trim();
    const notify = req.body?.notify === true;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!id) return res.status(400).json({ error: "Invalid comment id" });

    const sb = supabaseAdmin();
    const { data: comment, error: commentErr } = await sb
      .from("blog_post_comments")
      .select("id, post_id, commenter_name, commenter_email, comment_body")
      .eq("id", id)
      .maybeSingle();
    if (commentErr) throw commentErr;
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const { data: post } = await sb.from("blog_posts").select("title").eq("id", comment.post_id).maybeSingle();
    const { error } = await sb.from("blog_post_comments").delete().eq("id", id);
    if (error) throw error;

    if (notify && process.env.CONTACT_FROM_EMAIL) {
      await sendPortfolioEmail({
        to: comment.commenter_email,
        subject: `Your comment was removed from "${post?.title ?? "Mustafa's blog"}"`,
        text:
          `Hi ${comment.commenter_name},\n\n` +
          "Your comment was removed by moderation.\n" +
          (reason ? `Reason: ${reason}\n\n` : "\n") +
          "Please review the site rules before posting again.",
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("admin delete comment error:", err);
    const msg = err instanceof Error ? err.message : "Failed to delete comment";
    const statusCode = msg.includes("Admin access required") || msg.includes("Missing Bearer token") ? 401 : 500;
    return res.status(statusCode).json({ error: msg });
  }
});

function createExponentialRateLimiter({ windowMs, max, baseDelayMs, maxDelayMs }) {
  /** @type {Map<string, { windowStart: number; count: number; penaltyUntil: number; penaltyCount: number }>} */
  const state = new Map();

  return function rateLimit(req, res, next) {
    const key = req.ip || "unknown";
    const now = Date.now();
    const cur = state.get(key) ?? { windowStart: now, count: 0, penaltyUntil: 0, penaltyCount: 0 };

    // If currently penalized, block immediately.
    if (now < cur.penaltyUntil) {
      const retryAfterSeconds = Math.max(1, Math.ceil((cur.penaltyUntil - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: `Rate limit exceeded. Try again in ${retryAfterSeconds}s.`,
        retry_after_seconds: retryAfterSeconds,
      });
    }

    // Rolling window reset.
    if (now - cur.windowStart >= windowMs) {
      cur.windowStart = now;
      cur.count = 0;
      cur.penaltyCount = 0;
      cur.penaltyUntil = 0;
    }

    // Allow within the budget.
    if (cur.count < max) {
      cur.count += 1;
      state.set(key, cur);
      return next();
    }

    // Exceeded: apply exponential backoff penalty.
    cur.penaltyCount += 1;
    const delayMs = Math.min(baseDelayMs * Math.pow(2, cur.penaltyCount - 1), maxDelayMs);
    cur.penaltyUntil = now + delayMs;
    state.set(key, cur);

    const retryAfterSeconds = Math.max(1, Math.ceil(delayMs / 1000));
    res.setHeader("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      error: `Rate limit exceeded. Try again in ${retryAfterSeconds}s.`,
      retry_after_seconds: retryAfterSeconds,
    });
  };
}

// 2 emails / minute per host (IP). Exponential backoff when exceeded.
const contactRateLimit = createExponentialRateLimiter({
  windowMs: 60_000,
  max: 2,
  baseDelayMs: 60_000,
  maxDelayMs: 15 * 60_000,
});

app.post("/api/contact", contactRateLimit, async (req, res) => {
  const startedAt = Date.now();
  try {
    const { name, email, message } = req.body ?? {};
    if (typeof name !== "string" || typeof email !== "string" || typeof message !== "string") {
      return res.status(400).json({ error: "Invalid payload" });
    }
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Name, email, and message are required" });
    }
    if (!email.includes("@")) return res.status(400).json({ error: "Invalid email" });

    const CONTACT_TO_EMAIL = requireEnv("CONTACT_TO_EMAIL");
    // IMPORTANT: from must be a mailbox you own/control (SPF/DKIM/DMARC). Use replyTo for the visitor.
    // For Resend, this must be a verified sender/domain (or a Resend-provided default).
    const CONTACT_FROM_EMAIL = requireEnv("CONTACT_FROM_EMAIL");

    const replyTo = `${name} <${email}>`;
    const subject = `Mustafa's Personal Website - Message from ${name || "Someone"}`;
    const text = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;

    // Render free tier blocks outbound SMTP (25/465/587), causing ETIMEDOUT.
    // Prefer Resend (HTTP API) in production; keep SMTP for local/other hosts.
    const transportMode = process.env.EMAIL_TRANSPORT ?? (process.env.RESEND_API_KEY ? "resend" : "smtp");

    if (transportMode === "smtp") {
      const SMTP_USER = requireEnv("SMTP_USER");
      const SMTP_PASS = requireEnv("SMTP_PASS");
      void SMTP_USER;
      void SMTP_PASS;

      const mailPromise = getTransporter().sendMail({
        from: `Mustafa Portfolio <${CONTACT_FROM_EMAIL}>`,
        to: CONTACT_TO_EMAIL,
        replyTo,
        subject,
        text,
      });
      const info = await withTimeout(mailPromise, 25_000, "SMTP sendMail");
      return res.json({
        ok: true,
        ms: Date.now() - startedAt,
        ...(process.env.NODE_ENV === "production"
          ? {}
          : {
              transport: "smtp",
              messageId: info?.messageId,
              accepted: info?.accepted,
              rejected: info?.rejected,
              response: info?.response,
            }),
      });
    } else if (transportMode === "resend") {
      await withTimeout(
        sendViaResend({
          to: CONTACT_TO_EMAIL,
          from: `Mustafa Portfolio <${CONTACT_FROM_EMAIL}>`,
          replyTo,
          subject,
          text,
        }),
        25_000,
        "Resend send"
      );
      return res.json({ ok: true, ms: Date.now() - startedAt });
    } else {
      throw new Error(`Unknown EMAIL_TRANSPORT: ${transportMode}`);
    }

  } catch (err) {
    console.error("contact error:", err);
    const msg =
      process.env.NODE_ENV === "production"
        ? "Failed to send"
        : err instanceof Error
          ? err.message
          : "Failed to send";
    return res.status(500).json({ error: msg });
  } finally {
    const ms = Date.now() - startedAt;
    if (ms > 5000) {
      console.log(`[contact] completed in ${ms}ms`);
    }
  }
});

// In production, serve the built Vite app (dist/). In dev, you can run Vite separately.
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const distIndex = path.join(distDir, "index.html");

if (fs.existsSync(distIndex)) {
  console.warn(
    "[static] Serving ./dist — run `npm run build` after changing React/source; stale dist causes old Router/KTX2/preload behavior."
  );
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(distIndex));
}

const port = Number(process.env.PORT ?? "3001");
app.listen(port, () => {
  console.log(`Server listening on :${port}`);
  void verifySmtpIfConfigured();
});


