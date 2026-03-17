import { useState, useEffect, useRef } from "react";
import { Save, Loader2, Plus, Trash2, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { fetchSection, saveSection } from "@/lib/content-api";

interface Experience {
  title: string;
  company: string;
  period: string;
  bullets: string[];
}

export default function ExperienceTab({ token }: { token: string }) {
  const [items, setItems] = useState<Experience[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const expand = (i: number | null) => {
    setExpanded(i);
    if (i !== null) {
      setTimeout(() => itemRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  };

  useEffect(() => {
    fetchSection<Experience[]>("experience").then((d) => {
      if (d && Array.isArray(d)) {
        setItems(d.map((e: any) => ({ ...e, bullets: e.bullets ?? (e.description ? [e.description] : []) })));
      }
      setLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSection("experience", items, token);
      toast.success("Experience saved!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const add = () => {
    setItems([{ title: "", company: "", period: "", bullets: [""] }, ...items]);
    expand(0);
  };

  const remove = (i: number) => {
    const next = [...items];
    next.splice(i, 1);
    setItems(next);
    if (expanded === i) expand(null);
  };

  const update = (i: number, patch: Partial<Experience>) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    setItems(next);
  };

  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...items];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setItems(next);
    expand(i - 1);
  };

  const moveDown = (i: number) => {
    if (i >= items.length - 1) return;
    const next = [...items];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    setItems(next);
    expand(i + 1);
  };

  const updateBullet = (ei: number, bi: number, val: string) => {
    const bullets = [...items[ei].bullets];
    bullets[bi] = val;
    update(ei, { bullets });
  };

  const addBullet = (ei: number) => update(ei, { bullets: [...items[ei].bullets, ""] });

  const removeBullet = (ei: number, bi: number) => {
    const bullets = [...items[ei].bullets];
    bullets.splice(bi, 1);
    update(ei, { bullets });
  };

  if (!loaded) return <Loader2 className="w-5 h-5 animate-spin mx-auto mt-8" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} entr{items.length !== 1 ? "ies" : "y"}</p>
        <Button onClick={add} size="sm" className="gap-1">
          <Plus className="w-4 h-4" /> Add Experience
        </Button>
      </div>

      {items.map((exp, i) => (
        <div key={i} ref={(el) => { itemRefs.current[i] = el; }} className="glass-panel">
          <button
            onClick={() => expand(expanded === i ? null : i)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/20 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="truncate">
                <span className="font-semibold">{exp.title || "(untitled)"}</span>
                {exp.company && <span className="text-muted-foreground ml-2 text-sm">@ {exp.company}</span>}
              </div>
            </div>
            {expanded === i ? <ChevronUp className="w-4 h-4 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 flex-shrink-0" />}
          </button>

          {expanded === i && (
            <div className="p-4 pt-0 space-y-3 border-t border-border/30">
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => moveUp(i)} disabled={i === 0}>
                  <ChevronUp className="w-3 h-3" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => moveDown(i)} disabled={i >= items.length - 1}>
                  <ChevronDown className="w-3 h-3" />
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={() => remove(i)} className="text-destructive">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </Button>
              </div>

              <label className="block text-sm font-medium">
                Job Title
                <Input className="mt-1 bg-secondary/30" value={exp.title} onChange={(e) => update(i, { title: e.target.value })} />
              </label>

              <label className="block text-sm font-medium">
                Company
                <Input className="mt-1 bg-secondary/30" value={exp.company} onChange={(e) => update(i, { company: e.target.value })} />
              </label>

              <label className="block text-sm font-medium">
                Period
                <Input className="mt-1 bg-secondary/30" value={exp.period} onChange={(e) => update(i, { period: e.target.value })} placeholder="July 2025 - Present" />
              </label>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Bullet Points</span>
                  <Button variant="ghost" size="sm" onClick={() => addBullet(i)} className="gap-1 h-7 text-xs">
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </div>
                {exp.bullets.map((b, bi) => (
                  <div key={bi} className="flex gap-2 mb-1.5">
                    <Textarea
                      className="bg-secondary/30 min-h-[40px] flex-1"
                      rows={1}
                      value={b}
                      onChange={(e) => updateBullet(i, bi, e.target.value)}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeBullet(i, bi)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {items.length === 0 && (
        <div className="glass-panel p-8 text-center text-muted-foreground">
          No experience entries yet.
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} className="gap-2 w-full">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save All Experience
      </Button>
    </div>
  );
}
