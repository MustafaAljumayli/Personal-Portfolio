import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { fetchSection, saveSection } from "@/lib/content-api";
import { supabase } from "@/integrations/supabase/client";
import { API_BASE_URL } from "@/lib/api";

interface SiteSettings {
  name: string;
  headline: string;
  greeting: string;
}

const defaults: SiteSettings = {
  name: "Mustafa Aljumayli",
  headline: "Software Engineer • AI Researcher",
  greeting: "Welcome to my world!",
};

export default function SiteSettingsTab({ token }: { token: string }) {
  const [settings, setSettings] = useState<SiteSettings>(defaults);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [adminDisplayName, setAdminDisplayName] = useState("");
  const [savingAdminName, setSavingAdminName] = useState(false);
  const [adminAvatarUrl, setAdminAvatarUrl] = useState<string | null>(null);
  const [uploadingAdminAvatar, setUploadingAdminAvatar] = useState(false);

  useEffect(() => {
    fetchSection<SiteSettings>("settings").then((d) => {
      if (d) setSettings({ ...defaults, ...d });
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const displayName = typeof data.user?.user_metadata?.display_name === "string"
        ? data.user.user_metadata.display_name
        : "";
      const avatarUrl = typeof data.user?.user_metadata?.avatar_url === "string"
        ? data.user.user_metadata.avatar_url
        : "";
      setAdminDisplayName(displayName);
      setAdminAvatarUrl(avatarUrl || null);
    });
  }, []);

  const getInitialAvatarStyle = (seed: string) => {
    let hash = 0;
    for (let idx = 0; idx < seed.length; idx += 1) {
      hash = (hash * 31 + seed.charCodeAt(idx)) | 0;
    }
    const hue = Math.abs(hash) % 360;
    return {
      backgroundColor: `hsl(${hue} 68% 42%)`,
      color: "hsl(0 0% 100%)",
    };
  };

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

  const handleSaveAdminName = async () => {
    const nextName = adminDisplayName.trim();
    if (!nextName || nextName.length > 80) {
      toast.error("Admin display name must be 1-80 characters");
      return;
    }
    setSavingAdminName(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: nextName },
      });
      if (error) throw error;

      const res = await fetch(`${API_BASE_URL}/api/admin/profile/display-name`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName: nextName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to propagate display name to comments");
      }

      toast.success("Admin display name updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update admin display name");
    } finally {
      setSavingAdminName(false);
    }
  };

  const handleUploadAdminAvatar = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploadingAdminAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE_URL}/api/admin/profile/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to upload admin avatar");
      const avatarUrl = typeof data?.avatarUrl === "string" ? data.avatarUrl : "";
      if (!avatarUrl) throw new Error("Missing avatar URL from upload response");
      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: avatarUrl },
      });
      if (error) throw error;
      setAdminAvatarUrl(avatarUrl);
      toast.success("Admin profile photo updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to upload admin avatar");
    } finally {
      setUploadingAdminAvatar(false);
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
        <label className="block text-sm font-medium">
          Greeting
          <Input
            className="mt-1 bg-secondary/30"
            value={settings.greeting}
            onChange={(e) => setSettings({ ...settings, greeting: e.target.value })}
          />
        </label>
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Settings
      </Button>

      <div className="border-t border-border/30 pt-4 space-y-3">
        <h4 className="font-display font-semibold">Admin Display Name</h4>
        <p className="text-sm text-muted-foreground">
          Used for admin comments and dashboard moderation replies.
        </p>
        <Input
          className="bg-secondary/30"
          value={adminDisplayName}
          onChange={(e) => setAdminDisplayName(e.target.value)}
          placeholder="Your admin display name"
        />
        <Button onClick={handleSaveAdminName} disabled={savingAdminName} className="gap-2">
          {savingAdminName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Admin Name
        </Button>
      </div>

      <div className="border-t border-border/30 pt-4 space-y-3">
        <h4 className="font-display font-semibold">Admin Profile Photo</h4>
        <p className="text-sm text-muted-foreground">
          Used for admin comments and replies.
        </p>
        <div className="flex items-center gap-3">
          {adminAvatarUrl ? (
            <img
              src={adminAvatarUrl}
              alt="Admin avatar"
              className="h-12 w-12 rounded-full border border-border/50 object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full border border-border/50 text-sm font-semibold"
              style={getInitialAvatarStyle(adminDisplayName || "admin")}
            >
              {(adminDisplayName || "A").trim().charAt(0).toUpperCase()}
            </div>
          )}
          <label className="cursor-pointer text-sm text-primary hover:underline">
            {uploadingAdminAvatar ? "Uploading..." : "Upload admin photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingAdminAvatar}
              onChange={(e) => {
                void handleUploadAdminAvatar(e.target.files?.[0] || null);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
