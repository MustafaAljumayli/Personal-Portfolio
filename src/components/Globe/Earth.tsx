import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isMobileDevice } from "@/lib/device";
import { useBitmapTexture } from "@/hooks/useBitmapTexture";

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

  const basePath = isMobile ? "/mobile/" : "/";
  const earthTexture = useBitmapTexture(`${basePath}8k_earth_daymap.jpg`);
  const nightTexture = useBitmapTexture(`${basePath}8k_earth_nightmap.jpg`);
  const bumpTexture = useBitmapTexture(`${basePath}8081_earthbump10k.jpg`);
  const specTexture = useBitmapTexture(`${basePath}8081_earthspec10k.jpg`);
  const cloudsAlphaTexture = useBitmapTexture(`${basePath}8k_earth_clouds.jpg`);

  useMemo(() => {
    const aniso = isMobile ? 4 : 16;

    earthTexture.colorSpace = THREE.SRGBColorSpace;
    earthTexture.anisotropy = aniso;
    earthTexture.needsUpdate = true;

    nightTexture.colorSpace = THREE.SRGBColorSpace;
    nightTexture.anisotropy = aniso;
    nightTexture.needsUpdate = true;

    bumpTexture.colorSpace = THREE.NoColorSpace;
    bumpTexture.anisotropy = aniso;
    bumpTexture.wrapS = THREE.ClampToEdgeWrapping;
    bumpTexture.wrapT = THREE.ClampToEdgeWrapping;
    bumpTexture.minFilter = THREE.LinearMipmapLinearFilter;
    bumpTexture.magFilter = THREE.LinearFilter;
    bumpTexture.needsUpdate = true;

    specTexture.colorSpace = THREE.NoColorSpace;
    specTexture.anisotropy = aniso;
    specTexture.wrapS = THREE.ClampToEdgeWrapping;
    specTexture.wrapT = THREE.ClampToEdgeWrapping;
    specTexture.minFilter = THREE.LinearMipmapLinearFilter;
    specTexture.magFilter = THREE.LinearFilter;
    specTexture.needsUpdate = true;

    cloudsAlphaTexture.colorSpace = THREE.NoColorSpace;
    cloudsAlphaTexture.anisotropy = aniso;
    cloudsAlphaTexture.wrapS = THREE.RepeatWrapping;
    cloudsAlphaTexture.wrapT = THREE.ClampToEdgeWrapping;
    cloudsAlphaTexture.needsUpdate = true;
  }, [earthTexture, nightTexture, bumpTexture, specTexture, cloudsAlphaTexture]);

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
          map={earthTexture}
          emissive={new THREE.Color("#ffffff")}
          emissiveMap={nightTexture}
          emissiveIntensity={1.5}
          roughness={1}
          bumpMap={bumpTexture}
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
          alphaMap={cloudsAlphaTexture}
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
