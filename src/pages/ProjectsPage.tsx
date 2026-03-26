import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Github } from "lucide-react";
import { projects } from "@/data/projects";

const ProjectsPage = () => {
  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <div className="star-field" />

      <header className="fixed top-0 left-0 right-0 z-20 bg-background/30 backdrop-blur-md border-b border-border/30">
        <div className="px-6 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>

          <div className="font-display text-lg font-semibold">
            <span className="text-gradient-unc">Projects</span>
          </div>

          <div className="w-[60px]" />
        </div>
      </header>

      <main className="pt-20 h-full overflow-y-auto custom-scrollbar">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-3xl md:text-4xl font-bold mb-2"
          >
            All <span className="text-gradient-unc">Projects</span>
          </motion.h1>
          <p className="text-muted-foreground mb-8">
            A full list of my work—scroll to explore.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project, index) => (
              <motion.article
                key={project.title}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * index }}
                className="glass-panel flex flex-col gap-3 p-5"
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

                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-display text-lg font-semibold">{project.title}</h2>
                  <div className="flex flex-shrink-0 gap-2 text-muted-foreground">
                    {project.githubUrl && (
                      <a
                        href={project.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${project.title} GitHub`}
                        className="transition-colors hover:text-primary"
                      >
                        <Github className="h-4 w-4" />
                      </a>
                    )}
                    {project.liveUrl && (
                      <a
                        href={project.liveUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${project.title} Live link`}
                        className="transition-colors hover:text-primary"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">{project.description}</p>

                <div className="mt-1 flex flex-wrap gap-2">
                  {project.tech.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProjectsPage;
