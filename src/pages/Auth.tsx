import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, ArrowLeft, Loader2, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { z } from "zod";
import {
  requestAdminSignInCode,
  requestEngagementCode,
  verifyAdminSignInCode,
  verifyEngagementCode,
} from "@/lib/blog-api";
import { clearStoredEngagementSession, setStoredEngagementSession } from "@/lib/engagement-session";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const emailSchema = z.string().trim().email("Please enter a valid email address");
const passwordSchema = z.string().min(1, "Password is required");

interface AuthProps {
  isOverlay?: boolean;
}

const Auth = ({ isOverlay = false }: AuthProps) => {
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const modeParam = searchParams.get("mode");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminStep, setAdminStep] = useState<"request" | "verify">("request");
  const [adminCode, setAdminCode] = useState("");
  const [mode, setMode] = useState<"admin" | "user">(modeParam === "user" ? "user" : "admin");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userCode, setUserCode] = useState("");
  const [userStep, setUserStep] = useState<"request" | "verify">("request");
  const [userAuthMode, setUserAuthMode] = useState<"signup" | "login">("login");
  const [userConsent, setUserConsent] = useState(false);
  const [userTerms, setUserTerms] = useState(false);
  const [userSubmitting, setUserSubmitting] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();

  const normalizeEmail = (value: string) => value.trim().replace(/\s+/g, "");

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const validate = () => {
    const newErrors: typeof errors = {};

    const emailResult = emailSchema.safeParse(normalizeEmail(email));
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    const normalizedEmail = normalizeEmail(email);
    setEmail(normalizedEmail);

    try {
      await requestAdminSignInCode(normalizedEmail, password);
      setAdminStep("verify");
      toast.success("Admin verification code sent");
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to send verification code");
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!/^\d{6}$/.test(adminCode.trim())) {
      toast.error("Enter the 6-digit verification code");
      return;
    }

    setIsSubmitting(true);
    const normalizedEmail = normalizeEmail(email);
    setEmail(normalizedEmail);

    try {
      const result = await verifyAdminSignInCode(normalizedEmail, password, adminCode.trim());
      const setSessionRes = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (setSessionRes.error) {
        toast.error(setSessionRes.error.message);
        return;
      }
      clearStoredEngagementSession();
      toast.success("Welcome back!");
      navigate("/");
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to verify code");
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (mode !== "admin") return;
    setAdminStep("request");
    setAdminCode("");
  }, [mode]);

  const handleUserRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserSubmitting(true);
    try {
      await requestEngagementCode({
        email: userEmail.trim(),
        mode: userAuthMode,
        name: userAuthMode === "signup" ? userName.trim() : undefined,
        consent: userAuthMode === "signup" ? userConsent : undefined,
        termsAccepted: userAuthMode === "signup" ? userTerms : undefined,
      });
      setUserStep("verify");
      toast.success("Verification code sent");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send verification code";
      if (message.toLowerCase().includes("please sign up first")) {
        setUserAuthMode("signup");
      }
      if (message.toLowerCase().includes("already exists") || message.toLowerCase().includes("log in instead")) {
        setUserAuthMode("login");
      }
      toast.error(message);
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleUserVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserSubmitting(true);
    try {
      const result = await verifyEngagementCode(userEmail.trim(), userCode.trim());
      setStoredEngagementSession({ token: result.token, session: result.session });
      navigate(nextPath);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to verify code");
    } finally {
      setUserSubmitting(false);
    }
  };

  return (
    <div className={isOverlay ? "fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6" : "min-h-screen bg-background flex items-center justify-center p-6"}>
      {!isOverlay ? <div className="star-field" /> : null}
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`glass-panel p-8 w-full max-w-md relative ${isOverlay ? "z-[71]" : "z-10"}`}
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>

        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold">Sign In</h1>
          <div className="mt-4 inline-flex rounded-lg border border-border/40 bg-secondary/20 p-1">
            <button
              onClick={() => setMode("admin")}
              className={`px-3 py-1.5 rounded-md text-sm ${mode === "admin" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
            >
              <Shield className="w-4 h-4 inline mr-1" />
              Admin
            </button>
            <button
              onClick={() => setMode("user")}
              className={`px-3 py-1.5 rounded-md text-sm ${mode === "user" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
            >
              <User className="w-4 h-4 inline mr-1" />
              User
            </button>
          </div>
        </div>

        {mode === "admin" ? (
        adminStep === "request" ? (
          <form noValidate onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setAdminStep("request");
                    setAdminCode("");
                  }}
                  className="pl-10 bg-secondary/30 border-border/50"
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setAdminStep("request");
                    setAdminCode("");
                  }}
                  className="pl-10 bg-secondary/30 border-border/50"
                />
              </div>
              {errors.password && (
                <p className="text-sm text-destructive mt-1">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        ) : (
          <form noValidate onSubmit={handleAdminVerify} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the admin code sent to <span className="text-foreground">{email}</span>.
            </p>
            <Input
              type="text"
              placeholder="123456"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              className="bg-secondary/30 border-border/50"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting} className="flex-1 bg-primary hover:bg-primary/90">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify and sign in"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setAdminStep("request")}>
                Back
              </Button>
            </div>
          </form>
        )
        ) : (
          userStep === "request" ? (
            <form noValidate onSubmit={handleUserRequest} className="space-y-4">
              <div className="inline-flex rounded-lg border border-border/40 bg-secondary/20 p-1">
                <button
                  type="button"
                  onClick={() => setUserAuthMode("login")}
                  className={`px-3 py-1.5 rounded-md text-sm ${userAuthMode === "login" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => setUserAuthMode("signup")}
                  className={`px-3 py-1.5 rounded-md text-sm ${userAuthMode === "signup" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
                >
                  Sign Up
                </button>
              </div>
              <Input
                type="email"
                placeholder="you@example.com"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="bg-secondary/30 border-border/50"
              />
              {userAuthMode === "signup" && (
                <>
                  <Input
                    type="text"
                    placeholder="Your name"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="bg-secondary/30 border-border/50"
                  />
                  <label className="flex items-start gap-2 text-sm text-muted-foreground">
                    <input className="mt-0.5" type="checkbox" checked={userConsent} onChange={(e) => setUserConsent(e.target.checked)} />
                    <span>I consent to storage of my engagement email and data.</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-muted-foreground">
                    <input className="mt-0.5" type="checkbox" checked={userTerms} onChange={(e) => setUserTerms(e.target.checked)} />
                    <span>I agree to Terms and Privacy Policy.</span>
                  </label>
                </>
              )}
              <Button type="submit" disabled={userSubmitting} className="w-full bg-primary hover:bg-primary/90">
                {userSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : userAuthMode === "signup" ? "Sign up" : "Sign in"}
              </Button>
            </form>
          ) : (
            <form noValidate onSubmit={handleUserVerify} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the code sent to <span className="text-foreground">{userEmail}</span>.
              </p>
              <Input
                type="text"
                placeholder="123456"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                className="bg-secondary/30 border-border/50"
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={userSubmitting} className="flex-1 bg-primary hover:bg-primary/90">
                  {userSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setUserStep("request")}>
                  Back
                </Button>
              </div>
            </form>
          )
        )}
      </motion.div>
    </div>
  );
};

export default Auth;