import { motion } from "framer-motion";

const projects = [
  {
    title: "Bloom E-Commerce",
    category: "Web Development",
    description: "A modern e-commerce platform with seamless checkout experience and real-time inventory management.",
    tags: ["React", "Node.js", "Stripe"],
    image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop",
  },
  {
    title: "Mindful App",
    category: "Mobile Design",
    description: "Meditation and wellness application featuring guided sessions and progress tracking.",
    tags: ["React Native", "Firebase", "UI/UX"],
    image: "https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&h=600&fit=crop",
  },
  {
    title: "Fintech Dashboard",
    category: "Web Application",
    description: "Comprehensive financial dashboard with real-time analytics and portfolio management.",
    tags: ["TypeScript", "D3.js", "PostgreSQL"],
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop",
  },
];

const Projects = () => {
  return (
    <section id="work" className="section-padding">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <p className="text-muted-foreground text-sm tracking-widest uppercase mb-4">
            Selected Work
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-medium">
            Featured <span className="text-accent">Projects</span>
          </h2>
        </motion.div>

        <div className="space-y-20">
          {projects.map((project, index) => (
            <motion.article
              key={index}
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group"
            >
              <div className={`grid md:grid-cols-2 gap-8 md:gap-12 items-center ${index % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                <div className={`${index % 2 === 1 ? 'md:order-2' : ''}`}>
                  <div className="overflow-hidden">
                    <img
                      src={project.image}
                      alt={project.title}
                      className="w-full aspect-[4/3] object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                    />
                  </div>
                </div>
                <div className={`${index % 2 === 1 ? 'md:order-1' : ''}`}>
                  <p className="text-accent text-sm tracking-widest uppercase mb-3">
                    {project.category}
                  </p>
                  <h3 className="font-display text-3xl md:text-4xl font-medium mb-4 group-hover:text-accent transition-colors">
                    {project.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {project.description}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {project.tags.map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="text-xs tracking-wide px-3 py-1 bg-secondary text-secondary-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <a
                    href="#"
                    className="link-hover text-foreground font-medium inline-flex items-center gap-2"
                  >
                    View Project
                    <svg
                      className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </a>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Projects;
