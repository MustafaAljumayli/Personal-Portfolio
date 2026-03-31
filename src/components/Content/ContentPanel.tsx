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
          className="fixed inset-0 z-30 bg-background/65 pointer-events-none max-md:[@media(orientation:landscape)]:z-[59]"
          variants={scrimFadeVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        />
      )}
      {showContent && (
        <motion.div
          key={`panel-card-${activeSection}`}
          className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center p-2 sm:p-4 md:p-6 max-md:[@media(orientation:landscape)]:z-[60] max-md:[@media(orientation:landscape)]:items-start max-md:[@media(orientation:landscape)]:px-2 max-md:[@media(orientation:landscape)]:pb-2 max-md:[@media(orientation:landscape)]:pt-[calc(env(safe-area-inset-top)+4.25rem)]"
          variants={contentCardVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className="custom-scrollbar pointer-events-auto relative z-10 max-h-[78dvh] w-full max-w-4xl overflow-y-auto overflow-x-hidden rounded-lg border border-border/50 bg-card/95 p-4 shadow-xl [transform:translateZ(0)] md:p-8 xl:max-w-5xl max-md:[@media(orientation:landscape)]:max-h-[calc(100dvh-env(safe-area-inset-top)-4.5rem)] max-md:[@media(orientation:landscape)]:p-2.5">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-secondary/50 text-foreground transition-colors hover:bg-secondary max-md:[@media(orientation:landscape)]:right-1.5 max-md:[@media(orientation:landscape)]:top-1.5 max-md:[@media(orientation:landscape)]:h-7 max-md:[@media(orientation:landscape)]:w-7"
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
