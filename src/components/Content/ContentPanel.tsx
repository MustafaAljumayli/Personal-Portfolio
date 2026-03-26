import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { contentCardVariants, scrimFadeVariants } from "@/lib/uiMotion";
import AboutContent from "./AboutContent";
import SkillsContent from "./SkillsContent";
import ContactContent from "./ContactContent";
import ResumeContent from "./ResumeContent";
import AIChat from "./AIChat";
import ProjectsContent from "./ProjectsContent";

interface ContentPanelProps {
  activeSection: string | null;
  onClose: () => void;
  showContent: boolean;
  onExitComplete?: () => void;
}

/**
 * Blur + animated opacity over WebGL = huge per-frame cost → main thread stalls (“freeze then jump”).
 * Two keyed motion nodes under AnimatePresence (scrim fade + solid card motion). No backdrop-blur on animated layers.
 */
const ContentPanel = ({ activeSection, onClose, showContent, onExitComplete }: ContentPanelProps) => {
  if (!activeSection || activeSection === "blog") return null;

  const renderContent = () => {
    switch (activeSection) {
      case "about":
        return <AboutContent />;
      case "projects":
        return <ProjectsContent />;
      case "skills":
        return <SkillsContent />;
      case "contact":
        return <ContactContent />;
      case "resume":
        return <ResumeContent />;
      case "ai":
        return <AIChat />;
      default:
        return null;
    }
  };

  return (
    <AnimatePresence mode="sync" onExitComplete={onExitComplete}>
      {showContent && (
        <motion.div
          key={`panel-scrim-${activeSection}`}
          aria-hidden
          className="fixed inset-0 z-30 bg-background/65 pointer-events-none"
          variants={scrimFadeVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        />
      )}
      {showContent && (
        <motion.div
          key={`panel-card-${activeSection}`}
          className="fixed inset-0 z-30 flex items-center justify-center p-2 sm:p-6 pointer-events-none"
          variants={contentCardVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <div className="relative z-10 max-h-[70dvh] w-full max-w-2xl overflow-y-auto overflow-x-hidden rounded-lg border border-border/50 bg-card/95 p-4 shadow-xl md:p-8 custom-scrollbar pointer-events-auto [transform:translateZ(0)]">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-secondary/50 text-foreground transition-colors hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
            {renderContent()}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ContentPanel;
