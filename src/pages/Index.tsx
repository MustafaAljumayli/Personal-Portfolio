import { useState, useCallback, useEffect } from "react";
import GlobeScene from "@/components/Globe/GlobeScene";
import SpaceNav from "@/components/Navigation/SpaceNav";
import ContentPanel from "@/components/Content/ContentPanel";
import BlogOverlay from "@/components/Blog/BlogOverlay";
import { useResumeData } from "@/hooks/useResumeData";
import ScratchRevealLoader from "@/components/Loading/ScratchRevealLoader";
import { useProgress } from "@react-three/drei";

const Index = () => {
  const { settings } = useResumeData();
  const { active, progress } = useProgress();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    if (initialLoadComplete) return;
    if (globeReady && !active && progress >= 100) {
      setInitialLoadComplete(true);
    }
  }, [active, globeReady, initialLoadComplete, progress]);

  const handleSectionChange = useCallback((section: string | null) => {
    if (section === activeSection) {
      // Clicking same section closes it
      setShowContent(false);
      setTimeout(() => setActiveSection(null), 300);
    } else {
      setShowContent(false);
      setActiveSection(section);
    }
  }, [activeSection]);

  const handleSectionReady = useCallback(() => {
    setShowContent(true);
  }, []);

  const handleCloseContent = useCallback(() => {
    setShowContent(false);
    setTimeout(() => setActiveSection(null), 300);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <ScratchRevealLoader
        enabled={!initialLoadComplete}
        done={initialLoadComplete}
      />
      {/* 3D Globe */}
      <GlobeScene
        activeSection={activeSection}
        onSectionReady={handleSectionReady}
        onGlobeReady={() => setGlobeReady(true)}
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

      {/* loader overlay handled by InteractiveLoader */}
    </div>
  );
};

export default Index;