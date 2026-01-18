export interface Project {
  title: string;
  description: string;
  tech: string[];
  githubUrl?: string;
  liveUrl?: string;
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
  // Add more projects here as needed
];
