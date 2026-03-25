import { useLoader, useThree } from "@react-three/fiber";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import type { Texture, WebGLRenderer } from "three";
import * as THREE from "three";

const loaderByRenderer = new WeakMap<WebGLRenderer, KTX2Loader>();

function getLoader(gl: WebGLRenderer) {
  const existing = loaderByRenderer.get(gl);
  if (existing) return existing;
  const loader = new KTX2Loader();
  loader.setTranscoderPath("/basis/");
  loader.detectSupport(gl);
  loaderByRenderer.set(gl, loader);
  return loader;
}

function flipTextureV(tex: Texture) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, -1);
  tex.offset.set(0, 1);
}

/**
 * Suspense-based KTX2 load (participates in Drei/useProgress).
 * Use for desktop where waiting up front is acceptable.
 */
export function useKtx2SuspenseTexture(url: string, opts?: { flipV?: boolean }): Texture {
  const gl = useThree((s) => s.gl);

  const tex = useLoader(
    KTX2Loader,
    url,
    (loader) => {
      const shared = getLoader(gl);
      // copy config onto the instance drei passes us
      (loader as KTX2Loader).setTranscoderPath((shared as any).transcoderPath || "/basis/");
      (loader as KTX2Loader).detectSupport(gl);
    }
  );

  tex.flipY = false;
  tex.generateMipmaps = false;
  if (opts?.flipV) flipTextureV(tex);
  tex.needsUpdate = true;
  return tex;
}

