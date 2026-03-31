import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { isMobileDevice } from "@/lib/device";
import { useDeferredKtx2Upgrade } from "@/hooks/useDeferredKtx2Upgrade";
import { useKtx2SuspenseTexture } from "@/hooks/useKtx2SuspenseTexture";
import { useBitmapTexture } from "@/hooks/useBitmapTexture";
import { useBasicTexture } from "@/hooks/useBasicTexture";

interface EarthProps {
  isAutoRotating: boolean;
  targetRotation?: { x: number; y: number } | null;
  onRotationComplete?: () => void;
}

const EarthShared = ({
  isAutoRotating,
  targetRotation,
  onRotationComplete,
  isMobile,
  earthFinal,
  nightFinal,
  bumpFinal,
  specFinal,
  cloudsFinal,
}: EarthProps & {
  isMobile: boolean;
  earthFinal: THREE.Texture;
  nightFinal: THREE.Texture;
  bumpFinal: THREE.Texture;
  specFinal: THREE.Texture;
  cloudsFinal: THREE.Texture;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const rotationSettledRef = useRef(false);
  const { gl } = useThree();

  // Earth: primary detail. Clouds/atmosphere: lower poly — fewer fragments on transparent layers.
  const EARTH_R = 2;
  /** Slightly above the globe to reduce z-fighting and read as a thin shell. */
  const CLOUD_R = EARTH_R + 0.04;
  const SEGMENTS = isMobile ? 28 : 32;
  const CLOUD_SEG = isMobile ? 20 : 22;
  const ATM_SEG = 16;

  useMemo(() => {
    const aniso = isMobile ? 4 : Math.min(8, gl.capabilities.getMaxAnisotropy());

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
  }, [earthFinal, nightFinal, bumpFinal, specFinal, cloudsFinal, isMobile, gl]);

  useEffect(() => {
    rotationSettledRef.current = false;
  }, [targetRotation]);

  const atmosphereUniforms = useMemo(
    () => ({ glowColor: { value: new THREE.Color(0x4da6ff) } }),
    []
  );

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const clouds = cloudsRef.current;

    if (targetRotation) {
      const t = 1 - Math.exp(-delta * 1.85);
      mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, targetRotation.x, t);
      mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, targetRotation.y, t);
      if (clouds) {
        clouds.rotation.x = mesh.rotation.x;
        clouds.rotation.y = mesh.rotation.y + 0.01;
      }

      const distX = Math.abs(targetRotation.x - mesh.rotation.x);
      const distY = Math.abs(targetRotation.y - mesh.rotation.y);
      if (distX < 0.01 && distY < 0.01) {
        if (!rotationSettledRef.current) {
          rotationSettledRef.current = true;
          onRotationComplete?.();
        }
      } else {
        rotationSettledRef.current = false;
      }

    } else if (isAutoRotating) {
      rotationSettledRef.current = false;
      const nextEarthY = mesh.rotation.y + delta * 0.1;
      mesh.rotation.y = THREE.MathUtils.euclideanModulo(nextEarthY + Math.PI, Math.PI * 2) - Math.PI;
      if (clouds) {
        const nextCloudY = clouds.rotation.y + delta * 0.12;
        clouds.rotation.y = THREE.MathUtils.euclideanModulo(nextCloudY + Math.PI, Math.PI * 2) - Math.PI;
      }
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[EARTH_R, SEGMENTS, SEGMENTS]} />
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
        <sphereGeometry args={[CLOUD_R, CLOUD_SEG, CLOUD_SEG]} />
        {/* BasicMaterial: no lighting evaluation — much cheaper than Standard for a thin shell */}
        <meshBasicMaterial
          color="#ffffff"
          alphaMap={cloudsFinal}
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={atmosphereRef} scale={1.08}>
        <sphereGeometry args={[EARTH_R + 0.005, ATM_SEG, ATM_SEG]} />
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

const MobileEarth = (props: EarthProps) => {
  const isMobile = true;
  const lowBase = "/mobile/";

  // Base mobile textures must be максимально compatible (iOS Safari).
  // Use TextureLoader for low-res JPGs; KTX2 upgrade happens later.
  const earthLow = useBasicTexture(`${lowBase}8k_earth_daymap.jpg`);
  const nightLow = useBasicTexture(`${lowBase}8k_earth_nightmap.jpg`);
  const bumpLow = useBasicTexture(`${lowBase}8081_earthbump10k.jpg`);
  const specLow = useBasicTexture(`${lowBase}8081_earthspec10k.jpg`);
  const cloudsLow = useBasicTexture(`${lowBase}8k_earth_clouds.jpg`);

  // Same 8K KTX2 set as desktop; low-res JPG still shows first, then upgrades when ready.
  const earthFinal = useDeferredKtx2Upgrade({
    enabled: true,
    low: earthLow,
    highUrl: "/ktx2/desktop8k/8k_earth_daymap.ktx2",
    flipV: true,
    priority: 0,
  });
  const nightFinal = useDeferredKtx2Upgrade({
    enabled: true,
    low: nightLow,
    highUrl: "/ktx2/desktop8k/8k_earth_nightmap.ktx2",
    flipV: true,
    priority: 1,
  });
  const cloudsFinal = useDeferredKtx2Upgrade({
    enabled: true,
    low: cloudsLow,
    highUrl: "/ktx2/desktop8k/8k_earth_clouds.ktx2",
    flipV: true,
    priority: 10,
  });
  const bumpFinal = useDeferredKtx2Upgrade({
    enabled: true,
    low: bumpLow,
    highUrl: "/ktx2/desktop8k/8081_earthbump10k.ktx2",
    flipV: true,
    priority: 20,
  });
  const specFinal = useDeferredKtx2Upgrade({
    enabled: true,
    low: specLow,
    highUrl: "/ktx2/desktop8k/8081_earthspec10k.ktx2",
    flipV: true,
    priority: 30,
  });

  return (
    <EarthShared
      {...props}
      isMobile={isMobile}
      earthFinal={earthFinal}
      nightFinal={nightFinal}
      bumpFinal={bumpFinal}
      specFinal={specFinal}
      cloudsFinal={cloudsFinal}
    />
  );
};

const DesktopEarth = (props: EarthProps) => {
  const isMobile = false;
  // Desktop: full 8K KTX2 set. Performance comes from on-demand rendering + idle, not from downgrading art.
  const earthFinal = useKtx2SuspenseTexture("/ktx2/desktop8k/8k_earth_daymap.ktx2", { flipV: true });
  const nightFinal = useKtx2SuspenseTexture("/ktx2/desktop8k/8k_earth_nightmap.ktx2", { flipV: true });
  const bumpFinal = useKtx2SuspenseTexture("/ktx2/desktop8k/8081_earthbump10k.ktx2", { flipV: true });
  const specFinal = useKtx2SuspenseTexture("/ktx2/desktop8k/8081_earthspec10k.ktx2", { flipV: true });
  const cloudsFinal = useKtx2SuspenseTexture("/ktx2/desktop8k/8k_earth_clouds.ktx2", { flipV: true });

  return (
    <EarthShared
      {...props}
      isMobile={isMobile}
      earthFinal={earthFinal}
      nightFinal={nightFinal}
      bumpFinal={bumpFinal}
      specFinal={specFinal}
      cloudsFinal={cloudsFinal}
    />
  );
};

const Earth = (props: EarthProps) => {
  // Stabilize the decision once at mount time to avoid briefly mounting both mobile/desktop
  // texture paths (which can overlap KTX2Loader.init() across loaders).
  const mobile = useMemo(() => isMobileDevice(), []);
  return mobile ? <MobileEarth {...props} /> : <DesktopEarth {...props} />;
};

export default Earth;