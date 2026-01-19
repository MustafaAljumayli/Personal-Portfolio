import { Suspense, useRef, useEffect, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import Earth from "./Earth";
import MilkyWay from "./MilkyWay";

interface GlobeSceneProps {
  activeSection: string | null;
  onSectionReady: () => void;
  onGlobeReady?: () => void;
  cameraPosition?: { x: number; y: number; z: number };
}

// Globe location coordinates for each section
const sectionCoordinates: Record<string, { rotation: { x: number; y: number }; camera: { x: number; y: number; z: number } }> = {
  about: { rotation: { x: 0.2, y: -0.5 }, camera: { x: 2, y: 1, z: 4 } },
  work: { rotation: { x: 0, y: 0.8 }, camera: { x: -2, y: 0.5, z: 4 } },
  skills: { rotation: { x: -0.3, y: 2.2 }, camera: { x: 1, y: -1, z: 4 } },
  contact: { rotation: { x: 0.4, y: 3.5 }, camera: { x: -1, y: 1.5, z: 4 } },
  resume: { rotation: { x: -0.2, y: 4.8 }, camera: { x: 0, y: -0.5, z: 4.5 } },
  blog: { rotation: { x: 0, y: 0 }, camera: { x: 0, y: 8, z: 3 } },
  ai: { rotation: { x: 0.1, y: 1.5 }, camera: { x: 3, y: 0, z: 3 } },
};

const CameraController = ({
  activeSection,
  onReady
}: {
  activeSection: string | null;
  onReady: () => void;
}) => {
  const { camera } = useThree();
  const targetPosition = useRef(new THREE.Vector3(0, 0, 6));
  const hasReachedTarget = useRef(false);

  useEffect(() => {
    hasReachedTarget.current = false;
    if (activeSection && sectionCoordinates[activeSection]) {
      const { camera: cam } = sectionCoordinates[activeSection];
      targetPosition.current.set(cam.x, cam.y, cam.z);
    } else {
      targetPosition.current.set(0, 0, 6);
    }
  }, [activeSection]);

  useFrame((state, delta) => {
    camera.position.lerp(targetPosition.current, delta * 2);
    camera.lookAt(0, 0, 0);

    const distance = camera.position.distanceTo(targetPosition.current);
    if (distance < 0.1 && !hasReachedTarget.current) {
      hasReachedTarget.current = true;
      onReady();
    }
  });

  return null;
};

const GlobeContent = ({ activeSection, onSectionReady, onGlobeReady }: GlobeSceneProps) => {
  const [rotationComplete, setRotationComplete] = useState(false);
  const controlsRef = useRef<any>(null);
  const { gl } = useThree();
  const isPointerDownRef = useRef(false);
  const hasSignaledGlobeReadyRef = useRef(false);

  const targetRotation = activeSection && sectionCoordinates[activeSection]
    ? sectionCoordinates[activeSection].rotation
    : null;

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

  // This component only mounts after Suspense resolves (i.e., textures are loaded).
  // Signal the parent so it can render nav/background AFTER the globe is ready.
  useEffect(() => {
    if (hasSignaledGlobeReadyRef.current) return;
    hasSignaledGlobeReadyRef.current = true;
    onGlobeReady?.();
  }, [onGlobeReady]);

  // Prevent trackpad "wheel" dolly from firing while actively dragging to rotate.
  // This keeps 2-finger scroll zoom, but avoids accidental zoom during click+drag.
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
      {/* Only drive the camera when a section is active. When free-rotating with OrbitControls,
          CameraController would fight user input and can feel like unintended zooming. */}
      {activeSection ? <CameraController activeSection={activeSection} onReady={() => { }} /> : null}
      <OrbitControls
        ref={controlsRef}
        enableZoom={!activeSection}
        enablePan={false}
        enableRotate={!activeSection}
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
      <directionalLight position={[5, 3, 5]} intensity={7.1} />
      <pointLight position={[-10, -10, -10]} intensity={10} color="#4da6ff" />
      <MilkyWay />
      <Earth
        isAutoRotating={!activeSection || activeSection === "blog"}
        targetRotation={targetRotation}
        onRotationComplete={handleRotationComplete}
      />
    </>
  );
};

const GlobeScene = (props: GlobeSceneProps) => {
  const [globeReady, setGlobeReady] = useState(false);

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
        <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
          <Suspense fallback={null}>
            <GlobeContent {...props} onGlobeReady={handleGlobeReady} />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
};

export default GlobeScene;