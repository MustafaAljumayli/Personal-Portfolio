import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import type { Texture } from "three";

/**
 * Basic HTMLImageElement-based loading (most compatible on mobile Safari).
 * Use for the *base* mobile textures to avoid ImageBitmap decode failures.
 */
export function useBasicTexture(url: string): Texture {
  return useLoader(TextureLoader, url);
}

