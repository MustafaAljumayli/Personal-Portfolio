import { motion } from "framer-motion";

const skills = [
  {
    category: "Frontend",
    items: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Framer Motion"],
  },
  {
    category: "Backend",
    items: ["Node.js", "Python", "PostgreSQL", "GraphQL", "REST APIs"],
  },
  {
    category: "Design",
    items: ["Figma", "UI/UX Design", "Prototyping", "Design Systems", "Branding"],
  },
  {
    category: "Tools",
    items: ["Git", "Docker", "AWS", "Vercel", "CI/CD"],
  },
];

const Skills = () => {
  return (
    <section id="skills" className="section-padding bg-card">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <p className="text-muted-foreground text-sm tracking-widest uppercase mb-4">
            My Expertise
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-medium">
            Skills & <span className="text-accent">Technologies</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
          {skills.map((skillGroup, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <h3 className="font-display text-xl font-medium mb-6 text-accent">
                {skillGroup.category}
              </h3>
              <ul className="space-y-3">
                {skillGroup.items.map((skill, skillIndex) => (
                  <li
                    key={skillIndex}
                    className="text-muted-foreground hover:text-foreground transition-colors cursor-default"
                  >
                    {skill}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Skills;
