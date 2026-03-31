import { useState, useCallback, useEffect, useRef, memo } from "react";
import { MotionConfig } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import GlobeScene from "@/components/Globe/GlobeScene";
import SpaceNav from "@/components/Navigation/SpaceNav";
import ContentPanel from "@/components/Content/ContentPanel";
import BlogOverlay from "@/components/Blog/BlogOverlay";
import LegalOverlay from "@/components/Legal/LegalOverlay";
import EngagementProfileOverlay from "@/components/Engagement/EngagementProfileOverlay";
import PerformanceInstructionsOverlay from "@/components/Performance/PerformanceInstructionsOverlay";
import Auth from "@/pages/Auth";
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
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);
  const [globeReady, setGlobeReady] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  /** After panel exit animation, clear `activeSection` (replaces fixed 300ms timeout). */
  const closeToHomeAfterPanelExitRef = useRef(false);
  /** Prevent route-sync re-open while closing a routed panel. */
  const suppressRouteSyncRef = useRef(false);
  const sectionRouteMap: Record<string, string> = {
    about: "/about",
    projects: "/projects",
    skills: "/skills",
    contact: "/contact",
    resume: "/resume",
    ai: "/ai",
    blog: "/blog",
  };
  const routeSectionMap: Record<string, string> = {
    "/about": "about",
    "/projects": "projects",
    "/skills": "skills",
    "/contact": "contact",
    "/resume": "resume",
    "/ai": "ai",
    "/blog": "blog",
  };
  const blogRouteMatch = /^\/blog\/([^/]+)$/.exec(location.pathname);
  const routeBlogSlug = blogRouteMatch?.[1] ? decodeURIComponent(blogRouteMatch[1]) : null;
  const isBlogRoute = location.pathname === "/blog" || routeBlogSlug !== null;
  const isPrivacyRoute = location.pathname === "/privacy-policy";
  const isTermsRoute = location.pathname === "/terms-and-conditions";
  const isEngagementProfileRoute = location.pathname === "/profile";
  const isPerformanceInstructionsRoute = location.pathname === "/performance-instructions";
  const isAuthRoute = location.pathname === "/auth";
  const isOverlayRoute =
    isBlogRoute || isPrivacyRoute || isTermsRoute || isEngagementProfileRoute || isPerformanceInstructionsRoute || isAuthRoute;
  const routedSection = routeSectionMap[location.pathname] ?? null;

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
      suppressRouteSyncRef.current = false;
      if (section && sectionRouteMap[section]) {
        const nextPath = sectionRouteMap[section];
        if (location.pathname !== nextPath) navigate(nextPath);
        closeToHomeAfterPanelExitRef.current = false;
        setShowContent(true);
        setActiveSection(section);
        return;
      }

      if (section && isOverlayRoute && location.pathname !== "/") {
        navigate("/");
        closeToHomeAfterPanelExitRef.current = false;
        setShowContent(false);
        setActiveSection(section);
        return;
      }

      // Logo / “go home”: must not clear activeSection while ContentPanel is mounted or AnimatePresence
      // unmounts instantly and exit transitions never run (felt as a sharp cut).
      if (section === null) {
        if (routedSection && location.pathname !== "/") {
          suppressRouteSyncRef.current = true;
          navigate("/");
          setShowContent(false);
          setActiveSection(null);
          closeToHomeAfterPanelExitRef.current = false;
          return;
        }
        if (isOverlayRoute && location.pathname !== "/") {
          suppressRouteSyncRef.current = true;
          navigate("/");
          setShowContent(false);
          setActiveSection(null);
          closeToHomeAfterPanelExitRef.current = false;
          return;
        }
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
        if (routedSection && location.pathname !== "/") {
          navigate("/");
          setShowContent(false);
          setActiveSection(null);
          closeToHomeAfterPanelExitRef.current = false;
          return;
        }
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
    [activeSection, isOverlayRoute, location.pathname, navigate, routedSection, showContent]
  );

  const handleSectionReady = useCallback(() => {
    setShowContent(true);
  }, []);

  const handleCloseContent = useCallback(() => {
    setShowContent(false);
    // Any routed panel/overlay should close back to home in one click.
    if (location.pathname !== "/") {
      suppressRouteSyncRef.current = true;
      navigate("/");
      setActiveSection(null);
      closeToHomeAfterPanelExitRef.current = false;
      return;
    }
    if (activeSection === "blog") {
      if (location.pathname !== "/") navigate("/");
      setActiveSection(null);
      closeToHomeAfterPanelExitRef.current = false;
      return;
    }
    closeToHomeAfterPanelExitRef.current = true;
  }, [activeSection, location.pathname, navigate]);

  useEffect(() => {
    if (!globeReady) return;
    if (suppressRouteSyncRef.current) {
      if (location.pathname === "/") {
        suppressRouteSyncRef.current = false;
      } else {
        return;
      }
    }
    if (routedSection) {
      closeToHomeAfterPanelExitRef.current = false;
      if (activeSection !== routedSection) setActiveSection(routedSection);
      setShowContent(true);
      return;
    }
    if (isBlogRoute) {
      closeToHomeAfterPanelExitRef.current = false;
      if (activeSection !== "blog") setActiveSection("blog");
      setShowContent(true);
      return;
    }

    if (isAuthRoute) {
      closeToHomeAfterPanelExitRef.current = false;
      setShowContent(false);
      if (activeSection !== null) setActiveSection(null);
      return;
    }

    if (isPrivacyRoute || isTermsRoute || isEngagementProfileRoute || isPerformanceInstructionsRoute) {
      closeToHomeAfterPanelExitRef.current = false;
      if (activeSection !== "blog") setActiveSection("blog");
      setShowContent(true);
      return;
    }

    if (activeSection === "blog") {
      setShowContent(false);
      setActiveSection(null);
      closeToHomeAfterPanelExitRef.current = false;
    }
  }, [
    activeSection,
    globeReady,
    isBlogRoute,
    isAuthRoute,
    isEngagementProfileRoute,
    isPerformanceInstructionsRoute,
    isPrivacyRoute,
    isTermsRoute,
    location.pathname,
    routedSection,
  ]);

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
            isVisible={activeSection === "blog" && showContent && isBlogRoute}
            onClose={handleCloseContent}
            routeSlug={routeBlogSlug}
          />
        ) : null}

        {globeReady ? (
          <LegalOverlay isVisible={showContent && isPrivacyRoute} kind="privacy" />
        ) : null}
        {globeReady ? (
          <LegalOverlay isVisible={showContent && isTermsRoute} kind="terms" />
        ) : null}
        {globeReady ? (
          <EngagementProfileOverlay isVisible={showContent && isEngagementProfileRoute} />
        ) : null}
        {globeReady ? (
          <PerformanceInstructionsOverlay isVisible={showContent && isPerformanceInstructionsRoute} />
        ) : null}
        {globeReady && isAuthRoute ? <Auth isOverlay /> : null}

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