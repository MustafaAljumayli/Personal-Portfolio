import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearStoredEngagementSession } from "@/lib/engagement-session";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "sonner";

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const INACTIVITY_CHECK_INTERVAL_MS = 30 * 1000; // check every 30 seconds
const LAST_ACTIVITY_KEY = "admin_last_activity";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const signOutRef = useRef<(() => Promise<void>) | null>(null);
  const isAdminRef = useRef(false);

  const touchActivity = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  }, []);

  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  // Inactivity-based auto sign-out for admin sessions
  useEffect(() => {
    if (!user || !isAdmin) return;

    touchActivity();

    const activityEvents = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    const handler = () => touchActivity();
    for (const evt of activityEvents) window.addEventListener(evt, handler, { passive: true });

    const interval = setInterval(() => {
      const lastStr = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (!lastStr) return;
      const elapsed = Date.now() - Number(lastStr);
      if (elapsed >= INACTIVITY_TIMEOUT_MS && isAdminRef.current) {
        signOutRef.current?.();
        toast.info("Signed out due to inactivity");
      }
    }, INACTIVITY_CHECK_INTERVAL_MS);

    return () => {
      for (const evt of activityEvents) window.removeEventListener(evt, handler);
      clearInterval(interval);
    };
  }, [user, isAdmin, touchActivity]);

  const checkAdminRole = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!error && data) {
      setIsAdmin(true);
      clearStoredEngagementSession();
    } else {
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer the admin check with setTimeout to avoid deadlock
          setTimeout(() => {
            checkAdminRole(session.user.id);
          }, 0);
        } else {
          setIsAdmin(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminRole(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/auth/sign-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const err = new Error(body?.error || "Failed to sign in");
        toast.error(err.message);
        return { error: err };
      }

      const setSessionRes = await supabase.auth.setSession({
        access_token: body.access_token,
        refresh_token: body.refresh_token,
      });
      if (setSessionRes.error) {
        toast.error(setSessionRes.error.message);
        return { error: setSessionRes.error };
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to sign in");
      toast.error(err.message);
      return { error: err };
    }

    toast.success("Welcome back!");
    return { error: null };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    if (error) {
      if (error.message.includes("already registered")) {
        toast.error("This email is already registered. Please sign in instead.");
      } else {
        toast.error(error.message);
      }
      return { error };
    }
    toast.success("Account created successfully!");
    return { error: null };
  };

  const signOut = useCallback(async () => {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    await supabase.auth.signOut();
    setIsAdmin(false);
    toast.success("Signed out successfully");
  }, []);

  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);

  // On mount, check if an admin session went stale while the tab was closed
  useEffect(() => {
    const lastStr = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastStr) return;
    const elapsed = Date.now() - Number(lastStr);
    if (elapsed >= INACTIVITY_TIMEOUT_MS) {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        if (s) {
          supabase.auth.signOut().then(() => {
            setIsAdmin(false);
            setUser(null);
            setSession(null);
            localStorage.removeItem(LAST_ACTIVITY_KEY);
            toast.info("Session expired due to inactivity");
          });
        }
      });
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAdmin,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};