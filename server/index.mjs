import "dotenv/config";
import express from "express";
import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { ragChat, ragSync, requireAdminFromBearer } from "./rag.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
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
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
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

// Create a pooled transporter once so we don't pay DNS/TLS handshake costs on every request.
let transporter;
function getTransporter() {
  if (transporter) return transporter;

  const SMTP_HOST = requireEnv("SMTP_HOST");
  const SMTP_PORT = Number(process.env.SMTP_PORT ?? "587");
  const SMTP_USER = requireEnv("SMTP_USER");
  const SMTP_PASS = requireEnv("SMTP_PASS");

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    pool: true,
    maxConnections: 1,
    maxMessages: 100,
    // Prevent "hang forever" behavior in production.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return transporter;
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

app.post("/api/contact", async (req, res) => {
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
      await withTimeout(mailPromise, 25_000, "SMTP sendMail");
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
    } else {
      throw new Error(`Unknown EMAIL_TRANSPORT: ${transportMode}`);
    }

    return res.json({ ok: true, ms: Date.now() - startedAt });
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
  app.use(express.static(distDir));
  app.get("*", (_req, res) => res.sendFile(distIndex));
}

const port = Number(process.env.PORT ?? "3001");
app.listen(port, () => {
  console.log(`Server listening on :${port}`);
});


