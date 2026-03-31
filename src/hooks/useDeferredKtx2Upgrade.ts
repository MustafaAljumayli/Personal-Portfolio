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

const DEBUG = import.meta.env.DEV;
function log(...args: unknown[]) {
  if (!DEBUG) return;
  console.log(...args);
}

/** Idle spacing so Basis transcoding + GPU uploads don’t stack (desktop felt janky when tight). */
const MS_BEFORE_FIRST_DEFERRED_JOB = 750;
const MS_BETWEEN_DEFERRED_JOBS = 2200;
const KTX2_LOAD_TIMEOUT_MS = 60_000;

type UpgradeJob = {
  key: string;
  priority: number;
  highUrl: string;
  flipV?: boolean;
  configure?: ConfigureTexture;
  onReady: (tex: Texture) => void;
  /** Skip swap if base level exceeds this (mobile GPUs are often 4096). */
  maxTextureSize: number;
};

function textureBaseDimensions(tex: Texture): { w: number; h: number } | null {
  const img = tex.image as
    | { width?: number; height?: number; mipmaps?: { width: number; height: number }[] }
    | undefined;
  if (!img) return null;
  if (typeof img.width === "number" && typeof img.height === "number") {
    return { w: img.width, h: img.height };
  }
  const m0 = img.mipmaps?.[0];
  if (m0 && typeof m0.width === "number" && typeof m0.height === "number") {
    return { w: m0.width, h: m0.height };
  }
  return null;
}

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
        let settled = false;
        const finishOnce = () => {
          if (settled) return false;
          settled = true;
          return true;
        };
        const timeoutHandle = window.setTimeout(() => {
          if (!finishOnce()) return;
          log("[KTX2 upgrade] timeout, keeping current resolution", job.highUrl);
          // Continue queue even if this one timed out.
          requestIdle(step, MS_BETWEEN_DEFERRED_JOBS);
        }, KTX2_LOAD_TIMEOUT_MS);

        loader.load(
          job.highUrl,
          (hi) => {
            if (!finishOnce()) {
              // Ignore late completion after timeout and avoid leaking GPU memory.
              hi.dispose();
              return;
            }
            clearTimeout(timeoutHandle);
            log("[KTX2 upgrade] load success", job.highUrl);
            const dim = textureBaseDimensions(hi);
            const limit = job.maxTextureSize;
            if (dim && (dim.w > limit || dim.h > limit)) {
              log(
                "[KTX2 upgrade] skip swap (exceeds maxTextureSize)",
                job.highUrl,
                dim.w,
                dim.h,
                limit
              );
              hi.dispose();
              requestIdle(step, MS_BETWEEN_DEFERRED_JOBS);
              return;
            }
            hi.flipY = false;
            hi.generateMipmaps = false;
            hi.needsUpdate = true;
            if (job.flipV) flipTextureV(hi);
            job.configure?.(hi);
            requestAnimationFrame(() => job.onReady(hi));

            // Start the next download only after this one finished.
            requestIdle(step, MS_BETWEEN_DEFERRED_JOBS);
          },
          undefined,
          (err) => {
            if (!finishOnce()) return;
            clearTimeout(timeoutHandle);
            if (DEBUG) {
              console.warn("[KTX2 upgrade] failed:", job.highUrl, err);
            }
            log("[KTX2 upgrade] load error", job.highUrl);

            // Continue queue even if this one fails.
            requestIdle(step, MS_BETWEEN_DEFERRED_JOBS);
          }
        );
      });
  };

  requestIdle(step, MS_BEFORE_FIRST_DEFERRED_JOB);
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

/**
 * Fetch Basis JS + WASM as soon as WebGL exists (same loader instance as deferred upgrades).
 * Avoids `<link rel="preload">` “unused” warnings while keeping the transcoder hot before idle-queue work.
 */
export function warmKtx2TranscoderForRenderer(gl: WebGLRenderer): void {
  if (!shouldAttemptHighRes()) return;
  const loader = createKtx2Loader(gl);
  void Promise.resolve(loader.init?.()).catch(() => {
    log("[KTX2] transcoder warm init failed");
  });
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
      maxTextureSize: gl.capabilities.maxTextureSize,
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

