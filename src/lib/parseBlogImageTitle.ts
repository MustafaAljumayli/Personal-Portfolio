export type ImageAlign = "left" | "right" | "center" | "wide" | undefined;

export type ParsedBlogImage = {
  align: ImageAlign;
  /** CSS max-width, e.g. `400px`, `60%` */
  maxWidth?: string;
  /** CSS max-height, e.g. `300px` */
  maxHeight?: string;
  /** Remaining title text after removing directives (optional caption) */
  caption?: string;
  /** True if any layout/size directive was recognized */
  hasDirectives: boolean;
};

/**
 * Parses the Markdown image "title" (quoted part after URL).
 * Use comma-separated directives, e.g. `float-left, w-400` or `center, w-80%, Photo credit`.
 *
 * Size tokens:
 * - `w-400` or `width-400` → max-width 400px
 * - `w-60%` or `60%` → max-width 60%
 * - `h-300` or `height-300` → max-height 300px
 */
export function parseBlogImageTitle(title: string | null | undefined): ParsedBlogImage {
  if (!title?.trim()) {
    return { align: undefined, hasDirectives: false };
  }

  const segments = title
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let align: ImageAlign = undefined;
  let maxWidth: string | undefined;
  let maxHeight: string | undefined;
  const captionParts: string[] = [];
  let hasDirectives = false;

  for (const seg of segments) {
    const lower = seg.toLowerCase();

    if (lower === "float-left" || lower === "left") {
      align = "left";
      hasDirectives = true;
      continue;
    }
    if (lower === "float-right" || lower === "right") {
      align = "right";
      hasDirectives = true;
      continue;
    }
    if (lower === "center") {
      align = "center";
      hasDirectives = true;
      continue;
    }
    if (lower === "wide" || lower === "full") {
      align = "wide";
      hasDirectives = true;
      continue;
    }

    const wPct = seg.match(/^w-(\d+)%$/i);
    if (wPct) {
      maxWidth = `${wPct[1]}%`;
      hasDirectives = true;
      continue;
    }

    const wPx = seg.match(/^w-(\d+)(?:px)?$/i) || seg.match(/^width-(\d+)(?:px)?$/i);
    if (wPx) {
      maxWidth = `${wPx[1]}px`;
      hasDirectives = true;
      continue;
    }

    const plainPx = seg.match(/^(\d+)px$/i);
    if (plainPx) {
      maxWidth = `${plainPx[1]}px`;
      hasDirectives = true;
      continue;
    }

    const plainPct = seg.match(/^(\d+)%$/);
    if (plainPct) {
      maxWidth = `${plainPct[1]}%`;
      hasDirectives = true;
      continue;
    }

    const hPx = seg.match(/^h-(\d+)(?:px)?$/i) || seg.match(/^height-(\d+)(?:px)?$/i);
    if (hPx) {
      maxHeight = `${hPx[1]}px`;
      hasDirectives = true;
      continue;
    }

    captionParts.push(seg);
  }

  const caption = captionParts.join(", ").trim() || undefined;

  return {
    align,
    maxWidth,
    maxHeight,
    caption,
    hasDirectives,
  };
}
