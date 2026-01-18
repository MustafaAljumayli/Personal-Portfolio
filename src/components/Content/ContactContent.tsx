import { motion } from "framer-motion";
import { Mail, Linkedin, Github, Twitter, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const CONTACT_FORM_ENDPOINT = import.meta.env.VITE_CONTACT_FORM_ENDPOINT as string | undefined;

const socialLinks = [
  { icon: Mail, label: "Email", href: "mailto:mustafa@aljumayli.com", value: "mustafa@aljumayli.com" },
  { icon: Linkedin, label: "LinkedIn", href: "https://linkedin.com/in/mustafa-aljumayli", value: "/in/mustafa-aljumayli" },
  { icon: Github, label: "GitHub", href: "https://github.com/id-mustafa", value: "@id-mustafa" },
  { icon: Twitter, label: "Twitter", href: "https://twitter.com/mustafa", value: "@mustafa" },
];

const ContactContent = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mailtoFallback = () => {
    const subject = encodeURIComponent(`Portfolio contact from ${name || "someone"}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    );
    window.location.href = `mailto:mustafa@aljumayli.com?subject=${subject}&body=${body}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!CONTACT_FORM_ENDPOINT) {
        toast.message("Opening your email client…");
        mailtoFallback();
        return;
      }

      const res = await fetch(CONTACT_FORM_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          message,
          // Formspree uses "replyto" / "_replyto" patterns depending on setup; this is safe to include.
          _replyto: email,
        }),
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      toast.success("Message sent! I'll get back to you soon.");
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      console.error("Contact form error:", err);
      toast.error("Couldn't send right now — opening your email client instead.");
      mailtoFallback();
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