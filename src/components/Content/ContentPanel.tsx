import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import AboutContent from "./AboutContent";
import WorkContent from "./WorkContent";
import SkillsContent from "./SkillsContent";
import ContactContent from "./ContactContent";
import ResumeContent from "./ResumeContent";
import AIChat from "./AIChat";

interface ContentPanelProps {
  activeSection: string | null;
  onClose: () => void;
  showContent: boolean;
}

const ContentPanel = ({ activeSection, onClose, showContent }: ContentPanelProps) => {
  if (!activeSection || activeSection === "blog") return null;

  const renderContent = () => {
    switch (activeSection) {
      case "about":
        return <AboutContent />;
      case "work":
        return <WorkContent />;
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
    <AnimatePresence>
      {showContent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-30 flex items-center justify-center p-6 pointer-events-none"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="glass-panel p-6 md:p-8 max-w-2xl w-full max-h-[70vh] overflow-y-auto custom-scrollbar pointer-events-auto"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-secondary/50 hover:bg-secondary text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            {renderContent()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ContentPanel;