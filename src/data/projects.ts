export interface Project {
  title: string;
  description?: string;
  bullets?: string[];
  tech: string[];
  githubUrl?: string | null;
  liveUrl?: string | null;
}

export const projects: Project[] = [
  {
    title: "AI Dashboard",
    description: "Real-time analytics platform with machine learning insights",
    tech: ["React", "Python", "TensorFlow"],
    githubUrl: "#",
    liveUrl: "#",
  },
  {
    title: "E-Commerce Platform",
    description: "Full-stack marketplace with payment integration",
    tech: ["Next.js", "Node.js", "Stripe"],
    githubUrl: "#",
    liveUrl: "#",
  },
  {
    title: "Social Media App",
    description: "Mobile-first social platform with real-time messaging",
    tech: ["React Native", "Firebase", "WebSocket"],
    githubUrl: "#",
    liveUrl: "#",
  },
];
