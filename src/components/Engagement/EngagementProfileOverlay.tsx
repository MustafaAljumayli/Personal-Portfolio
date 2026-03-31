import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchEngagementSession, updateEngagementProfile, uploadEngagementAvatar } from "@/lib/blog-api";
import { getStoredEngagementSession, setStoredEngagementSession } from "@/lib/engagement-session";
import { blogInnerVariants, blogShellVariants } from "@/lib/uiMotion";
import { toast } from "sonner";

interface Props {
  isVisible: boolean;
}

export default function EngagementProfileOverlay({ isVisible }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

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

  useEffect(() => {
    if (!isVisible) return;
    const stored = getStoredEngagementSession();
    if (!stored?.token) {
      navigate(next, { replace: true });
      return;
    }
    setName(stored.session.name || "");
    setEmail(stored.session.email || "");
    setAvatarUrl(stored.session.avatarUrl || null);
    void fetchEngagementSession(stored.token)
      .then((session) => {
        setName(session.name || "");
        setEmail(session.email || "");
        setAvatarUrl(session.avatarUrl || null);
        setStoredEngagementSession({ token: stored.token, session });
      })
      .catch(() => {
        navigate(next, { replace: true });
      });
  }, [isVisible, navigate, next]);

  const onUploadAvatar = async (file: File | null) => {
    if (!file) return;
    const stored = getStoredEngagementSession();
    if (!stored?.token) {
      navigate(next, { replace: true });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const result = await uploadEngagementAvatar(stored.token, file);
      setAvatarUrl(result.avatarUrl);
      setStoredEngagementSession({ token: stored.token, session: result.session });
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    const stored = getStoredEngagementSession();
    if (!stored?.token) {
      navigate(next, { replace: true });
      return;
    }
    setIsSaving(true);
    try {
      const result = await updateEngagementProfile(stored.token, name, avatarUrl);
      setStoredEngagementSession({ token: stored.token, session: result.session });
      toast.success("Profile updated");
      navigate(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="engagement-profile-overlay"
          variants={blogShellVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+5.5rem)] bottom-[8vh] z-30 px-4 sm:px-6 md:bottom-[14vh] md:top-[10vh] max-md:[@media(orientation:landscape)]:z-[60] max-md:[@media(orientation:landscape)]:bottom-[2vh] max-md:[@media(orientation:landscape)]:top-[calc(env(safe-area-inset-top)+4rem)]"
        >
          <div className="h-full max-w-2xl mx-auto overflow-hidden rounded-xl border border-border/50 bg-card/95 shadow-xl">
            <div className="h-full overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8">
              <motion.div variants={blogInnerVariants} initial="hidden" animate="visible" exit="hidden" className="space-y-5">
                <button
                  onClick={() => navigate(next)}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <div>
                  <h2 className="font-display text-3xl font-bold">Engagement Profile</h2>
                  <p className="text-sm text-muted-foreground mt-1">Update the name and photo shown with your comments.</p>
                </div>

                <form onSubmit={onSave} className="space-y-3">
                  <div className="rounded-md border border-border/30 bg-background/40 p-3 text-sm text-muted-foreground">
                    Signed in as <span className="text-foreground">{email || "Unknown email"}</span>
                  </div>
                  <div className="rounded-md border border-border/30 bg-background/30 p-3">
                    <p className="mb-2 text-sm text-muted-foreground">Profile photo</p>
                    <div className="flex items-center gap-3">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt="Profile avatar"
                          className="h-12 w-12 rounded-full object-cover border border-border/50"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div
                          className="flex h-12 w-12 items-center justify-center rounded-full border border-border/50 text-sm font-medium"
                          style={getInitialAvatarStyle((name || email || "unknown").trim())}
                        >
                          {(name || email || "U").trim().charAt(0).toUpperCase()}
                        </div>
                      )}
                      <label className="text-sm text-primary hover:underline cursor-pointer">
                        {isUploadingAvatar ? "Uploading..." : "Upload photo"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={isUploadingAvatar}
                          onChange={(e) => {
                            void onUploadAvatar(e.target.files?.[0] || null);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your display name"
                    className="h-11 w-full rounded-md border border-border/40 bg-background px-3 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-70"
                  >
                    {isSaving ? "Saving..." : "Save profile"}
                  </button>
                </form>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
