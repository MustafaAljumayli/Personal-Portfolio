import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { blogInnerVariants, blogShellVariants } from "@/lib/uiMotion";

interface PerformanceInstructionsOverlayProps {
  isVisible: boolean;
}

type BrowserKey = "brave" | "chrome" | "edge" | "opera" | "safari" | "firefox" | "unknown";
type MobileOsKey = "android" | "ios" | "other-mobile" | "none";

type BrowserGuide = {
  label: string;
  settingsPath?: string;
  steps: ReactNode[];
  note?: string;
};

type MobileGuide = {
  label: string;
  steps: ReactNode[];
};

const BROWSER_GUIDES: Record<BrowserKey, BrowserGuide> = {
  brave: {
    label: "Brave",
    settingsPath: "brave://settings/system",
    steps: [
      <>
        Open Brave settings by pasting the link into your browser address bar in a{" "}
        <strong className="text-foreground">new tab</strong> and pressing Enter.
      </>,
      "Scroll down to the 'Power' section.",
      "Turn off Energy Saver.",
    ],
  },
  chrome: {
    label: "Chrome",
    settingsPath: "chrome://settings/performance",
    steps: [
      <>
      Open Chrome settings by pasting the link into your browser address bar in a{" "}
      <strong className="text-foreground">new tab</strong> and pressing Enter.
      </>,
      "Scroll down to the 'Power' section.",
      "Turn off Energy Saver.",
    ],
  },
  edge: {
    label: "Edge",
    settingsPath: "edge://settings/system/managePerformance",
    steps: [
      <>
      Open Edge settings by pasting the link into your browser address bar in a{" "}
      <strong className="text-foreground">new tab</strong> and pressing Enter.
      </>,
      "Scroll down to the 'Power' section.",
      "Turn off 'Enable Energy Saver' or set it to 'Balanced'.",
    ],
  },
  opera: {
    label: "Opera",
    settingsPath: "opera://settings/features",
    steps: [
      <>
      Open Opera settings by pasting the link into your browser address bar in a{" "}
      <strong className="text-foreground">new tab</strong> and pressing Enter.
      </>,
      "Scroll down to the 'Battery saver' section.",
      "Turn off 'Enable Battery Saver' or save battery automatically at 20% settings.",
    ],
  },
  safari: {
    label: "Safari",
    steps: [
      "macOS: System Settings > Battery > Low Power Mode, set to Never (or disable while plugged in).",
      "Keep your device charging when possible during 3D-heavy browsing.",
      "Close other GPU-heavy tabs/apps when viewing WebGL scenes.",
    ],
    note: "Safari does not expose the same Energy Saver toggle path as Chromium browsers.",
  },
  firefox: {
    label: "Firefox",
    settingsPath: "about:preferences#general",
    steps: [
      <>
        Open Firefox settings by pasting the link into your browser address bar in a{" "}
        <strong className="text-foreground">new tab</strong> and pressing Enter.
      </>,
      "In Performance, uncheck 'Use recommended performance settings'.",
      "Enable 'Use hardware acceleration when available'.",
      "If your device is unplugged or low on battery, disable OS battery saver mode.",
    ],
  },
  unknown: {
    label: "Unknown browser",
    steps: [
      "Search browser settings for Energy Saver, Efficiency Mode, or Battery Saver and turn it off.",
      "Keep hardware acceleration enabled in browser settings.",
      "If battery is near 20% or device is unplugged, plug in to avoid automatic power-saving throttling.",
      "On mobile browsers, check OS battery/power settings since browser-level energy toggles may not exist.",
      "Close extra tabs and restart the browser after changing settings.",
    ],
  },
};

const MOBILE_GUIDES: Record<Exclude<MobileOsKey, "none">, MobileGuide> = {
  android: {
    label: "Android",
    steps: [
      "Open Android Settings > Battery and turn Battery Saver off.",
      "If available, disable Adaptive Battery / app background restrictions for smoother sustained GPU performance.",
      "Set display refresh rate to High/Smooth (90Hz/120Hz) if your device supports it.",
      "Close extra browser tabs and restart the browser after changing battery/display settings.",
    ],
  },
  ios: {
    label: "iOS",
    steps: [
      "Open Settings > Battery and turn Low Power Mode off.",
      "Keep your phone charging when possible during heavy 3D rendering.",
      "Close extra browser tabs and restart the browser after changing battery settings.",
    ],
  },
  "other-mobile": {
    label: "Mobile device",
    steps: [
      "Turn off device battery saver / low power mode.",
      "If available, set refresh rate to High/Smooth mode.",
      "Close extra browser tabs and restart the browser after changing settings.",
    ],
  },
};

function detectBrowser(): BrowserKey {
  if (typeof navigator === "undefined") return "unknown";

  const nav = navigator as Navigator & {
    brave?: unknown;
    userAgentData?: { brands?: Array<{ brand: string }> };
  };

  if (typeof nav.brave !== "undefined") return "brave";

  const ua = navigator.userAgent.toLowerCase();
  const brands = (nav.userAgentData?.brands ?? [])
    .map((entry) => entry.brand.toLowerCase())
    .join(" ");
  const source = `${ua} ${brands}`;

  if (source.includes("opr/") || source.includes("opera")) return "opera";
  if (source.includes("edg/")) return "edge";
  if (source.includes("firefox/")) return "firefox";
  if (source.includes("safari") && !source.includes("chrome") && !source.includes("chromium")) return "safari";
  if (source.includes("chrome") || source.includes("chromium")) return "chrome";

  return "unknown";
}

function detectMobileOs(): MobileOsKey {
  if (typeof navigator === "undefined") return "none";

  const nav = navigator as Navigator & {
    userAgentData?: { mobile?: boolean; platform?: string };
    platform?: string;
  };
  const ua = navigator.userAgent.toLowerCase();
  const platform = (nav.userAgentData?.platform || nav.platform || "").toLowerCase();
  const isLikelyMobile =
    Boolean(nav.userAgentData?.mobile) ||
    /android|iphone|ipad|ipod|mobile/.test(ua) ||
    /android|iphone|ipad|ipod/.test(platform);

  if (!isLikelyMobile) return "none";
  if (/android/.test(ua) || /android/.test(platform)) return "android";
  if (/iphone|ipad|ipod/.test(ua) || /iphone|ipad|ipod/.test(platform)) return "ios";
  return "other-mobile";
}

export default function PerformanceInstructionsOverlay({ isVisible }: PerformanceInstructionsOverlayProps) {
  const navigate = useNavigate();
  const browser = useMemo(detectBrowser, []);
  const mobileOs = useMemo(detectMobileOs, []);
  const guide = BROWSER_GUIDES[browser];
  const mobileGuide = mobileOs !== "none" ? MOBILE_GUIDES[mobileOs] : null;
  const copySettingsPath = async () => {
    if (!guide.settingsPath) return;

    const value = guide.settingsPath;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = value;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        try {
          textArea.focus();
          textArea.select();
          const copied = document.execCommand("copy");
          if (!copied) throw new Error("execCommand copy failed");
        } finally {
          document.body.removeChild(textArea);
        }
      }

      toast.success("Settings path copied", {
        description: "Paste it into your browser address bar and press Enter.",
      });
    } catch {
      toast.error("Could not copy settings path", {
        description: "Please copy it manually and paste it into the browser address bar.",
      });
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="performance-instructions-overlay"
          variants={blogShellVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+5.5rem)] bottom-[8vh] z-30 px-4 sm:px-6 md:bottom-[14vh] md:top-[10vh] max-md:[@media(orientation:landscape)]:z-[60] max-md:[@media(orientation:landscape)]:bottom-[2vh] max-md:[@media(orientation:landscape)]:top-[calc(env(safe-area-inset-top)+4rem)]"
        >
          <div className="h-full max-w-4xl mx-auto overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-xl">
            <div className="h-full overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8">
              <motion.div
                variants={blogInnerVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="space-y-6"
              >
                <button
                  onClick={() => navigate("/")}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Home
                </button>

                <article className="glass-panel p-5 sm:p-8 space-y-4">
                  <h1 className="font-display text-3xl sm:text-4xl font-bold">
                    Performance Instructions
                  </h1>
                  <img
                    src="/meter_astronaut.png"
                    alt="Meter Astronaut"
                    loading="lazy"
                    decoding="async"
                    className="mx-auto w-[400px] h-auto rounded-lg"
                  />
                  <p className="text-sm text-muted-foreground">
                    If rendering is below 50 FPS, these steps are tailored to your detected browser.
                    <br />
                    <br />
                    <strong className="text-foreground">Detected browser:</strong> {guide.label}
                    <br />
                    <strong className="text-foreground">Detected device:</strong>{" "}
                    {mobileGuide ? `${mobileGuide.label} (mobile)` : "Desktop"}
                    <br />
                    <strong className="text-foreground">Note:</strong> Performance throttling can happen on many
                    WebGL-heavy sites depending on browser and power settings.
                  </p>
                  <div className="space-y-2 text-sm text-muted-foreground leading-7">
                    <p>
                      <strong className="text-foreground">Recommended steps for {guide.label}</strong>
                    </p>
                    {mobileGuide ? (
                      <div className="rounded-md border border-border/50 bg-muted/30 p-3 space-y-2">
                        <p>
                          <strong className="text-foreground">
                            Mobile instructions ({mobileGuide.label}) - guided steps:
                          </strong>
                        </p>
                        <ol className="list-decimal pl-5 space-y-1">
                          {mobileGuide.steps.map((step, index) => (
                            <li key={`${mobileGuide.label}-mobile-step-${index}`}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    ) : null}
                    {guide.settingsPath ? (
                      <p>
                        Browser security blocks websites from opening internal settings pages directly. Click to copy:{" "}
                        <button
                          type="button"
                          onClick={copySettingsPath}
                          className="rounded bg-muted px-2 py-1 font-mono text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors select-all"
                          title="Copy settings path"
                        >
                          {guide.settingsPath}
                        </button>
                      </p>
                    ) : null}
                    <ol className="list-decimal pl-5 space-y-1">
                      {guide.steps.map((step, index) => (
                        <li key={`${guide.label}-step-${index}`}>{step}</li>
                      ))}
                    </ol>
                    {guide.note ? <p>{guide.note}</p> : null}
                    <p>
                      If FPS is still low, it is usually because battery saver is active when unplugged or near 20%
                      battery.
                    </p>
                  </div>
                </article>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
