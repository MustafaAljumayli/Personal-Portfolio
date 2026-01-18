import { useState, useCallback } from "react";
import GlobeScene from "@/components/Globe/GlobeScene";
import SpaceNav from "@/components/Navigation/SpaceNav";
import ContentPanel from "@/components/Content/ContentPanel";
import BlogOverlay from "@/components/Blog/BlogOverlay";

const Index = () => {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);

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
    <div className="h-screen w-screen overflow-hidden bg-background">
      {/* Star field background (render after globe is ready to avoid "stars+nav, no earth" flash) */}
      {globeReady ? <div className="star-field" /> : null}

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
            <span className="text-gradient-unc">Mustafa Aljumayli</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-center">
            Software Engineer • AI Researcher • UNC Chapel Hill Alum • Georgia Tech AI Master's Student
          </p>
          <p className="text-muted-foreground/60 text-sm mt-4">
            Click and drag to explore • Select a menu item to learn more
          </p>
        </div>
      )}

      {!globeReady ? (
        <div className="fixed inset-0 flex items-center justify-center text-muted-foreground">
          Loading the Universe...
        </div>
      ) : null}
    </div>
  );
};

export default Index;