import { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { ImageBitmapLoader, Texture } from "three";

/**
 * Loads images via ImageBitmap (often decoded off-main-thread),
 * then wraps the bitmap in a Three.js Texture.
 */
export function useBitmapTexture(url: string): Texture {
  const bitmap = useLoader(ImageBitmapLoader, url, (loader) => {
    // Ensure consistent orientation across browsers/devices (esp. mobile Safari).
    loader.setOptions({ imageOrientation: "flipY" });
  });

  const texture = useMemo(() => {
    const t = new Texture(bitmap as unknown as ImageBitmap);
    // With ImageBitmap sources, Three recommends disabling flipY on the texture
    // and flipping during bitmap creation (imageOrientation: 'flipY').
    t.flipY = false;
    t.needsUpdate = true;
    return t;
  }, [bitmap]);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  return texture;
}

