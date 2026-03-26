import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, User, Briefcase, Code, Mail, FileText, BookOpen, Sparkles, LogIn, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

interface SpaceNavProps {
  activeSection: string | null;
  onSectionChange: (section: string | null) => void;
}

const navItems = [
  { id: "about", label: "About", icon: User },
  { id: "projects", label: "Projects", icon: Briefcase },
  { id: "skills", label: "Skills", icon: Code },
  { id: "contact", label: "Contact", icon: Mail },
  { id: "resume", label: "Resume", icon: FileText },
  { id: "blog", label: "Blog", icon: BookOpen },
  { id: "ai", label: "Mustafa.ai", icon: Sparkles },
];

const SpaceNav = ({ activeSection, onSectionChange }: SpaceNavProps) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, isAdmin, signOut } = useAuth();

  const handleNavClick = (id: string) => {
    onSectionChange(id);
    setIsMobileOpen(false);
  };

  const handleLogoClick = () => {
    onSectionChange(null);
    setIsMobileOpen(false);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/30 bg-background/30 backdrop-blur-md">
        <div className="px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={handleLogoClick}
            className="font-display text-2xl font-bold tracking-tight hover:text-primary transition-colors"
          >
            <img src="/astronautpfp.PNG" alt="Astronaut picture of Mustafa" className="w-10" />
            {/* <span className="text-gradient-unc">M</span> */}
            {/* <span className="text-gradient-unc">M</span>
            <span className="text-foreground">ustafa </span> */}
            {/* <span className="text-gradient-unc">A</span>
            <span className="text-foreground">ljumayli</span> */}
          </button>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`
                     flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-10
                    ${isActive
                      ? "bg-primary/20 text-primary glow-text"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Auth Controls */}
          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <>
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    <span>Admin</span>
                  </Link>
                )}
                <button
                  onClick={signOut}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                className="flex items-center gap-2 px-4 py-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          >
            {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.34, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed inset-0 z-40 min-h-[100dvh] bg-card pt-20 overflow-y-auto"
          >
            <div className="flex flex-col items-center gap-4 p-6">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <motion.button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`
                       flex items-center gap-3 px-6 py-3 rounded-lg text-lg font-medium w-full max-w-xs transition-all
                      ${isActive
                        ? "bg-primary/20 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </motion.button>
                );
              })}

              <div className="border-t border-border/30 w-full max-w-xs pt-4 mt-4">
                {user ? (
                  <>
                    {isAdmin && (
                      <Link
                        to="/admin"
                        className="flex items-center gap-3 px-6 py-3 text-primary w-full max-w-xs"
                        onClick={() => setIsMobileOpen(false)}
                      >
                        <Shield className="w-5 h-5" />
                        <span>Admin Dashboard</span>
                      </Link>
                    )}
                    <button
                      onClick={() => { signOut(); setIsMobileOpen(false); }}
                      className="flex items-center gap-3 px-6 py-3 text-muted-foreground w-full max-w-xs"
                    >
                      <LogOut className="w-5 h-5" />
                      <span>Sign Out</span>
                    </button>
                  </>
                ) : (
                  <Link
                    to="/auth"
                    className="flex items-center gap-3 px-6 py-3 text-primary w-full max-w-xs"
                    onClick={() => setIsMobileOpen(false)}
                  >
                    <LogIn className="w-5 h-5" />
                    <span>Sign In</span>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SpaceNav;