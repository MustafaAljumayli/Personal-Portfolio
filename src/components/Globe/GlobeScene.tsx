import { Suspense, useRef, useEffect, useState, useCallback, memo, useMemo } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { isMobileDevice } from "@/lib/device";
import { toast } from "sonner";
import Earth from "./Earth";
import MilkyWay from "./MilkyWay";
import { warmKtx2TranscoderForRenderer } from "@/hooks/useDeferredKtx2Upgrade";

interface GlobeSceneProps {
  activeSection: string | null;
  onSectionReady: () => void;
  onGlobeReady?: () => void;
  cameraPosition?: { x: number; y: number; z: number };
}

const DEFAULT_CAMERA = new THREE.Vector3(0, 0, 6);

const sectionCameraCoordinates: Record<string, { camera: { x: number; y: number; z: number } }> = {
  about: { camera: { x: 2, y: 1, z: 4 } },
  projects: { camera: { x: -2, y: 0.5, z: 4 } },
  skills: { camera: { x: 1, y: -1, z: 4 } },
  contact: { camera: { x: -1, y: 1.5, z: 4 } },
  resume: { camera: { x: 0, y: -0.5, z: 4.5 } },
  // Keep the globe inside the same canvas; "zoom out" effect via camera distance.
  blog: { camera: { x: 0, y: 6, z: 8 } },
  ai: { camera: { x: 3, y: 0, z: 3 } },
};

const CameraController = ({
  activeSection,
  onArrived,
}: {
  activeSection: string | null;
  onArrived: (section: string | null) => void;
}) => {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3().copy(DEFAULT_CAMERA));
  const arrived = useRef(true);
  const prevSection = useRef<string | null>(null);
  const targetSection = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevSection.current;
    prevSection.current = activeSection;

    if (activeSection && sectionCameraCoordinates[activeSection]) {
      const { camera: cam } = sectionCameraCoordinates[activeSection];
      targetPosition.current.set(cam.x, cam.y, cam.z);
      arrived.current = false;
      targetSection.current = activeSection;
    } else if (prev) {
      targetPosition.current.copy(DEFAULT_CAMERA);
      arrived.current = false;
      targetSection.current = null;
    }
  }, [activeSection]);

  useFrame((_, delta) => {
    if (arrived.current) return;

    // Framerate-independent smoothstep toward target (avoids choppy lerp at variable dt).
    const t = 1 - Math.exp(-delta * 2.15);
    camera.position.lerp(targetPosition.current, t);
    camera.lookAt(0, 0, 0);

    if (camera.position.distanceTo(targetPosition.current) < 0.1) {
      arrived.current = true;
      onArrived(targetSection.current);
    }
  });

  return null;
};

const ContextLossHandler = () => {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (e: Event) => {
      e.preventDefault();
      console.warn("WebGL context lost — pausing render");
    };
    const handleRestored = () => {
      console.info("WebGL context restored");
    };
    canvas.addEventListener("webglcontextlost", handleLost);
    canvas.addEventListener("webglcontextrestored", handleRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", handleLost);
      canvas.removeEventListener("webglcontextrestored", handleRestored);
    };
  }, [gl]);
  return null;
};

/**
 * Fixes occasional “black padding” (canvas size mismatch) after tab switch / return.
 * We force a re-measure and re-apply canvas size on visibility/focus and container resize.
 */
const CanvasResizeFix = () => {
  const { gl, invalidate, size } = useThree();
  const didInitialInvalidate = useRef(false);
  /** Avoid [size] in effect deps — Chromium + R3F can churn size and re-run this effect (observer churn). */
  const sizeRef = useRef(size);
  sizeRef.current = size;

  useEffect(() => {
    const canvas = gl.domElement;
    const parent = canvas.parentElement;
    if (!parent) return;

    const apply = () => {
      // Important: use layout size (clientWidth/clientHeight) instead of boundingClientRect,
      // because bounding rect includes CSS transforms (scale/translate), which we apply while
      // animating the blog overlay and can cause the canvas to stay undersized.
      const w0 = parent.clientWidth;
      const h0 = parent.clientHeight;
      const rect = parent.getBoundingClientRect();
      const w = Math.max(1, Math.round(w0 || rect.width || 1));
      const h = Math.max(1, Math.round(h0 || rect.height || 1));

      const { width: sw, height: sh } = sizeRef.current;
      const changed = w !== sw || h !== sh;
      if (changed) {
        gl.setSize(w, h, false);
        invalidate();
      } else if (!didInitialInvalidate.current) {
        // First layout pass after mount — ensure one sync if R3F size already matched.
        didInitialInvalidate.current = true;
        invalidate();
      }
    };

    let scheduled = 0;
    const scheduleApply = () => {
      if (scheduled) cancelAnimationFrame(scheduled);
      scheduled = requestAnimationFrame(() => {
        scheduled = 0;
        apply();
      });
    };

    // Initial measure after mount (size may match; apply only invalidates if setSize ran).
    const raf = requestAnimationFrame(() => {
      apply();
    });

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // Let the browser finish any layout changes triggered by returning to the tab.
      setTimeout(() => apply(), 0);
    };

    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("resize", scheduleApply);
    window.addEventListener("orientationchange", scheduleApply);
    document.addEventListener("fullscreenchange", scheduleApply);

    return () => {
      cancelAnimationFrame(raf);
      if (scheduled) cancelAnimationFrame(scheduled);
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("resize", scheduleApply);
      window.removeEventListener("orientationchange", scheduleApply);
      document.removeEventListener("fullscreenchange", scheduleApply);
    };
  }, [gl, invalidate]);

  return null;
};

/**
 * Shows a sticky hint when FPS is sustained below 50.
 * - stays visible until sustained recovery above 50 FPS
 * - or until the user manually dismisses it
 */
const FpsWarningMonitor = ({ enabled }: { enabled: boolean }) => {
  const TOAST_ID = "fps-warning";
  const RECOVERY_TOAST_ID = "fps-recovered";
  const navigate = useNavigate();
  const sampleSecondsRef = useRef(0);
  const sampleFramesRef = useRef(0);
  const lowFpsSecondsRef = useRef(0);
  const recoveredSecondsRef = useRef(0);
  const toastVisibleRef = useRef(false);
  const dismissedByUserRef = useRef(false);
  const hadVisibleWarningRef = useRef(false);

  useEffect(() => {
    if (enabled) return;
    toast.dismiss(TOAST_ID);
    toast.dismiss(RECOVERY_TOAST_ID);
    toastVisibleRef.current = false;
    dismissedByUserRef.current = false;
    hadVisibleWarningRef.current = false;
    lowFpsSecondsRef.current = 0;
    recoveredSecondsRef.current = 0;
  }, [enabled]);

  useFrame((_, delta) => {
    if (!enabled) return;
    if (document.visibilityState !== "visible") return;

    sampleSecondsRef.current += delta;
    sampleFramesRef.current += 1;

    if (sampleSecondsRef.current < 1) return;

    const fps = sampleFramesRef.current / sampleSecondsRef.current;
    sampleSecondsRef.current = 0;
    sampleFramesRef.current = 0;

    if (fps < 50) {
      lowFpsSecondsRef.current += 1;
      recoveredSecondsRef.current = 0;
    } else {
      lowFpsSecondsRef.current = 0;
      recoveredSecondsRef.current += 1;
    }

    if (fps >= 50 && recoveredSecondsRef.current >= 3) {
      if (toastVisibleRef.current) {
        toast.dismiss(TOAST_ID);
        toastVisibleRef.current = false;
      }
      if (hadVisibleWarningRef.current) {
        toast.success("FPS recovered to 50+! 🎉", {
          id: RECOVERY_TOAST_ID,
          position: "bottom-right",
          duration: 6000,
          description: "That worked. Enjoy your enhanced site experience. Love you! <3 :)",
        });
        hadVisibleWarningRef.current = false;
      }
      // Allow future low-FPS warnings once conditions had recovered.
      dismissedByUserRef.current = false;
      return;
    }

    if (lowFpsSecondsRef.current < 4) return;
    if (toastVisibleRef.current || dismissedByUserRef.current) return;

    toastVisibleRef.current = true;
    hadVisibleWarningRef.current = true;
    toast("Hey, your browser is rendering below 50 FPS!", {
      id: TOAST_ID,
      position: "bottom-right",
      duration: Infinity,
      onDismiss: () => {
        toastVisibleRef.current = false;
        dismissedByUserRef.current = true;
      },
      description: (
        <span>
          Most 3D sites actually have this issue but jokes on them; I need you to have the best user experience possible. This can happen when Energy Saver is enabled in your browser.{" "}
          <button
            type="button"
            onClick={() => {
              navigate("/performance-instructions");
            }}
            className="font-medium text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
          >
            Click here to fix it
          </button>
          .
        </span>
      ),
    });
  });

  return null;
};

const GlobeContent = ({ activeSection, onSectionReady, onGlobeReady }: GlobeSceneProps) => {
  const [rotationComplete, setRotationComplete] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { gl } = useThree();
  const isPointerDownRef = useRef(false);

  useEffect(() => {
    // Avoid creating an extra deferred KTX2Loader on desktop.
    // Desktop uses Suspense-based KTX2 loading; warming deferred on desktop can overlap init
    // across multiple loader instances and trigger THREE's "Multiple active KTX2 loaders" warning.
    if (!isMobileDevice()) return;
    warmKtx2TranscoderForRenderer(gl);
  }, [gl]);
  const hasSignaledGlobeReadyRef = useRef(false);
  const prevSectionRef = useRef<string | null>(null);

  // Detect when we're transitioning from a section back to null.
  // Check synchronously during render so there's no one-frame gap where controls re-enable.
  const justDeactivated = prevSectionRef.current !== null && activeSection === null;
  const controlsLocked = !!activeSection || isReturning || justDeactivated;

  const targetRotation = useMemo(() => {
    if (!activeSection) return null;
    return {
      // Keep section focus random but within a comfortable latitude window.
      x: THREE.MathUtils.randFloat(-0.45, 0.45),
      // Full longitude range for variety.
      y: THREE.MathUtils.randFloat(-Math.PI, Math.PI),
    };
  }, [activeSection]);

  useEffect(() => {
    const prev = prevSectionRef.current;
    prevSectionRef.current = activeSection;
    if (prev && !activeSection) {
      setIsReturning(true);
    }
  }, [activeSection]);

  const handleCameraArrived = useCallback((section: string | null) => {
    if (!section) {
      setIsReturning(false);
    }
  }, []);

  const handleRotationComplete = () => {
    setRotationComplete(true);
  };

  useEffect(() => {
    setRotationComplete(false);
  }, [activeSection]);

  useEffect(() => {
    if (rotationComplete) {
      onSectionReady();
    }
  }, [rotationComplete, onSectionReady]);

  useEffect(() => {
    if (hasSignaledGlobeReadyRef.current) return;
    hasSignaledGlobeReadyRef.current = true;
    onGlobeReady?.();
  }, [onGlobeReady]);

  useEffect(() => {
    const el = gl.domElement;

    const handlePointerDown = () => {
      isPointerDownRef.current = true;
    };
    const handlePointerUp = () => {
      isPointerDownRef.current = false;
    };
    const handleWheel = (e: WheelEvent) => {
      if (!isPointerDownRef.current) return;
      e.preventDefault();
      e.stopPropagation();
    };

    el.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    el.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      el.removeEventListener("wheel", handleWheel as EventListener);
    };
  }, [gl]);

  return (
    <>
      <ContextLossHandler />
      <CameraController activeSection={activeSection} onArrived={handleCameraArrived} />
      <OrbitControls
        ref={controlsRef}
        enableZoom={!controlsLocked}
        enablePan={false}
        enableRotate={!controlsLocked}
        rotateSpeed={0.5}
        zoomSpeed={0.5}
        minDistance={3}
        maxDistance={10}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.8}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.ROTATE,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 3, 5]} intensity={5.5} color="#ffffff" />
      <MilkyWay />
      <Earth
        isAutoRotating={!controlsLocked}
        targetRotation={targetRotation}
        onRotationComplete={handleRotationComplete}
      />
    </>
  );
};

function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(
      c.getContext("webgl2") ||
      c.getContext("webgl") ||
      c.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

const WebGLFallback = () => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6">
    <div className="w-full max-w-lg rounded-xl border border-border/60 bg-card/70 p-6 text-center shadow-xl backdrop-blur">
      <img src="/astronautpfp.PNG" alt="Mustafa" className="mx-auto mb-4 w-[160px] rounded-full" />
      <h1 className="font-display text-3xl font-bold text-foreground">WebGL Is Not Available</h1>
      <p className="mt-4 text-muted-foreground leading-relaxed">
        Hey, it's Mustafa here! My site requires WebGL to render. 
        <br />(I know, I know, I'm sorry...Fun-fact:{" "}
        <a
          href="https://earth.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline underline-offset-2 hover:text-foreground/80"
        >
          Google Earth
        </a>{" "}
        actually has the same issue). <br /><br />If you're using{" "}
        <span className="font-medium text-foreground">Chrome</span>, hardware acceleration may be
        turned off. Follow the steps below to enable it:
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        or copy and paste this link into your browser:{" "}
        <code className="rounded bg-muted px-2 py-1 font-mono text-xs text-foreground select-all">
          chrome://settings/system
        </code>
      </p>
      <ol className="mx-auto mt-5 max-w-sm list-inside list-decimal space-y-2 text-left text-sm text-muted-foreground">
        <li>Open Chrome Settings.</li>
        <li>Go to System.</li>
        <li>Turn "Use graphics acceleration when available" ON.</li>
        <li>Click Relaunch to restart Chrome.</li>
      </ol>
      <p className="mt-4 text-xs text-muted-foreground/80">
        If you're on another browser, ensure WebGL or graphics acceleration is enabled or try any other browser that isn't Chromium-based. This website has been tested to work well on Safari, Firefox, Edge, and Atlas.
      </p>
    </div>
  </div>
);

const GlobeScene = memo(function GlobeScene(props: GlobeSceneProps) {
  const [globeReady, setGlobeReady] = useState(false);
  const webglSupported = useMemo(() => detectWebGL(), []);
  const desynchronized = useMemo(() => {
    // Chrome Desktop: `desynchronized` can cause uneven frame pacing (micro-stutter).
    // Mobile browsers tend to benefit more from reduced input latency.
    return isMobileDevice();
  }, []);

  const handleGlobeReady = useCallback(() => {
    setGlobeReady(true);
    props.onGlobeReady?.();
  }, [props.onGlobeReady]);

  if (!webglSupported) return <WebGLFallback />;

  return (
    <div className="absolute inset-0 translate-y-0 scale-100">
      {/* Gentle reveal once the scene is ready */}
      <div
        className={cn(
          "isolate h-full w-full transition-opacity duration-1000 ease-out",
          globeReady ? "opacity-100" : "opacity-0"
        )}
      >
        <Canvas
          camera={{ position: [0, 0, 6], fov: 45 }}
          // Continuous loop: keeps WebGL in sync with Framer Motion / tab transitions (demand can drop frames).
          frameloop="always"
          // Cap DPR at 1.5x - sharp on Retina without paying full 2x fill rate.
          dpr={[1, 1.5]}
          gl={{
            antialias: false,
            alpha: false,
            // Chromium: low-latency canvas (not in R3F types yet). Safari ignores if unsupported.
            ...({ desynchronized } as Record<string, unknown>),
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
            stencil: false,
            depth: true,
            preserveDrawingBuffer: false,
          }}
        >
          <Suspense fallback={null}>
            <FpsWarningMonitor enabled />
            <GlobeContent {...props} onGlobeReady={handleGlobeReady} />
            <CanvasResizeFix />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
});

export default GlobeScene;