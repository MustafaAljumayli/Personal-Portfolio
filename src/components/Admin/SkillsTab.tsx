import { useState, useEffect } from "react";
import { Save, Loader2, Plus, Trash2, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fetchSection, saveSection } from "@/lib/content-api";

interface SkillCategory {
  title: string;
  skills: string[];
}

export default function SkillsTab({ token }: { token: string }) {
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [newSkillInputs, setNewSkillInputs] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchSection<SkillCategory[]>("skillCategories").then((d) => {
      if (d && Array.isArray(d)) setCategories(d);
      setLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSection("skillCategories", categories, token);
      toast.success("Skills saved!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => setCategories([...categories, { title: "", skills: [] }]);

  const removeCategory = (i: number) => {
    const c = [...categories];
    c.splice(i, 1);
    setCategories(c);
  };

  const updateTitle = (i: number, val: string) => {
    const c = [...categories];
    c[i] = { ...c[i], title: val };
    setCategories(c);
  };

  const removeSkill = (ci: number, si: number) => {
    const c = [...categories];
    const skills = [...c[ci].skills];
    skills.splice(si, 1);
    c[ci] = { ...c[ci], skills };
    setCategories(c);
  };

  const addSkill = (ci: number) => {
    const val = (newSkillInputs[ci] ?? "").trim();
    if (!val) return;
    const c = [...categories];
    c[ci] = { ...c[ci], skills: [...c[ci].skills, val] };
    setCategories(c);
    setNewSkillInputs({ ...newSkillInputs, [ci]: "" });
  };

  if (!loaded) return <Loader2 className="w-5 h-5 animate-spin mx-auto mt-8" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{categories.length} categor{categories.length !== 1 ? "ies" : "y"}</p>
        <Button onClick={addCategory} size="sm" className="gap-1">
          <Plus className="w-4 h-4" /> Add Category
        </Button>
      </div>

      {categories.map((cat, ci) => (
        <div key={ci} className="glass-panel p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              className="bg-secondary/30 font-semibold"
              placeholder="Category name"
              value={cat.title}
              onChange={(e) => updateTitle(ci, e.target.value)}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCategory(ci)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {cat.skills.map((skill, si) => (
              <span
                key={si}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm rounded-full bg-primary/10 text-primary"
              >
                {skill}
                <button onClick={() => removeSkill(ci, si)} className="hover:text-destructive ml-0.5">
                  <XIcon className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              className="bg-secondary/30 flex-1"
              placeholder="New skill…"
              value={newSkillInputs[ci] ?? ""}
              onChange={(e) => setNewSkillInputs({ ...newSkillInputs, [ci]: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(ci); } }}
            />
            <Button variant="outline" size="sm" onClick={() => addSkill(ci)}>
              Add
            </Button>
          </div>
        </div>
      ))}

      {categories.length === 0 && (
        <div className="glass-panel p-8 text-center text-muted-foreground">
          No skill categories yet.
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} className="gap-2 w-full">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save All Skills
      </Button>
    </div>
  );
}
