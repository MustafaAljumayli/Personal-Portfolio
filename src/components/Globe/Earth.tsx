import { useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import * as THREE from "three";

interface EarthProps {
  isAutoRotating: boolean;
  targetRotation?: { x: number; y: number } | null;
  onRotationComplete?: () => void;
}

const Earth = ({ isAutoRotating, targetRotation, onRotationComplete }: EarthProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);

  // Base color map (day)
  const earthTexture = useLoader(TextureLoader, "/8k_earth_daymap.jpg");
  earthTexture.colorSpace = THREE.SRGBColorSpace;
  earthTexture.anisotropy = 16;

  // City lights (from /public/8k_earth_nightmap.jpg)
  const nightTexture = useLoader(TextureLoader, "/8k_earth_nightmap.jpg");
  nightTexture.colorSpace = THREE.SRGBColorSpace;
  nightTexture.anisotropy = 16;

  // Bump/height map (controls terrain relief)
  const bumpTexture = useLoader(TextureLoader, "/8081_earthbump10k.jpg");
  bumpTexture.colorSpace = THREE.NoColorSpace;
  bumpTexture.anisotropy = 16;
  bumpTexture.wrapS = THREE.ClampToEdgeWrapping;
  bumpTexture.wrapT = THREE.ClampToEdgeWrapping;
  bumpTexture.minFilter = THREE.LinearMipmapLinearFilter;
  bumpTexture.magFilter = THREE.LinearFilter;

  // Specularity map (controls ocean/land shine). We'll use it as an inverted roughness map.
  const specTexture = useLoader(TextureLoader, "/8081_earthspec10k.jpg");
  specTexture.colorSpace = THREE.NoColorSpace;
  specTexture.anisotropy = 16;
  specTexture.wrapS = THREE.ClampToEdgeWrapping;
  specTexture.wrapT = THREE.ClampToEdgeWrapping;
  specTexture.minFilter = THREE.LinearMipmapLinearFilter;
  specTexture.magFilter = THREE.LinearFilter;

  // High-res cloud mask (from /public/8k_earth_clouds.jpg)
  // This is a grayscale image, so we use it as an alphaMap to avoid a black "clouds background".
  const cloudsAlphaTexture = useLoader(TextureLoader, "/8k_earth_clouds.jpg");
  cloudsAlphaTexture.colorSpace = THREE.NoColorSpace;
  cloudsAlphaTexture.anisotropy = 20;
  cloudsAlphaTexture.wrapS = THREE.RepeatWrapping;
  cloudsAlphaTexture.wrapT = THREE.ClampToEdgeWrapping;

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const clouds = cloudsRef.current;

    if (targetRotation) {
      // Smooth interpolation to target
      const lerpSpeed = 2 * delta;
      meshRef.current.rotation.x += (targetRotation.x - meshRef.current.rotation.x) * lerpSpeed;
      meshRef.current.rotation.y += (targetRotation.y - meshRef.current.rotation.y) * lerpSpeed;
      if (clouds) {
        clouds.rotation.x = meshRef.current.rotation.x;
        clouds.rotation.y = meshRef.current.rotation.y + 0.01;
      }

      // Check if close enough
      const distX = Math.abs(targetRotation.x - meshRef.current.rotation.x);
      const distY = Math.abs(targetRotation.y - meshRef.current.rotation.y);
      if (distX < 0.01 && distY < 0.01 && onRotationComplete) {
        onRotationComplete();
      }
    } else if (isAutoRotating) {
      meshRef.current.rotation.y += delta * 0.1;
      if (clouds) {
        clouds.rotation.y += delta * 0.12;
      }
    }
  });

  return (
    <group>
      {/* Earth */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial
          map={earthTexture}
          emissive={new THREE.Color("#ffffff")}
          emissiveMap={nightTexture}
          emissiveIntensity={3.0}
          roughness={20}
          roughnessMap={specTexture}
          bumpMap={bumpTexture}
          bumpScale={50}
          metalness={0.0}
          onBeforeCompile={(shader) => {
            // Invert roughness sampling so "specular" (bright oceans) become low-roughness/smoother.
            shader.fragmentShader = shader.fragmentShader.replace(
              "roughnessFactor *= texelRoughness.g;",
              `
              float rTex = ( 1.0 - texelRoughness.g );
              // soften contrast to hide map artifacts, and reduce influence so it feels natural
              rTex = smoothstep( 0.15, 0.85, rTex );
              roughnessFactor *= mix( 1.0, rTex, 0.35 );
              `
            );

            // Show city lights predominantly on the night side (relative to the main directional light).
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

      {/* Clouds */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[2.02, 64, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          alphaMap={cloudsAlphaTexture}
          transparent
          opacity={1.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Atmosphere glow */}
      <mesh ref={atmosphereRef} scale={1.13}>
        <sphereGeometry args={[2, 64, 64]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          side={THREE.BackSide}
          uniforms={{
            glowColor: { value: new THREE.Color(0x4da6ff) },
          }}
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