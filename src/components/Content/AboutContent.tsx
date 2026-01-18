import { motion } from "framer-motion";
import { MapPin, Calendar, Coffee } from "lucide-react";

const AboutContent = () => {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">
          About <span className="text-gradient-unc">Me</span>
        </h2>
        <p className="text-muted-foreground">Software Engineer & AI Researcher</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap gap-4 text-sm text-muted-foreground"
      >
        <span className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Chapel Hill, NC
        </span>
        <span className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          2 Years Experience
        </span>
        <span className="flex items-center gap-2">
          <Coffee className="w-4 h-4 text-primary" />
          Coffee Enthusiast
        </span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-4 text-foreground/90"
      >
        <p>
          I'm a passionate software engineer with a love for building large-scale performative systems.
          My journey in tech started with curiosity about how things work, and it's evolved into a career focused on creating
          impactful technology. I'm currently a software engineer at Deutsche Bank and Graduate AI Researcher at Georgia Tech.
        </p>
        <p>
          When I'm not coding, you can find me exploring new technologies,
          contributing to open-source projects, or sharing knowledge with the
          developer/student community. I believe in writing clean, maintainable code
          that makes a difference, and I'm always looking for new challenges and opportunities to grow.
          I'm also really interested in startups, having been a previous founder myself!
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-3 gap-4 pt-4"
      >
        {[
          { number: "20+", label: "Projects" },
          { number: "10+", label: "Clients" },
          { number: "2+", label: "Years" },
        ].map((stat, index) => (
          <div key={index} className="text-center p-4 rounded-lg bg-secondary/30">
            <div className="font-display text-2xl font-bold text-primary">{stat.number}</div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default AboutContent;