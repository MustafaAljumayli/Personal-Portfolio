import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isMobileDevice } from "@/lib/device";
import { useBitmapTexture } from "@/hooks/useBitmapTexture";

const MilkyWay = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  const isMobile = isMobileDevice();
  const url = isMobile ? "/mobile/8k_stars_milky_way.jpg" : "/8k_stars_milky_way.jpg";
  const texture = useBitmapTexture(url);

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
