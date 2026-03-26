import "dotenv/config";
import express from "express";
import nodemailer from "nodemailer";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { ragChat, ragSync, requireAdminFromBearer, supabaseAdmin, chatOpenAI } from "./rag.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// If you're behind a reverse proxy (Render, Nginx, Cloudflare Tunnel), this makes req.ip use X-Forwarded-For.
// Set TRUST_PROXY=0 if you run locally without a proxy and want to ignore forwarded headers.
app.set("trust proxy", process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : true);
app.use(express.json({ limit: "200kb" }));

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

const allowedOrigins = parseAllowedOrigins();
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  return next();
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

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

async function ensureBlogImagesBucket() {
  const sb = supabaseAdmin();
  const { data: buckets } = await sb.storage.listBuckets();
  if (!buckets?.find((b) => b.name === BLOG_IMAGES_BUCKET)) {
    await sb.storage.createBucket(BLOG_IMAGES_BUCKET, { public: true });
  }
}

const blogImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
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


