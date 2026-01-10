import { useRef, useMemo } from "react";
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

  // Create procedural Earth texture
  const earthTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    // Ocean base
    const oceanGradient = ctx.createLinearGradient(0, 0, 0, 512);
    oceanGradient.addColorStop(0, "#1a4a6e");
    oceanGradient.addColorStop(0.5, "#0f3d5c");
    oceanGradient.addColorStop(1, "#1a4a6e");
    ctx.fillStyle = oceanGradient;
    ctx.fillRect(0, 0, 1024, 512);

    // Add continents (simplified shapes)
    ctx.fillStyle = "#2d5a3d";
    
    // North America
    ctx.beginPath();
    ctx.ellipse(200, 150, 80, 60, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // South America
    ctx.beginPath();
    ctx.ellipse(280, 320, 40, 80, 0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Europe/Africa
    ctx.beginPath();
    ctx.ellipse(520, 180, 50, 40, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(530, 300, 45, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Asia
    ctx.beginPath();
    ctx.ellipse(700, 150, 100, 60, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Australia
    ctx.beginPath();
    ctx.ellipse(820, 340, 40, 30, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Add some variation
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(${30 + Math.random() * 20}, ${80 + Math.random() * 30}, ${50 + Math.random() * 20}, 0.5)`;
      ctx.beginPath();
      ctx.arc(Math.random() * 1024, Math.random() * 512, Math.random() * 20 + 5, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  // Create cloud texture
  const cloudTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "transparent";
    ctx.fillRect(0, 0, 1024, 512);

    for (let i = 0; i < 200; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 512;
      const radius = Math.random() * 30 + 10;
      const opacity = Math.random() * 0.3 + 0.1;

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current || !cloudsRef.current) return;

    if (targetRotation) {
      // Smooth interpolation to target
      const lerpSpeed = 2 * delta;
      meshRef.current.rotation.x += (targetRotation.x - meshRef.current.rotation.x) * lerpSpeed;
      meshRef.current.rotation.y += (targetRotation.y - meshRef.current.rotation.y) * lerpSpeed;
      cloudsRef.current.rotation.x = meshRef.current.rotation.x;
      cloudsRef.current.rotation.y = meshRef.current.rotation.y + 0.01;

      // Check if close enough
      const distX = Math.abs(targetRotation.x - meshRef.current.rotation.x);
      const distY = Math.abs(targetRotation.y - meshRef.current.rotation.y);
      if (distX < 0.01 && distY < 0.01 && onRotationComplete) {
        onRotationComplete();
      }
    } else if (isAutoRotating) {
      meshRef.current.rotation.y += delta * 0.1;
      cloudsRef.current.rotation.y += delta * 0.12;
    }
  });

  return (
    <group>
      {/* Earth */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial
          map={earthTexture}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* Clouds */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[2.02, 64, 64]} />
        <meshStandardMaterial
          map={cloudTexture}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>

      {/* Atmosphere glow */}
      <mesh ref={atmosphereRef} scale={1.15}>
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