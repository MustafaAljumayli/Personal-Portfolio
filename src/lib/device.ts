export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  // IMPORTANT: do not treat narrow desktop windows as "mobile".
  // Chrome DevTools device emulation and some trackpads can expose touch points,
  // which previously flipped desktop into the mobile texture path and triggered
  // deferred KTX2 upgrades + extra loader init warnings.
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

