import { useRef, useState, useEffect } from "react";
import { ImagePlus, Eye, Pencil, Loader2, Heading2, List, ListOrdered, Quote, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL } from "@/lib/api";
import BlogArticleBody from "@/components/Blog/BlogArticleBody";
import { toast } from "sonner";

export interface BlogEditorValues {
  title: string;
  excerpt: string;
  content: string;
  cover_image_url: string;
}

type Props = {
  values: BlogEditorValues;
  onChange: (next: BlogEditorValues) => void;
  token: string;
  /** When true, textarea auto-focuses on mount */
  autoFocus?: boolean;
};

function insertAtCursor(textarea: HTMLTextAreaElement, snippet: string, onValue: (v: string) => void, current: string) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const next = current.slice(0, start) + snippet + current.slice(end);
  onValue(next);
  const pos = start + snippet.length;
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(pos, pos);
  });
}

export default function BlogEditor({ values, onChange, token, autoFocus }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const valuesRef = useRef(values);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [uploading, setUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const setContent = (content: string) => onChange({ ...valuesRef.current, content });
  const setField = (key: keyof BlogEditorValues, v: string) =>
    onChange({ ...valuesRef.current, [key]: v });

  const uploadFile = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE_URL}/api/blog/upload-image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "Upload failed");
    if (!data?.url) throw new Error("No image URL returned");
    return data.url as string;
  };

  const handleInlineImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !taRef.current) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      const defaultLine = `\n![${file.name.replace(/\.[^.]+$/, "") || "Image"}](${url} "float-left")\n`;
      insertAtCursor(taRef.current, defaultLine, setContent, valuesRef.current.content);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverUploading(true);
    try {
      const url = await uploadFile(file);
      setField("cover_image_url", url);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Cover upload failed");
    } finally {
      setCoverUploading(false);
    }
  };

  const wrapSelection = (before: string, after: string = before) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const body = valuesRef.current.content;
    const selected = body.slice(start, end);
    const next = body.slice(0, start) + before + selected + after + body.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      const newStart = start + before.length;
      const newEnd = newStart + selected.length;
      ta.setSelectionRange(newStart, newEnd);
    });
  };

  const insertLine = (line: string) => {
    const ta = taRef.current;
    if (!ta) return;
    insertAtCursor(ta, line, setContent, valuesRef.current.content);
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Post title"
        value={values.title}
        onChange={(e) => setField("title", e.target.value)}
        className="bg-secondary/30"
      />

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Cover image (optional)</p>
        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="https://… or upload"
            value={values.cover_image_url}
            onChange={(e) => setField("cover_image_url", e.target.value)}
            className="bg-secondary/30 flex-1 min-w-[200px]"
          />
          <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleCoverUpload} />
          <Button type="button" variant="secondary" size="sm" disabled={coverUploading} onClick={() => coverRef.current?.click()}>
            {coverUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            Upload
          </Button>
        </div>
      </div>

      <Input
        placeholder="Excerpt (optional, for list view)"
        value={values.excerpt}
        onChange={(e) => setField("excerpt", e.target.value)}
        className="bg-secondary/30"
      />

      <div className="flex flex-wrap gap-2 items-center border-b border-border/30 pb-3">
        <div className="flex rounded-lg border border-border/40 p-0.5 bg-secondary/20">
          <Button
            type="button"
            variant={mode === "edit" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1"
            onClick={() => setMode("edit")}
          >
            <Pencil className="w-3.5 h-3.5" /> Write
          </Button>
          <Button
            type="button"
            variant={mode === "preview" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1"
            onClick={() => setMode("preview")}
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </Button>
        </div>
        {mode === "edit" && (
          <>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleInlineImage} />
            <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              Image
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => wrapSelection("**", "**")} title="Bold">
              <strong>B</strong>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => wrapSelection("_", "_")} title="Italic">
              <em>I</em>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => insertLine("\n## ")} title="Heading">
              <Heading2 className="w-4 h-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => insertLine("\n- ")} title="Bullet list">
              <List className="w-4 h-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => insertLine("\n1. ")} title="Numbered list">
              <ListOrdered className="w-4 h-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => insertLine("\n> ")} title="Quote">
              <Quote className="w-4 h-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => insertLine("\n\n---\n\n")} title="Divider">
              <Minus className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      {mode === "edit" ? (
        <Textarea
          ref={taRef}
          autoFocus={autoFocus}
          placeholder="Write in Markdown (GitHub-flavored). Use blank lines between paragraphs."
          value={values.content}
          onChange={(e) => setContent(e.target.value)}
          className="bg-secondary/30 min-h-[min(520px,55vh)] font-mono text-sm leading-relaxed"
          spellCheck
        />
      ) : (
        <div className="rounded-lg border border-border/40 bg-secondary/20 p-6 min-h-[min(520px,55vh)] overflow-y-auto custom-scrollbar">
          {values.content.trim() ? (
            <BlogArticleBody content={values.content} className="prose prose-invert max-w-none" />
          ) : (
            <p className="text-muted-foreground text-sm">Nothing to preview yet.</p>
          )}
        </div>
      )}

      <details className="text-xs text-muted-foreground rounded-lg border border-border/30 bg-secondary/10 p-3">
        <summary className="cursor-pointer font-medium text-foreground/80">Formatting & images</summary>
        <ul className="mt-2 space-y-1 list-disc pl-4">
          <li>
            <strong>Text wraps around images</strong> on desktop: use the title in quotes —{" "}
            <code className="text-primary/90">![]("float-left")</code> or <code className="text-primary/90">"float-right"</code> after the URL.
          </li>
          <li>
            Example: <code className="break-all">![Diagram](https://…/x.png "float-left")</code>
          </li>
          <li>
            Centered: <code>"center"</code> · Full width: <code>"wide"</code> · Uploaded images default to <code>float-left</code>.
          </li>
          <li>
            <strong>Size</strong> (comma-separated): <code>w-400</code> or <code>width-480</code> (pixels),{" "}
            <code>w-60%</code> or <code>55%</code> (width), <code>h-320</code> (max height). Example:{" "}
            <code className="break-all">"float-left, w-280"</code> or <code className="break-all">"center, w-90%, Diagram"</code> (last part is an optional caption).
          </li>
          <li>Links, tables, lists, code blocks, and blockquotes use standard Markdown.</li>
        </ul>
      </details>
    </div>
  );
}
