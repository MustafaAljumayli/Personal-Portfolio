import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";

const Admin = lazy(() => import("./pages/Admin"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const ResumeTemplate = lazy(() => import("./pages/ResumeTemplate"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<Index />} />
              <Route path="/projects" element={<Index />} />
              <Route path="/skills" element={<Index />} />
              <Route path="/contact" element={<Index />} />
              <Route path="/resume" element={<Index />} />
              <Route path="/ai" element={<Index />} />
              <Route path="/blog" element={<Index />} />
              <Route path="/blog/:slug" element={<Index />} />
              <Route path="/privacy-policy" element={<Index />} />
              <Route path="/terms-and-conditions" element={<Index />} />
              <Route path="/profile" element={<Index />} />
              <Route path="/performance-instructions" element={<Index />} />
              <Route path="/auth" element={<Index />} />
              <Route path="/projects-showcase" element={<ProjectsPage />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/resume-template" element={<ResumeTemplate />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
