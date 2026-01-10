import { Suspense, useRef, useEffect, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import Earth from "./Earth";
import Stars from "./Stars";

interface GlobeSceneProps {
  activeSection: string | null;
  onSectionReady: () => void;
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

const GlobeContent = ({ activeSection, onSectionReady }: GlobeSceneProps) => {
  const [rotationComplete, setRotationComplete] = useState(false);
  const controlsRef = useRef<any>(null);

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

  return (
    <>
      <CameraController activeSection={activeSection} onReady={() => {}} />
      <OrbitControls 
        ref={controlsRef}
        enableZoom={false} 
        enablePan={false}
        enableRotate={!activeSection}
        rotateSpeed={0.5}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.8}
      />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 3, 5]} intensity={1.5} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#4da6ff" />
      <Stars />
      <Earth 
        isAutoRotating={!activeSection}
        targetRotation={targetRotation}
        onRotationComplete={handleRotationComplete}
      />
    </>
  );
};

const GlobeScene = (props: GlobeSceneProps) => {
  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }}>
        <Suspense fallback={null}>
          <GlobeContent {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default GlobeScene;