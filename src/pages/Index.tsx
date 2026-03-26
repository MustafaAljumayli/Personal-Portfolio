import { useState, useCallback, useEffect, useRef, memo } from "react";
import { MotionConfig } from "framer-motion";
import GlobeScene from "@/components/Globe/GlobeScene";
import SpaceNav from "@/components/Navigation/SpaceNav";
import ContentPanel from "@/components/Content/ContentPanel";
import BlogOverlay from "@/components/Blog/BlogOverlay";
import { useResumeData } from "@/hooks/useResumeData";
import ScratchRevealLoader from "@/components/Loading/ScratchRevealLoader";
import { useProgress } from "@react-three/drei";

/**
 * useProgress() updates very frequently during load; keep it in an isolated subtree so
 * Index / GlobeScene / panels don't re-render on every tick (major source of animation jank).
 */
const GlobeLoadProgressBridge = memo(function GlobeLoadProgressBridge({
  globeReady,
  onAssetsIdle,
}: {
  globeReady: boolean;
  onAssetsIdle: () => void;
}) {
  const { active, progress } = useProgress();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (!globeReady || active || progress < 100) return;
    firedRef.current = true;
    onAssetsIdle();
  }, [active, globeReady, onAssetsIdle, progress]);

  return null;
});

const Index = () => {
  const { settings } = useResumeData();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  /** After panel exit animation, clear `activeSection` (replaces fixed 300ms timeout). */
  const closeToHomeAfterPanelExitRef = useRef(false);

  const handleGlobeReady = useCallback(() => {
    setGlobeReady(true);
  }, []);

  const handleAssetsIdle = useCallback(() => {
    setInitialLoadComplete(true);
  }, []);

  const handlePanelExitComplete = useCallback(() => {
    if (closeToHomeAfterPanelExitRef.current) {
      closeToHomeAfterPanelExitRef.current = false;
      setActiveSection(null);
    }
  }, []);

  const handleSectionChange = useCallback(
    (section: string | null) => {
      // Logo / “go home”: must not clear activeSection while ContentPanel is mounted or AnimatePresence
      // unmounts instantly and exit transitions never run (felt as a sharp cut).
      if (section === null) {
        if (!activeSection) return;
        setShowContent(false);
        if (activeSection === "blog") {
          setActiveSection(null);
          closeToHomeAfterPanelExitRef.current = false;
          return;
        }
        if (showContent) {
          closeToHomeAfterPanelExitRef.current = true;
          return;
        }
        setActiveSection(null);
        closeToHomeAfterPanelExitRef.current = false;
        return;
      }

      if (section === activeSection) {
        setShowContent(false);
        if (activeSection === "blog") {
          setActiveSection(null);
          closeToHomeAfterPanelExitRef.current = false;
          return;
        }
        closeToHomeAfterPanelExitRef.current = true;
        return;
      }
      closeToHomeAfterPanelExitRef.current = false;
      setShowContent(false);
      setActiveSection(section);
    },
    [activeSection, showContent]
  );

  const handleSectionReady = useCallback(() => {
    setShowContent(true);
  }, []);

  const handleCloseContent = useCallback(() => {
    setShowContent(false);
    if (activeSection === "blog") {
      setActiveSection(null);
      closeToHomeAfterPanelExitRef.current = false;
      return;
    }
    closeToHomeAfterPanelExitRef.current = true;
  }, [activeSection]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <GlobeLoadProgressBridge globeReady={globeReady} onAssetsIdle={handleAssetsIdle} />
      <ScratchRevealLoader
        enabled={!initialLoadComplete}
        done={initialLoadComplete}
      />
      <MotionConfig reducedMotion="user">
        {/* 3D Globe */}
        <GlobeScene
          activeSection={activeSection}
          onSectionReady={handleSectionReady}
          onGlobeReady={handleGlobeReady}
        />

        {/* Navigation */}
        {globeReady ? (
          <SpaceNav
            activeSection={activeSection}
            onSectionChange={handleSectionChange}
          />
        ) : null}

        {/* Content Panels (for non-blog sections) */}
        {globeReady ? (
          <ContentPanel
            activeSection={activeSection}
            onClose={handleCloseContent}
            showContent={showContent}
            onExitComplete={handlePanelExitComplete}
          />
        ) : null}

        {/* Blog Overlay */}
        {globeReady ? (
          <BlogOverlay
            isVisible={activeSection === "blog" && showContent}
            onClose={handleCloseContent}
          />
        ) : null}

        {/* Hero text when nothing is selected */}
        {globeReady && !activeSection && (
          <div className="fixed bottom-20 left-0 right-0 flex flex-col items-center pointer-events-none">
            <h1 className="font-display text-4xl md:text-6xl font-bold text-center glow-text">
              <span className="text-gradient-unc">{settings.name}</span>
            </h1>
            <p className="text-muted-foreground mt-2 text-center">
              {settings.headline}
            </p>
            <p className="text-muted-foreground/60 mt-2">
              {settings.greeting}
            </p>
          </div>
        )}
      </MotionConfig>

      {/* loader overlay handled by InteractiveLoader */}
    </div>
  );
};

export default Index;