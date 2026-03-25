import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import type { Texture, WebGLRenderer } from "three";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { useThree } from "@react-three/fiber";

type ConfigureTexture = (tex: Texture) => void;

// Reuse a single KTX2Loader per WebGLRenderer to avoid:
// - "Multiple active KTX2 loaders" warnings
// - unnecessary worker pools / memory churn
const ktx2LoaderByRenderer = new WeakMap<WebGLRenderer, KTX2Loader>();

const DEBUG = true;
function log(...args: any[]) {
  if (!DEBUG) return;
  // eslint-disable-next-line no-console
  console.log(...args);
}

type UpgradeJob = {
  key: string;
  priority: number;
  highUrl: string;
  flipV?: boolean;
  configure?: ConfigureTexture;
  onReady: (tex: Texture) => void;
};

const upgradeQueue: UpgradeJob[] = [];
const queuedKeys = new Set<string>();
let draining = false;

function enqueueUpgrade(job: UpgradeJob) {
  if (queuedKeys.has(job.key)) return;
  queuedKeys.add(job.key);
  upgradeQueue.push(job);
  upgradeQueue.sort((a, b) => a.priority - b.priority);
}

function drainQueue(loader: KTX2Loader) {
  if (draining) return;
  draining = true;

  const step = () => {
    const job = upgradeQueue.shift();
    if (!job) {
      draining = false;
      return;
    }
    queuedKeys.delete(job.key);

    log("[KTX2 upgrade] dequeue", job.priority, job.highUrl);

    Promise.resolve(loader.init?.())
      .catch(() => {
        log("[KTX2 upgrade] init failed (continuing)", job.highUrl);
      })
      .finally(() => {
        loader.load(
          job.highUrl,
          (hi) => {
            log("[KTX2 upgrade] load success", job.highUrl);
            hi.flipY = false;
            hi.generateMipmaps = false;
            hi.needsUpdate = true;
            if (job.flipV) flipTextureV(hi);
            job.configure?.(hi);
            requestAnimationFrame(() => job.onReady(hi));

            // Start the next download only after this one finished.
            requestIdle(step, 1200);
          },
          undefined,
          (err) => {
            // eslint-disable-next-line no-console
            console.warn("[KTX2 upgrade] failed:", job.highUrl, err);
            log("[KTX2 upgrade] load error", job.highUrl);

            // Continue queue even if this one fails.
            requestIdle(step, 1200);
          }
        );
      });
  };

  requestIdle(step, 500);
}

function shouldAttemptHighRes(): boolean {
  if (typeof navigator === "undefined") return true;
  const c: any = (navigator as any).connection;
  if (!c) return true;
  if (c.saveData) return false;
  const type = String(c.effectiveType || "");
  // Avoid large background downloads on very slow connections.
  if (type === "slow-2g" || type === "2g") return false;
  return true;
}

function requestIdle(cb: () => void, timeout = 1500) {
  if (typeof (window as any).requestIdleCallback === "function") {
    return (window as any).requestIdleCallback(cb, { timeout });
  }
  // iOS Safari: no requestIdleCallback — run soon, but not immediately.
  return window.setTimeout(cb, Math.min(700, timeout));
}

function cancelIdle(handle: any) {
  if (typeof (window as any).cancelIdleCallback === "function") {
    (window as any).cancelIdleCallback(handle);
    return;
  }
  clearTimeout(handle);
}

function createKtx2Loader(gl: WebGLRenderer) {
  const existing = ktx2LoaderByRenderer.get(gl);
  if (existing) return existing;

  // Use a private LoadingManager so Drei's useProgress() isn't affected.
  const manager = new THREE.LoadingManager();
  const loader = new KTX2Loader(manager);
  loader.setTranscoderPath("/basis/");
  loader.detectSupport(gl);
  ktx2LoaderByRenderer.set(gl, loader);
  log("[KTX2 upgrade] loader created for renderer");
  return loader;
}

function flipTextureV(tex: Texture) {
  // KTX2 textures can appear inverted depending on origin metadata / platform.
  // Flip in UV space (repeat/offset) rather than flipY, which is not supported
  // consistently for compressed GPU textures.
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, -1);
  tex.offset.set(0, 1);
}

/**
 * Loads a hi-res .ktx2 texture in the background (worker transcoding) and swaps
 * it in after the initial scene is interactive. Does NOT suspend and does NOT
 * affect Drei's global loading progress overlay.
 */
export function useDeferredKtx2Upgrade(opts: {
  enabled: boolean;
  low: Texture;
  highUrl: string;
  /** Lower = sooner. */
  priority?: number;
  configure?: ConfigureTexture;
  /** If true, vertically flip KTX2 UVs to match JPG orientation. */
  flipV?: boolean;
}): Texture {
  const gl = useThree((s) => s.gl);
  const [tex, setTex] = useState<Texture>(opts.low);

  const loader = useMemo(() => createKtx2Loader(gl), [gl]);

  useEffect(() => {
    setTex(opts.low);
  }, [opts.low]);

  useEffect(() => {
    if (!opts.enabled) return;
    if (!shouldAttemptHighRes()) {
      log("[KTX2 upgrade] skipped due to connection/save-data", opts.highUrl);
      return;
    }

    const key = opts.highUrl;
    const prio = opts.priority ?? 100;
    log("[KTX2 upgrade] enqueue", prio, opts.highUrl);
    enqueueUpgrade({
      key,
      priority: prio,
      highUrl: opts.highUrl,
      flipV: opts.flipV,
      configure: opts.configure,
      onReady: (hi) => {
        log("[KTX2 upgrade] swap -> active", opts.highUrl);
        setTex(hi);
      },
    });
    drainQueue(loader);

    return () => {
      // If the component unmounts before job runs, we just won't swap.
      // (We keep the job in queue to avoid churn; it's harmless.)
    };
  }, [opts.enabled, opts.highUrl, opts.flipV, opts.configure, loader]);

  return tex;
}

