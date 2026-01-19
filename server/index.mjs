import "dotenv/config";
import express from "express";
import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "200kb" }));

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body ?? {};
    if (typeof name !== "string" || typeof email !== "string" || typeof message !== "string") {
      return res.status(400).json({ error: "Invalid payload" });
    }
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Name, email, and message are required" });
    }
    if (!email.includes("@")) return res.status(400).json({ error: "Invalid email" });

    const SMTP_HOST = requireEnv("SMTP_HOST");
    const SMTP_PORT = Number(process.env.SMTP_PORT ?? "587");
    const SMTP_USER = requireEnv("SMTP_USER");
    const SMTP_PASS = requireEnv("SMTP_PASS");
    const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL ?? SMTP_USER;
    const CONTACT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL ?? SMTP_USER;

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `Mustafa's Personal Website Contact: ${name} ${email}`,
      to: CONTACT_TO_EMAIL,
      replyTo: `${name} <${email}>`,
      subject: `Mustafa's Personal Website - Message from ${name || "Someone"}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("contact error:", err);
    const msg =
      process.env.NODE_ENV === "production"
        ? "Failed to send"
        : err instanceof Error
          ? err.message
          : "Failed to send";
    return res.status(500).json({ error: msg });
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


