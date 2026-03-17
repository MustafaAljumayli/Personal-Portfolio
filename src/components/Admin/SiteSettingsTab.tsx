import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fetchSection, saveSection } from "@/lib/content-api";

interface SiteSettings {
  name: string;
  headline: string;
}

const defaults: SiteSettings = {
  name: "Mustafa Aljumayli",
  headline: "Software Engineer • AI Researcher",
};

export default function SiteSettingsTab({ token }: { token: string }) {
  const [settings, setSettings] = useState<SiteSettings>(defaults);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchSection<SiteSettings>("settings").then((d) => {
      if (d) setSettings({ ...defaults, ...d });
      setLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSection("settings", settings, token);
      toast.success("Site settings saved!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <Loader2 className="w-5 h-5 animate-spin mx-auto mt-8" />;

  return (
    <div className="glass-panel p-6 space-y-5">
      <h3 className="font-display font-semibold text-lg">Homepage Hero</h3>
      <p className="text-sm text-muted-foreground">
        Controls the name and headline shown on the homepage when no section is selected.
      </p>

      <div className="space-y-3">
        <label className="block text-sm font-medium">
          Name
          <Input
            className="mt-1 bg-secondary/30"
            value={settings.name}
            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
          />
        </label>

        <label className="block text-sm font-medium">
          Headline
          <Input
            className="mt-1 bg-secondary/30"
            value={settings.headline}
            onChange={(e) => setSettings({ ...settings, headline: e.target.value })}
          />
        </label>
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Settings
      </Button>
    </div>
  );
}
