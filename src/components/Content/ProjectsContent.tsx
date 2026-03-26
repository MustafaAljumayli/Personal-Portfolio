import { motion } from "framer-motion";
import { ExternalLink, Github } from "lucide-react";
import { useResumeData } from "@/hooks/useResumeData";

const ProjectsContent = () => {
  const { projects } = useResumeData();

  const getDescription = (p: (typeof projects)[number]) =>
    p.description || (p.bullets?.length ? p.bullets[0] : "");

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">
          My <span className="text-gradient-unc">Projects</span>
        </h2>
        <p className="text-muted-foreground">Featured projects and creations</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-x-hidden">
        {projects.map((project, index) => (
          <motion.div
            key={project.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.08 }}
            className="group flex flex-col gap-3 rounded-lg bg-secondary/30 p-4 transition-all hover:bg-secondary/50 min-w-0"
          >
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-primary/25 to-accent/20">
              {project.imageUrl ? (
                <img
                  src={project.imageUrl}
                  alt={project.title}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
            </div>

            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-lg font-semibold transition-colors group-hover:text-primary">
                  {project.title}
                </h3>
                <div className="flex flex-shrink-0 gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  {project.githubUrl && project.githubUrl !== "#" && (
                    <a
                      className="p-1 hover:text-primary"
                      href={project.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${project.title} GitHub`}
                    >
                      <Github className="h-4 w-4" />
                    </a>
                  )}
                  {project.liveUrl && project.liveUrl !== "#" && (
                    <a
                      className="p-1 hover:text-primary"
                      href={project.liveUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${project.title} Live link`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>

              {project.bullets && project.bullets.length > 1 ? (
                <ul className="ml-4 mt-1 list-outside list-disc space-y-0.5">
                  {project.bullets.map((b, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {b}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">{getDescription(project)}</p>
              )}

              {project.tech.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {project.tech.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default ProjectsContent;
