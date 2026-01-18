import { motion } from "framer-motion";
import { ExternalLink, Github } from "lucide-react";
import { Link } from "react-router-dom";
import { projects } from "@/data/projects";

const WorkContent = () => {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">
          My <span className="text-gradient-unc">Work</span>
        </h2>
        <p className="text-muted-foreground">Featured projects and creations</p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2">
        {projects.slice(0, 4).map((project, index) => (
          <motion.div
            key={project.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.08 }}
            className="group p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display font-semibold text-lg group-hover:text-primary transition-colors truncate">
                    {project.title}
                  </h3>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {project.githubUrl && (
                      <a
                        className="p-1 hover:text-primary"
                        href={project.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${project.title} GitHub`}
                      >
                        <Github className="w-4 h-4" />
                      </a>
                    )}
                    {project.liveUrl && (
                      <a
                        className="p-1 hover:text-primary"
                        href={project.liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${project.title} Live link`}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mt-1">{project.description}</p>

                <div className="flex flex-wrap gap-2 mt-3">
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

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <Link
          to="/projects"
          className="block w-full py-3 text-center text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
        >
          View All Projects →
        </Link>
      </motion.div>
    </div>
  );
};

export default WorkContent;