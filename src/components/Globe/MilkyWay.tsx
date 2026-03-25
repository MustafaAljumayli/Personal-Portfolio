import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isMobileDevice } from "@/lib/device";
import { useBitmapTexture } from "@/hooks/useBitmapTexture";
import { useDeferredKtx2Upgrade } from "@/hooks/useDeferredKtx2Upgrade";
import { useKtx2SuspenseTexture } from "@/hooks/useKtx2SuspenseTexture";

const MilkyWay = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  const isMobile = isMobileDevice();
  const low = useBitmapTexture(isMobile ? "/mobile/8k_stars_milky_way.jpg" : "/8k_stars_milky_way.jpg");
  const mobileTexture = useDeferredKtx2Upgrade({
    enabled: isMobile,
    low,
    highUrl: "/ktx2/mobile4k/stars_4k.ktx2",
    flipV: true,
    priority: 40,
  });
  const desktopTexture = useKtx2SuspenseTexture("/ktx2/desktop8k/8k_stars_milky_way.ktx2", { flipV: true });
  const texture = isMobile ? mobileTexture : desktopTexture;

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = isMobile ? 2 : 8;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(-1, 1);
  }, [texture]);

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y = state.clock.elapsedTime * 0.01;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[140, isMobile ? 24 : 64, isMobile ? 24 : 64]} />
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

export default MilkyWay;
