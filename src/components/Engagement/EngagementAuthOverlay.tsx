import { FormEvent, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { requestEngagementCode, verifyEngagementCode } from "@/lib/blog-api";
import { setStoredEngagementSession } from "@/lib/engagement-session";
import { blogInnerVariants, blogShellVariants } from "@/lib/uiMotion";
import { toast } from "sonner";

interface Props {
  isVisible: boolean;
}

export default function EngagementAuthOverlay({ isVisible }: Props) {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [step, setStep] = useState<"request" | "verify">("request");
  const [mode, setMode] = useState<"signup" | "login">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onRequest = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await requestEngagementCode({
        email,
        mode,
        name: mode === "signup" ? name : undefined,
        consent: mode === "signup" ? consent : undefined,
        termsAccepted: mode === "signup" ? termsAccepted : undefined,
      });
      toast.success("Verification code sent to your email");
      setStep("verify");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send verification code";
      if (message.toLowerCase().includes("please sign up first")) {
        setMode("signup");
      }
      if (message.toLowerCase().includes("already exists") || message.toLowerCase().includes("log in instead")) {
        setMode("login");
      }
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onVerify = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await verifyEngagementCode(email, code);
      setStoredEngagementSession({ token: result.token, session: result.session });
      toast.success("You're now signed in for engagement");
      navigate(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to verify code");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="engagement-auth-overlay"
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
                  <h2 className="font-display text-3xl font-bold">Engagement Sign-In</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sign up once, then log in with only your email and verification code.
                  </p>
                </div>

                {user && isAdmin && (
                  <div className="rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-300">
                    Admin session is active. Sign out admin first before using engagement sign-in.
                    <button
                      onClick={() => void signOut()}
                      className="ml-2 text-amber-200 underline"
                    >
                      Sign out admin
                    </button>
                  </div>
                )}

                {!user || !isAdmin ? (step === "request" ? (
                  <form onSubmit={onRequest} className="space-y-3">
                    <div className="flex items-center gap-2 rounded-md border border-border/30 p-1 text-sm">
                      <button
                        type="button"
                        onClick={() => setMode("login")}
                        className={`flex-1 rounded px-3 py-2 transition-colors ${mode === "login" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Log In
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode("signup")}
                        className={`flex-1 rounded px-3 py-2 transition-colors ${mode === "signup" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Sign Up
                      </button>
                    </div>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="h-11 w-full rounded-md border border-border/40 bg-background px-3 text-sm"
                    />
                    {mode === "signup" && (
                      <>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          className="h-11 w-full rounded-md border border-border/40 bg-background px-3 text-sm"
                        />
                        <label className="flex items-start gap-2 text-sm text-muted-foreground">
                          <input className="mt-0.5" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                          <span>I consent to storage of my email and engagement data.</span>
                        </label>
                        <label className="flex items-start gap-2 text-sm text-muted-foreground">
                          <input className="mt-0.5" type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
                          <span>
                            I agree to the <Link to="/terms-and-conditions" className="text-primary hover:underline">Terms</Link> and{" "}
                            <Link to="/privacy-policy" className="text-primary hover:underline">Privacy Policy</Link>.
                          </span>
                        </label>
                      </>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-70"
                    >
                      {isSubmitting ? "Sending..." : mode === "signup" ? "Sign up" : "Sign in"}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={onVerify} className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Enter the 6-digit code sent to <span className="text-foreground">{email}</span>.
                    </p>
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="123456"
                      className="h-11 w-full rounded-md border border-border/40 bg-background px-3 text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-70"
                      >
                        {isSubmitting ? "Verifying..." : "Verify and continue"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setStep("request")}
                        className="rounded-md border border-border/40 px-4 py-2 text-sm"
                      >
                        Change email
                      </button>
                    </div>
                  </form>
                )) : null}
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
