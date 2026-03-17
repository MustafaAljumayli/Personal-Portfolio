import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fetchSection, saveSection } from "@/lib/content-api";

interface Profile {
  name: string;
  headline: string;
  location: string;
  email: string;
  website: string;
  linkedin: string;
  github: string;
  twitter: string;
}

const defaults: Profile = {
  name: "",
  headline: "",
  location: "",
  email: "",
  website: "",
  linkedin: "",
  github: "",
  twitter: "",
};

const fields: { key: keyof Profile; label: string; placeholder: string }[] = [
  { key: "name", label: "Full Name", placeholder: "Mustafa Aljumayli" },
  { key: "headline", label: "Headline", placeholder: "Software Engineer" },
  { key: "location", label: "Location", placeholder: "Chapel Hill, NC" },
  { key: "email", label: "Email", placeholder: "you@example.com" },
  { key: "website", label: "Website", placeholder: "www.example.com" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/username" },
  { key: "github", label: "GitHub", placeholder: "github.com/username" },
  { key: "twitter", label: "Twitter / X", placeholder: "x.com/username" },
];

export default function ContactTab({ token }: { token: string }) {
  const [profile, setProfile] = useState<Profile>(defaults);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchSection<Profile>("profile").then((d) => {
      if (d) setProfile({ ...defaults, ...d });
      setLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSection("profile", profile, token);
      toast.success("Contact info saved!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <Loader2 className="w-5 h-5 animate-spin mx-auto mt-8" />;

  return (
    <div className="glass-panel p-6 space-y-4">
      <h3 className="font-display font-semibold text-lg">Contact & Social Links</h3>
      <p className="text-sm text-muted-foreground">
        This info is shown on the Contact page and used to build social links.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map(({ key, label, placeholder }) => (
          <label key={key} className="block text-sm font-medium">
            {label}
            <Input
              className="mt-1 bg-secondary/30"
              placeholder={placeholder}
              value={profile[key]}
              onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Contact Info
      </Button>
    </div>
  );
}
