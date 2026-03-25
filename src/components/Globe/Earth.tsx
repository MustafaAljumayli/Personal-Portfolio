import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isMobileDevice } from "@/lib/device";
import { useBitmapTexture } from "@/hooks/useBitmapTexture";
import { useDeferredKtx2Upgrade } from "@/hooks/useDeferredKtx2Upgrade";
import { useKtx2SuspenseTexture } from "@/hooks/useKtx2SuspenseTexture";

interface EarthProps {
  isAutoRotating: boolean;
  targetRotation?: { x: number; y: number } | null;
  onRotationComplete?: () => void;
}

const isMobile = isMobileDevice();
const SEGMENTS = isMobile ? 32 : 64;

const Earth = ({ isAutoRotating, targetRotation, onRotationComplete }: EarthProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);

  // Mobile: render immediately with 2K JPGs, then silently upgrade to 8K KTX2 in idle time.
  // Desktop: always use 8K JPGs (no issues).
  const lowBase = isMobile ? "/mobile/" : "/";

  const earthLow = useBitmapTexture(`${lowBase}8k_earth_daymap.jpg`);
  const nightLow = useBitmapTexture(`${lowBase}8k_earth_nightmap.jpg`);
  const bumpLow = useBitmapTexture(`${lowBase}8081_earthbump10k.jpg`);
  const specLow = useBitmapTexture(`${lowBase}8081_earthspec10k.jpg`);
  const cloudsLow = useBitmapTexture(`${lowBase}8k_earth_clouds.jpg`);

  const earthDesktop = useKtx2SuspenseTexture("/ktx2/desktop8k/8k_earth_daymap.ktx2", { flipV: true });
  const nightDesktop = useKtx2SuspenseTexture("/ktx2/desktop8k/8k_earth_nightmap.ktx2", { flipV: true });
  const bumpDesktop = useKtx2SuspenseTexture("/ktx2/desktop8k/8081_earthbump10k.ktx2", { flipV: true });
  const specDesktop = useKtx2SuspenseTexture("/ktx2/desktop8k/8081_earthspec10k.ktx2", { flipV: true });
  const cloudsDesktop = useKtx2SuspenseTexture("/ktx2/desktop8k/8k_earth_clouds.ktx2", { flipV: true });

  const earthTexture = useDeferredKtx2Upgrade({
    enabled: isMobile,
    low: earthLow,
    highUrl: "/ktx2/mobile4k/earth_day_4k.ktx2",
    flipV: true,
    priority: 0,
  });
  const nightTexture = useDeferredKtx2Upgrade({
    enabled: isMobile,
    low: nightLow,
    highUrl: "/ktx2/mobile4k/earth_night_4k.ktx2",
    flipV: true,
    priority: 1,
  });
  const bumpTexture = useDeferredKtx2Upgrade({
    enabled: isMobile,
    low: bumpLow,
    highUrl: "/ktx2/mobile4k/earth_bump_4k.ktx2",
    flipV: true,
    priority: 20,
  });
  const specTexture = useDeferredKtx2Upgrade({
    enabled: isMobile,
    low: specLow,
    highUrl: "/ktx2/mobile4k/earth_spec_4k.ktx2",
    flipV: true,
    priority: 30,
  });
  const cloudsAlphaTexture = useDeferredKtx2Upgrade({
    enabled: isMobile,
    low: cloudsLow,
    highUrl: "/ktx2/mobile4k/earth_clouds_4k.ktx2",
    flipV: true,
    priority: 10,
  });

  const earthFinal = isMobile ? earthTexture : earthDesktop;
  const nightFinal = isMobile ? nightTexture : nightDesktop;
  const bumpFinal = isMobile ? bumpTexture : bumpDesktop;
  const specFinal = isMobile ? specTexture : specDesktop;
  const cloudsFinal = isMobile ? cloudsAlphaTexture : cloudsDesktop;

  useMemo(() => {
    const aniso = isMobile ? 4 : 16;

    earthFinal.colorSpace = THREE.SRGBColorSpace;
    earthFinal.anisotropy = aniso;
    earthFinal.needsUpdate = true;

    nightFinal.colorSpace = THREE.SRGBColorSpace;
    nightFinal.anisotropy = aniso;
    nightFinal.needsUpdate = true;

    bumpFinal.colorSpace = THREE.NoColorSpace;
    bumpFinal.anisotropy = aniso;
    bumpFinal.wrapS = THREE.ClampToEdgeWrapping;
    bumpFinal.wrapT = THREE.ClampToEdgeWrapping;
    bumpFinal.minFilter = THREE.LinearMipmapLinearFilter;
    bumpFinal.magFilter = THREE.LinearFilter;
    bumpFinal.needsUpdate = true;

    specFinal.colorSpace = THREE.NoColorSpace;
    specFinal.anisotropy = aniso;
    specFinal.wrapS = THREE.ClampToEdgeWrapping;
    specFinal.wrapT = THREE.ClampToEdgeWrapping;
    specFinal.minFilter = THREE.LinearMipmapLinearFilter;
    specFinal.magFilter = THREE.LinearFilter;
    specFinal.needsUpdate = true;

    cloudsFinal.colorSpace = THREE.NoColorSpace;
    cloudsFinal.anisotropy = aniso;
    cloudsFinal.wrapS = THREE.RepeatWrapping;
    cloudsFinal.wrapT = THREE.ClampToEdgeWrapping;
    cloudsFinal.needsUpdate = true;
  }, [earthFinal, nightFinal, bumpFinal, specFinal, cloudsFinal, isMobile]);

  const atmosphereUniforms = useMemo(
    () => ({ glowColor: { value: new THREE.Color(0x4da6ff) } }),
    []
  );

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const clouds = cloudsRef.current;

    if (targetRotation) {
      const lerpSpeed = 2 * delta;
      mesh.rotation.x += (targetRotation.x - mesh.rotation.x) * lerpSpeed;
      mesh.rotation.y += (targetRotation.y - mesh.rotation.y) * lerpSpeed;
      if (clouds) {
        clouds.rotation.x = mesh.rotation.x;
        clouds.rotation.y = mesh.rotation.y + 0.01;
      }

      const distX = Math.abs(targetRotation.x - mesh.rotation.x);
      const distY = Math.abs(targetRotation.y - mesh.rotation.y);
      if (distX < 0.01 && distY < 0.01 && onRotationComplete) {
        onRotationComplete();
      }
    } else if (isAutoRotating) {
      mesh.rotation.y += delta * 0.1;
      if (clouds) {
        clouds.rotation.y += delta * 0.12;
      }
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[2, SEGMENTS, SEGMENTS]} />
        <meshStandardMaterial
          map={earthFinal}
          emissive={new THREE.Color("#ffffff")}
          emissiveMap={nightFinal}
          emissiveIntensity={1.5}
          roughness={1}
          bumpMap={bumpFinal}
          bumpScale={30}
          metalness={0.0}
          onBeforeCompile={(shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              "totalEmissiveRadiance *= emissiveColor.rgb;",
              `totalEmissiveRadiance *= emissiveColor.rgb;
#if NUM_DIR_LIGHTS > 0
  float nightFactor = smoothstep( 0.0, 0.35, -dot( geometry.normal, directionalLights[ 0 ].direction ) );
  totalEmissiveRadiance *= nightFactor;
#endif`
            );
          }}
        />
      </mesh>

      <mesh ref={cloudsRef}>
        <sphereGeometry args={[2.015, SEGMENTS, SEGMENTS]} />
        <meshStandardMaterial
          color="#ffffff"
          alphaMap={cloudsFinal}
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={atmosphereRef} scale={1.08}>
        <sphereGeometry args={[2, SEGMENTS, SEGMENTS]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          uniforms={atmosphereUniforms}
          vertexShader={`
            varying vec3 vNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vNormal;
            uniform vec3 glowColor;
            void main() {
              float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
              gl_FragColor = vec4(glowColor, intensity * 0.5);
            }
          `}
        />
      </mesh>
    </group>
  );
};

export default Earth;
