export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  // IMPORTANT: do not treat narrow desktop windows as "mobile".
  // Chrome DevTools device emulation and some trackpads can expose touch points,
  // which previously flipped desktop into the mobile texture path and triggered
  // deferred KTX2 upgrades + extra loader init warnings.
  // Include constrained cast-style clients (e.g., Nest Hub / CrKey) so they
  // do not take desktop texture paths.
  return /Android|iPhone|iPad|iPod|CrKey|Fuchsia/i.test(navigator.userAgent);
}

export function isChromiumBasedBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  const isChromiumToken = /Chrome|CriOS|Edg|OPR|Brave/i.test(ua);
  const isFirefox = /Firefox|FxiOS/i.test(ua);
  const isSafariOnly = /Safari/i.test(ua) && !/Chrome|CriOS|Edg|OPR|Brave/i.test(ua);
  return isChromiumToken && !isFirefox && !isSafariOnly;
}

export function isMobileChromiumBrowser(): boolean {
  return isMobileDevice() && isChromiumBasedBrowser();
}

export function isAndroidDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export function shouldAvoidKtx2OnMobile(): boolean {
  if (typeof window === "undefined") return false;
  if (!isMobileDevice()) return false;

  const ua = navigator.userAgent;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const isNestLikeClient = /CrKey|Nest\s?Hub|Fuchsia/i.test(ua);
  const deviceMemory = nav.deviceMemory;
  const lowMemory = typeof deviceMemory === "number" && deviceMemory > 0 && deviceMemory <= 2;
  const cores = navigator.hardwareConcurrency;
  const lowCpu = typeof cores === "number" && cores > 0 && cores <= 4;

  // Conservative fallback for constrained mobile environments where KTX2
  // cold-load stability can be inconsistent.
  return isNestLikeClient || (isAndroidDevice() && (lowMemory || lowCpu));
}

