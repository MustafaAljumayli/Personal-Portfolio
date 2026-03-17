import { useState, useEffect } from "react";
import { Save, Loader2, Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { fetchSection, saveSection } from "@/lib/content-api";

interface Project {
  title: string;
  description?: string;
  bullets?: string[];
  tech: string[];
  githubUrl?: string | null;
  liveUrl?: string | null;
}

const emptyProject: Project = { title: "", bullets: [""], tech: [], githubUrl: "", liveUrl: "" };

export default function ProjectsTab({ token }: { token: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetchSection<Project[]>("projects").then((d) => {
      if (d && Array.isArray(d)) setProjects(d);
      setLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSection("projects", projects, token);
      toast.success("Projects saved!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addProject = () => {
    setProjects([...projects, { ...emptyProject, bullets: [""] }]);
    setExpanded(projects.length);
  };

  const removeProject = (i: number) => {
    const p = [...projects];
    p.splice(i, 1);
    setProjects(p);
    if (expanded === i) setExpanded(null);
  };

  const update = (i: number, patch: Partial<Project>) => {
    const p = [...projects];
    p[i] = { ...p[i], ...patch };
    setProjects(p);
  };

  const moveUp = (i: number) => {
    if (i === 0) return;
    const p = [...projects];
    [p[i - 1], p[i]] = [p[i], p[i - 1]];
    setProjects(p);
    setExpanded(i - 1);
  };

  const moveDown = (i: number) => {
    if (i >= projects.length - 1) return;
    const p = [...projects];
    [p[i], p[i + 1]] = [p[i + 1], p[i]];
    setProjects(p);
    setExpanded(i + 1);
  };

  const updateBullet = (pi: number, bi: number, val: string) => {
    const bullets = [...(projects[pi].bullets ?? [])];
    bullets[bi] = val;
    update(pi, { bullets });
  };

  const addBullet = (pi: number) => {
    update(pi, { bullets: [...(projects[pi].bullets ?? []), ""] });
  };

  const removeBullet = (pi: number, bi: number) => {
    const bullets = [...(projects[pi].bullets ?? [])];
    bullets.splice(bi, 1);
    update(pi, { bullets });
  };

  const updateTech = (pi: number, val: string) => {
    update(pi, { tech: val.split(",").map((s) => s.trim()).filter(Boolean) });
  };

  if (!loaded) return <Loader2 className="w-5 h-5 animate-spin mx-auto mt-8" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{projects.length} project{projects.length !== 1 && "s"}</p>
        <Button onClick={addProject} size="sm" className="gap-1">
          <Plus className="w-4 h-4" /> Add Project
        </Button>
      </div>

      {projects.map((proj, i) => (
        <div key={i} className="glass-panel overflow-hidden">
          <button
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{proj.title || "(untitled)"}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {proj.tech.slice(0, 3).join(", ")}{proj.tech.length > 3 ? "…" : ""}
              </span>
            </div>
            {expanded === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expanded === i && (
            <div className="p-4 pt-0 space-y-3 border-t border-border/30">
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => moveUp(i)} disabled={i === 0}>
                  <ChevronUp className="w-3 h-3" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => moveDown(i)} disabled={i >= projects.length - 1}>
                  <ChevronDown className="w-3 h-3" />
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={() => removeProject(i)} className="text-destructive">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </Button>
              </div>

              <label className="block text-sm font-medium">
                Title
                <Input className="mt-1 bg-secondary/30" value={proj.title} onChange={(e) => update(i, { title: e.target.value })} />
              </label>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Bullet Points</span>
                  <Button variant="ghost" size="sm" onClick={() => addBullet(i)} className="gap-1 h-7 text-xs">
                    <Plus className="w-3 h-3" /> Add
                  </Button>
                </div>
                {(proj.bullets ?? []).map((b, bi) => (
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

              <label className="block text-sm font-medium">
                Tech (comma-separated)
                <Input
                  className="mt-1 bg-secondary/30"
                  value={proj.tech.join(", ")}
                  onChange={(e) => updateTech(i, e.target.value)}
                  placeholder="React, TypeScript, Node.js"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-medium">
                  GitHub URL
                  <Input
                    className="mt-1 bg-secondary/30"
                    value={proj.githubUrl ?? ""}
                    onChange={(e) => update(i, { githubUrl: e.target.value || null })}
                    placeholder="https://github.com/..."
                  />
                </label>
                <label className="block text-sm font-medium">
                  Live URL
                  <Input
                    className="mt-1 bg-secondary/30"
                    value={proj.liveUrl ?? ""}
                    onChange={(e) => update(i, { liveUrl: e.target.value || null })}
                    placeholder="https://..."
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      ))}

      {projects.length === 0 && (
        <div className="glass-panel p-8 text-center text-muted-foreground">
          No projects yet. Add your first one!
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} className="gap-2 w-full">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save All Projects
      </Button>
    </div>
  );
}
