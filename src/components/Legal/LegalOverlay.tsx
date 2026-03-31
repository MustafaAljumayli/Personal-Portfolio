import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { blogInnerVariants, blogShellVariants } from "@/lib/uiMotion";

interface LegalOverlayProps {
  isVisible: boolean;
  kind: "privacy" | "terms";
}

const privacyPoints = [
  "We collect limited data (name, email, comments, and reaction metadata) when you engage with blog features.",
  "Email data is used for moderation, abuse prevention, and optional reply notifications.",
  "You can request deletion of your engagement data using the contact section.",
  "Data is not sold; reasonable safeguards are applied, but internet systems cannot guarantee absolute security.",
];

const termsPoints = [
  "By using blog engagement features, you agree to these terms and your responsibility for submitted content.",
  "Abusive, unlawful, or misleading content may be edited, moderated, removed, or blocked.",
  "Mustafa may reply by email, but response timing and availability are not guaranteed.",
  "Website content is owned by Mustafa unless otherwise stated. Terms may be updated over time.",
];

export default function LegalOverlay({ isVisible, kind }: LegalOverlayProps) {
  const navigate = useNavigate();
  const title = kind === "privacy" ? "Privacy Policy" : "Terms and Conditions";
  const items = kind === "privacy" ? privacyPoints : termsPoints;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key={`legal-overlay-${kind}`}
          variants={blogShellVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+5.5rem)] bottom-[8vh] z-30 px-4 sm:px-6 md:bottom-[14vh] md:top-[10vh] max-md:[@media(orientation:landscape)]:z-[60] max-md:[@media(orientation:landscape)]:bottom-[2vh] max-md:[@media(orientation:landscape)]:top-[calc(env(safe-area-inset-top)+4rem)]"
        >
          <div className="h-full max-w-4xl mx-auto overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-xl">
            <div className="h-full overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8">
              <motion.div
                variants={blogInnerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="space-y-6"
              >
                <button
                  onClick={() => navigate("/blog")}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Blog
                </button>
                <article className="glass-panel p-5 sm:p-8 space-y-4">
                  <h1 className="font-display text-3xl sm:text-4xl font-bold">{title}</h1>
                  <p className="text-sm text-muted-foreground">Last updated: March 30, 2026</p>
                  <ul className="space-y-3 text-sm text-muted-foreground leading-7">
                    {items.map((point) => (
                      <li key={point}>- {point}</li>
                    ))}
                  </ul>
                </article>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
