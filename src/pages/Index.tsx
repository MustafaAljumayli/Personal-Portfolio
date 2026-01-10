import { useState, useCallback } from "react";
import GlobeScene from "@/components/Globe/GlobeScene";
import SpaceNav from "@/components/Navigation/SpaceNav";
import ContentPanel from "@/components/Content/ContentPanel";
import BlogOverlay from "@/components/Blog/BlogOverlay";

const Index = () => {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);

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
      {/* Star field background */}
      <div className="star-field" />
      
      {/* 3D Globe */}
      <GlobeScene 
        activeSection={activeSection}
        onSectionReady={handleSectionReady}
      />

      {/* Navigation */}
      <SpaceNav 
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
      />

      {/* Content Panels (for non-blog sections) */}
      <ContentPanel 
        activeSection={activeSection}
        onClose={handleCloseContent}
        showContent={showContent}
      />

      {/* Blog Overlay */}
      <BlogOverlay 
        isVisible={activeSection === "blog" && showContent}
        onClose={handleCloseContent}
      />

      {/* Hero text when nothing is selected */}
      {!activeSection && (
        <div className="fixed bottom-20 left-0 right-0 flex flex-col items-center pointer-events-none">
          <h1 className="font-display text-4xl md:text-6xl font-bold text-center glow-text">
            <span className="text-gradient">Mustafa</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-center">
            Software Engineer • Creative Technologist
          </p>
          <p className="text-muted-foreground/60 text-sm mt-4">
            Click and drag to explore • Select a menu item to learn more
          </p>
        </div>
      )}
    </div>
  );
};

export default Index;