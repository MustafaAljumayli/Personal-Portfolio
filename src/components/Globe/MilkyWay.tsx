import { useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import * as THREE from "three";

const MilkyWay = () => {
    const meshRef = useRef<THREE.Mesh>(null);

    const texture = useLoader(TextureLoader, "/8k_stars_milky_way.jpg");
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    // Flip horizontally so the inside of the sphere feels correct.
    texture.repeat.set(-1, 1);

    useFrame((state) => {
        if (!meshRef.current) return;
        // Subtle drift so it feels alive; tied to scene time (and thus to the globe).
        meshRef.current.rotation.y = state.clock.elapsedTime * 0.01;
    });

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[140, 64, 64]} />
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


