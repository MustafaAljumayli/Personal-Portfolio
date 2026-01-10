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
          About <span className="text-gradient">Me</span>
        </h2>
        <p className="text-muted-foreground">Software Engineer & Creative Technologist</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap gap-4 text-sm text-muted-foreground"
      >
        <span className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          San Francisco, CA
        </span>
        <span className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          5+ Years Experience
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
          I'm a passionate software engineer with a love for building beautiful, 
          functional web applications. My journey in tech started with curiosity 
          about how things work, and it's evolved into a career focused on creating 
          meaningful digital experiences.
        </p>
        <p>
          When I'm not coding, you can find me exploring new technologies, 
          contributing to open-source projects, or sharing knowledge with the 
          developer community. I believe in writing clean, maintainable code 
          that makes a difference.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-3 gap-4 pt-4"
      >
        {[
          { number: "50+", label: "Projects" },
          { number: "30+", label: "Clients" },
          { number: "5+", label: "Years" },
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