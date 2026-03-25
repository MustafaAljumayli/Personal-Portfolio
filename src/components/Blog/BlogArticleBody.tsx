import type { CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import { parseBlogImageTitle } from "@/lib/parseBlogImageTitle";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h2 className="font-display text-2xl md:text-3xl font-semibold mt-10 mb-4 text-foreground first:mt-0">
      {children}
    </h2>
  ),
  h2: ({ children }) => (
    <h3 className="font-display text-xl md:text-2xl font-semibold mt-8 mb-3 text-foreground">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="font-display text-lg md:text-xl font-semibold mt-6 mb-2 text-foreground">{children}</h4>
  ),
  h4: ({ children }) => (
    <h5 className="font-display text-base md:text-lg font-semibold mt-5 mb-2 text-foreground">{children}</h5>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-4 hover:text-primary/80"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-1 text-foreground/90">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-1 text-foreground/90">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/50 pl-4 my-6 italic text-muted-foreground">{children}</blockquote>
  ),
  hr: () => <hr className="my-10 border-border/50" />,
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className={cn("font-mono text-sm", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-secondary/60 px-1.5 py-0.5 font-mono text-[0.9em] text-foreground/95" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg bg-secondary/40 border border-border/40 p-4 my-6 text-sm">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-6">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-secondary/40">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-border/40 px-3 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border/40 px-3 py-2 align-top">{children}</td>,
  img: ({ src, alt, title }) => {
    if (!src) return null;
    const parsed = parseBlogImageTitle(title);
    const { align, maxWidth, maxHeight, caption, hasDirectives } = parsed;
    const showCaption = Boolean(caption && caption !== alt);

    const sizeStyle: CSSProperties = {
      ...(maxWidth ? { maxWidth } : {}),
      ...(maxHeight ? { maxHeight } : {}),
    };

    return (
      <span
        className={cn(
          "block my-6",
          align === "center" && "flex justify-center"
        )}
      >
        <img
          src={src}
          alt={alt ?? ""}
          title={caption ?? (!hasDirectives && title ? title : undefined)}
          loading="lazy"
          decoding="async"
          style={Object.keys(sizeStyle).length ? sizeStyle : undefined}
          className={cn(
            "rounded-lg w-auto h-auto",
            !maxHeight && "max-h-[70vh]",
            align === "left" &&
              (maxWidth
                ? "float-none mx-auto md:mx-0 md:float-left md:mr-6 md:mb-3 max-w-full"
                : "float-none mx-auto md:mx-0 md:float-left md:max-w-[min(45%,26rem)] md:mr-6 md:mb-3"),
            align === "right" &&
              (maxWidth
                ? "float-none mx-auto md:mx-0 md:float-right md:ml-6 md:mb-3 max-w-full"
                : "float-none mx-auto md:mx-0 md:float-right md:max-w-[min(45%,26rem)] md:ml-6 md:mb-3"),
            align === "center" && (maxWidth ? "max-w-full" : "max-w-full md:max-w-2xl mx-auto"),
            align === "wide" && "w-full max-w-4xl mx-auto",
            !align && (maxWidth ? "max-w-full mx-auto block" : "max-w-full mx-auto")
          )}
        />
        {showCaption ? (
          <span className="mt-2 block text-center text-sm text-muted-foreground">{caption}</span>
        ) : null}
      </span>
    );
  },
};

interface BlogArticleBodyProps {
  content: string;
  className?: string;
}

export default function BlogArticleBody({ content, className }: BlogArticleBodyProps) {
  return (
    <div className={cn("blog-article-markdown blog-article-clearfix", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
