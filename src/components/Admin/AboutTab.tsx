import { useState, useEffect } from "react";
import { Save, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { fetchSection, saveSection } from "@/lib/content-api";

interface AboutStat {
  number: string;
  label: string;
}

interface AboutTag {
  icon: string;
  text: string;
}

interface AboutData {
  subtitle: string;
  tags: AboutTag[];
  paragraphs: string[];
  stats: AboutStat[];
}

const defaults: AboutData = {
  subtitle: "Software Engineer & AI Researcher",
  tags: [
    { icon: "MapPin", text: "Chapel Hill, NC" },
    { icon: "Calendar", text: "2 Years Experience" },
    { icon: "Coffee", text: "Coffee Enthusiast" },
  ],
  paragraphs: [
    "I'm a passionate software engineer with a love for building large-scale performative systems. My journey in tech started with curiosity about how things work, and it's evolved into a career focused on creating impactful technology. I'm currently a software engineer at Deutsche Bank and Graduate AI Researcher at Georgia Tech.",
    "When I'm not coding, you can find me exploring new technologies, contributing to open-source projects, or sharing knowledge with the developer/student community. I believe in writing clean, maintainable code that makes a difference, and I'm always looking for new challenges and opportunities to grow. I'm also really interested in startups, having been a previous founder myself!",
  ],
  stats: [
    { number: "20+", label: "Projects" },
    { number: "10+", label: "Clients" },
    { number: "2+", label: "Years" },
  ],
};

export default function AboutTab({ token }: { token: string }) {
  const [about, setAbout] = useState<AboutData>(defaults);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchSection<AboutData>("about").then((d) => {
      if (d) setAbout({ ...defaults, ...d });
      setLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSection("about", about, token);
      toast.success("About section saved!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const updateParagraph = (i: number, val: string) => {
    const p = [...about.paragraphs];
    p[i] = val;
    setAbout({ ...about, paragraphs: p });
  };

  const addParagraph = () => setAbout({ ...about, paragraphs: [...about.paragraphs, ""] });

  const removeParagraph = (i: number) => {
    const p = [...about.paragraphs];
    p.splice(i, 1);
    setAbout({ ...about, paragraphs: p });
  };

  const updateTag = (i: number, field: keyof AboutTag, val: string) => {
    const t = [...about.tags];
    t[i] = { ...t[i], [field]: val };
    setAbout({ ...about, tags: t });
  };

  const addTag = () => setAbout({ ...about, tags: [...about.tags, { icon: "Star", text: "" }] });

  const removeTag = (i: number) => {
    const t = [...about.tags];
    t.splice(i, 1);
    setAbout({ ...about, tags: t });
  };

  const updateStat = (i: number, field: keyof AboutStat, val: string) => {
    const s = [...about.stats];
    s[i] = { ...s[i], [field]: val };
    setAbout({ ...about, stats: s });
  };

  const addStat = () => setAbout({ ...about, stats: [...about.stats, { number: "", label: "" }] });

  const removeStat = (i: number) => {
    const s = [...about.stats];
    s.splice(i, 1);
    setAbout({ ...about, stats: s });
  };

  if (!loaded) return <Loader2 className="w-5 h-5 animate-spin mx-auto mt-8" />;

  return (
    <div className="space-y-6">
      <div className="glass-panel p-6 space-y-4">
        <h3 className="font-display font-semibold text-lg">About Section</h3>

        <label className="block text-sm font-medium">
          Subtitle
          <Input
            className="mt-1 bg-secondary/30"
            value={about.subtitle}
            onChange={(e) => setAbout({ ...about, subtitle: e.target.value })}
          />
        </label>

        {/* Tags */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Tags</span>
            <Button variant="ghost" size="sm" onClick={addTag} className="gap-1 h-7 text-xs">
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {about.tags.map((tag, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  className="bg-secondary/30 w-28"
                  placeholder="Icon name"
                  value={tag.icon}
                  onChange={(e) => updateTag(i, "icon", e.target.value)}
                />
                <Input
                  className="bg-secondary/30 flex-1"
                  placeholder="Tag text"
                  value={tag.text}
                  onChange={(e) => updateTag(i, "text", e.target.value)}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeTag(i)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Bio Paragraphs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Bio Paragraphs</span>
            <Button variant="ghost" size="sm" onClick={addParagraph} className="gap-1 h-7 text-xs">
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {about.paragraphs.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Textarea
                  className="bg-secondary/30 min-h-[80px] flex-1"
                  value={p}
                  onChange={(e) => updateParagraph(i, e.target.value)}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 mt-1" onClick={() => removeParagraph(i)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Stats</span>
            <Button variant="ghost" size="sm" onClick={addStat} className="gap-1 h-7 text-xs">
              <Plus className="w-3 h-3" /> Add
            </Button>
          </div>
          <div className="space-y-2">
            {about.stats.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  className="bg-secondary/30 w-24"
                  placeholder="Number"
                  value={s.number}
                  onChange={(e) => updateStat(i, "number", e.target.value)}
                />
                <Input
                  className="bg-secondary/30 flex-1"
                  placeholder="Label"
                  value={s.label}
                  onChange={(e) => updateStat(i, "label", e.target.value)}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeStat(i)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save About
        </Button>
      </div>
    </div>
  );
}
