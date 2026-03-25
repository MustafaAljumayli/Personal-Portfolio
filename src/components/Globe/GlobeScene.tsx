import { Suspense, useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { cn } from "@/lib/utils";
import { isMobileDevice } from "@/lib/device";
import Earth from "./Earth";
import MilkyWay from "./MilkyWay";

interface GlobeSceneProps {
  activeSection: string | null;
  onSectionReady: () => void;
  onGlobeReady?: () => void;
  cameraPosition?: { x: number; y: number; z: number };
}

const DEFAULT_CAMERA = new THREE.Vector3(0, 0, 6);

const sectionCoordinates: Record<string, { rotation: { x: number; y: number }; camera: { x: number; y: number; z: number } }> = {
  about: { rotation: { x: 0.2, y: -0.5 }, camera: { x: 2, y: 1, z: 4 } },
  projects: { rotation: { x: 0, y: 0.8 }, camera: { x: -2, y: 0.5, z: 4 } },
  skills: { rotation: { x: -0.3, y: 2.2 }, camera: { x: 1, y: -1, z: 4 } },
  contact: { rotation: { x: 0.4, y: 3.5 }, camera: { x: -1, y: 1.5, z: 4 } },
  resume: { rotation: { x: -0.2, y: 4.8 }, camera: { x: 0, y: -0.5, z: 4.5 } },
  blog: { rotation: { x: 0, y: 0 }, camera: { x: 0, y: 8, z: 3 } },
  ai: { rotation: { x: 0.1, y: 1.5 }, camera: { x: 3, y: 0, z: 3 } },
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

    if (activeSection && sectionCoordinates[activeSection]) {
      const { camera: cam } = sectionCoordinates[activeSection];
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

    camera.position.lerp(targetPosition.current, delta * 2);
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

const GlobeContent = ({ activeSection, onSectionReady, onGlobeReady }: GlobeSceneProps) => {
  const [rotationComplete, setRotationComplete] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const { gl } = useThree();
  const isPointerDownRef = useRef(false);
  const hasSignaledGlobeReadyRef = useRef(false);
  const prevSectionRef = useRef<string | null>(null);

  // Detect when we're transitioning from a section back to null.
  // Check synchronously during render so there's no one-frame gap where controls re-enable.
  const justDeactivated = prevSectionRef.current !== null && activeSection === null;
  const controlsLocked = !!activeSection || isReturning || justDeactivated;

  const targetRotation = activeSection && sectionCoordinates[activeSection]
    ? sectionCoordinates[activeSection].rotation
    : null;

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
      <ambientLight intensity={0.25} />
      <directionalLight position={[5, 3, 5]} intensity={5.0} />
      <pointLight position={[-10, -10, -10]} intensity={6} color="#4da6ff" />
      <MilkyWay />
      <Earth
        isAutoRotating={!controlsLocked}
        targetRotation={targetRotation}
        onRotationComplete={handleRotationComplete}
      />
    </>
  );
};

const GlobeScene = (props: GlobeSceneProps) => {
  const [globeReady, setGlobeReady] = useState(false);
  const isMobile = isMobileDevice();

  const handleGlobeReady = () => {
    setGlobeReady(true);
    props.onGlobeReady?.();
  };

  return (
    <div
      className={cn(
        "absolute inset-0 transition-transform duration-700 ease-out",
        props.activeSection === "blog" ? "translate-y-[65vh] scale-[0.9]" : "translate-y-0 scale-100"
      )}
    >
      <div
        className={cn(
          "h-full w-full transition-all duration-700 ease-out transform-gpu will-change-transform",
          globeReady ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-[0.98] blur-[2px]"
        )}
      >
        <Canvas
          camera={{ position: [0, 0, 6], fov: 45 }}
          dpr={isMobile ? [1, 1.5] : [1, 2]}
          performance={{ min: isMobile ? 0.5 : 0.75 }}
          gl={{
            antialias: !isMobile,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
          }}
        >
          <Suspense fallback={null}>
            <GlobeContent {...props} onGlobeReady={handleGlobeReady} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
};

export default GlobeScene;