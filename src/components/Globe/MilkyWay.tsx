import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isMobileDevice } from "@/lib/device";
import { useKtx2SuspenseTexture } from "@/hooks/useKtx2SuspenseTexture";
import { useBasicTexture } from "@/hooks/useBasicTexture";

const MilkyWayShared = ({ isMobile, texture }: { isMobile: boolean; texture: THREE.Texture }) => {
  const skySeg = isMobile ? 16 : 20;
  const meshRef = useRef<THREE.Mesh>(null);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = isMobile ? 2 : 4;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(-1, 1);
    texture.offset.set(0, 0);
    texture.needsUpdate = true;
  }, [texture, isMobile]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.rotation.y = state.clock.elapsedTime * 0.01;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[140, skySeg, skySeg]} />
      <meshBasicMaterial
        map={texture}
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
        // Mobile: opaque sky avoids compressed/alpha quirks; KTX2 swap was turning the scene black.
        opacity={isMobile ? 1 : 0.9}
        transparent={!isMobile}
      />
    </mesh>
  );
};

const MobileMilkyWay = () => {
  const isMobile = true;
  // JPG only: deferred KTX2 swap reliably produced a black sky on mobile (GPU/driver + BasicMaterial).
  const texture = useBasicTexture("/mobile/8k_stars_milky_way.jpg");
  return <MilkyWayShared isMobile={isMobile} texture={texture} />;
};

const DesktopMilkyWay = () => {
  const isMobile = false;
  const texture = useKtx2SuspenseTexture("/ktx2/desktop8k/8k_stars_milky_way.ktx2", { flipV: true });
  return <MilkyWayShared isMobile={isMobile} texture={texture} />;
};

const MilkyWay = () => {
  const mobile = isMobileDevice();
  return mobile ? <MobileMilkyWay /> : <DesktopMilkyWay />;
};

export default MilkyWay;
