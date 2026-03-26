import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isMobileDevice } from "@/lib/device";
import { useDeferredKtx2Upgrade } from "@/hooks/useDeferredKtx2Upgrade";
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
        opacity={0.9}
        transparent
      />
    </mesh>
  );
};

const MobileMilkyWay = () => {
  const isMobile = true;
  const low = useBasicTexture("/mobile/8k_stars_milky_way.jpg");
  // Desktop 8K KTX2 often exceeds mobile maxTextureSize (4096) → invalid upload / black sky.
  const texture = useDeferredKtx2Upgrade({
    enabled: true,
    low,
    highUrl: "/ktx2/mobile4k/stars_4k.ktx2",
    flipV: true,
    priority: 40,
  });
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
