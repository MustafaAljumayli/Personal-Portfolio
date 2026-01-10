import { motion } from "framer-motion";
import { ExternalLink, Github } from "lucide-react";

const projects = [
  {
    title: "AI Dashboard",
    description: "Real-time analytics platform with machine learning insights",
    tech: ["React", "Python", "TensorFlow"],
    image: "bg-gradient-to-br from-purple-500/20 to-blue-500/20",
  },
  {
    title: "E-Commerce Platform",
    description: "Full-stack marketplace with payment integration",
    tech: ["Next.js", "Node.js", "Stripe"],
    image: "bg-gradient-to-br from-green-500/20 to-cyan-500/20",
  },
  {
    title: "Social Media App",
    description: "Mobile-first social platform with real-time messaging",
    tech: ["React Native", "Firebase", "WebSocket"],
    image: "bg-gradient-to-br from-pink-500/20 to-orange-500/20",
  },
];

const WorkContent = () => {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">
          My <span className="text-gradient">Work</span>
        </h2>
        <p className="text-muted-foreground">Featured projects and creations</p>
      </motion.div>

      <div className="space-y-4">
        {projects.map((project, index) => (
          <motion.div
            key={project.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            className="group p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all cursor-pointer"
          >
            <div className="flex gap-4">
              <div className={`w-16 h-16 rounded-lg ${project.image} flex-shrink-0`} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-lg group-hover:text-primary transition-colors">
                    {project.title}
                  </h3>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 hover:text-primary">
                      <Github className="w-4 h-4" />
                    </button>
                    <button className="p-1 hover:text-primary">
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
                <div className="flex gap-2 mt-2">
                  {project.tech.map((tech) => (
                    <span
                      key={tech}
                      className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="w-full py-3 text-center text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
      >
        View All Projects →
      </motion.button>
    </div>
  );
};

export default WorkContent;