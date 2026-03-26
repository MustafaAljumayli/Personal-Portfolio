import { useThree } from "@react-three/fiber";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import type { Texture, WebGLRenderer } from "three";
import * as THREE from "three";

const loaderByRenderer = new WeakMap<WebGLRenderer, KTX2Loader>();
type CacheEntry =
  | { status: "pending"; promise: Promise<Texture> }
  | { status: "ready"; texture: Texture }
  | { status: "error"; error: unknown };
const textureCacheByRenderer = new WeakMap<WebGLRenderer, Map<string, CacheEntry>>();

function getLoader(gl: WebGLRenderer) {
  const existing = loaderByRenderer.get(gl);
  if (existing) return existing;
  const loader = new KTX2Loader();
  loader.setTranscoderPath("/basis/");
  loader.detectSupport(gl);
  loaderByRenderer.set(gl, loader);
  return loader;
}

function getCache(gl: WebGLRenderer) {
  const existing = textureCacheByRenderer.get(gl);
  if (existing) return existing;
  const m = new Map<string, CacheEntry>();
  textureCacheByRenderer.set(gl, m);
  return m;
}

function flipTextureV(tex: Texture) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, -1);
  tex.offset.set(0, 1);
}

/**
 * Suspense-based KTX2 load using ONE shared loader per renderer.
 *
 * Why: using `useLoader(KTX2Loader, ...)` across multiple textures creates multiple KTX2Loader
 * instances that all call `init()` concurrently, triggering:
 * `THREE.KTX2Loader: Multiple active KTX2 loaders may cause performance issues`
 * and can cause Chrome jank while it spins up workers / decodes in parallel.
 */
export function useKtx2SuspenseTexture(url: string, opts?: { flipV?: boolean }): Texture {
  const gl = useThree((s) => s.gl);
  const loader = getLoader(gl);
  const cache = getCache(gl);
  const key = `${url}|flipV:${opts?.flipV ? 1 : 0}`;

  const cached = cache.get(key);
  if (cached) {
    if (cached.status === "ready") return cached.texture;
    if (cached.status === "error") throw cached.error;
    throw cached.promise;
  }

  const promise = Promise.resolve(loader.init?.())
    .catch(() => {
      // init() is best-effort; loadAsync will still try.
    })
    .then(() => loader.loadAsync(url))
    .then((tex) => {
      tex.flipY = false;
      tex.generateMipmaps = false;
      if (opts?.flipV) flipTextureV(tex);
      tex.needsUpdate = true;
      cache.set(key, { status: "ready", texture: tex });
      return tex;
    })
    .catch((err) => {
      cache.set(key, { status: "error", error: err });
      throw err;
    });

  cache.set(key, { status: "pending", promise });
  throw promise;
}

