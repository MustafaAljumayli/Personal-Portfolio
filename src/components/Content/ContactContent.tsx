import { motion } from "framer-motion";
import { Mail, Linkedin, Github, Twitter, Send } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api";
import { useResumeData } from "@/hooks/useResumeData";

const ContactContent = () => {
  const { profile } = useResumeData();

  const socialLinks = useMemo(() => [
    { icon: Mail, label: "Email", href: `mailto:${profile.email}`, value: profile.email },
    { icon: Linkedin, label: "LinkedIn", href: `https://${profile.linkedin}`, value: profile.linkedin.split("/").pop() ? `@${profile.linkedin.split("/").pop()}` : "" },
    { icon: Github, label: "GitHub", href: `https://${profile.github}`, value: profile.github.split("/").pop() ? `@${profile.github.split("/").pop()}` : "" },
    { icon: Twitter, label: "Twitter", href: `https://${profile.twitter}`, value: profile.twitter.split("/").pop() ? `@${profile.twitter.split("/").pop()}` : "" },
  ], [profile]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 25_000);

      const res = await fetch(`${API_BASE_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
        signal: controller.signal,
      });
      clearTimeout(t);

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 429 && data?.retry_after_seconds) {
          throw new Error(`Too many messages. Please try again in ${data.retry_after_seconds}s.`);
        }
        throw new Error(data?.error || "Request failed");
      }

      toast.success("Message sent! I'll get back to you soon.");
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      console.error("Contact form error:", err);
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "Sending took too long — please try again."
          : err instanceof Error
            ? err.message
            : "Couldn't send right now. Please try again in a moment.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">
          Get In <span className="text-gradient-unc">Touch</span>
        </h2>
        <p className="text-muted-foreground">Let's build something amazing together</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-3"
      >
        {socialLinks.map((link) => {
          const Icon = link.icon;
          return (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors group"
            >
              <Icon className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">{link.label}</span>
                <span className="text-sm font-medium group-hover:text-primary transition-colors">{link.value}</span>
              </div>
            </a>
          );
        })}
      </motion.div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="bg-secondary/30 border-border/50"
          />
          <Input
            type="email"
            placeholder="Your Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-secondary/30 border-border/50"
          />
        </div>
        <Textarea
          placeholder="Your Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={4}
          className="bg-secondary/30 border-border/50 resize-none"
        />
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-primary hover:bg-primary/90"
        >
          {isSubmitting ? "Sending..." : "Send Message"}
          <Send className="w-4 h-4 ml-2" />
        </Button>
      </motion.form>
    </div>
  );
};

export default ContactContent;