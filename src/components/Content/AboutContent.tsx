import { motion } from "framer-motion";
import { MapPin, Calendar, Coffee, Star, Heart, Zap, Globe, Award, Lightbulb } from "lucide-react";
import { useResumeData } from "@/hooks/useResumeData";

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  MapPin, Calendar, Coffee, Star, Heart, Zap, Globe, Award, Lightbulb,
};

const AboutContent = () => {
  const { about } = useResumeData();

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
        <p className="text-muted-foreground">{about.subtitle}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-wrap gap-4 text-sm text-muted-foreground"
      >
        {about.tags.map((tag, i) => {
          const Icon = iconMap[tag.icon] ?? Star;
          return (
            <span key={i} className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              {tag.text}
            </span>
          );
        })}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-4 text-foreground/90"
      >
        {about.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-3 gap-4 pt-4"
      >
        {about.stats.map((stat, index) => (
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
