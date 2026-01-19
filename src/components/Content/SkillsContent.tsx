import { motion } from "framer-motion";
import { resumeSkillCategories } from "@/data/resume";

const SkillsContent = () => {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">
          My <span className="text-gradient-unc">Skills</span>
        </h2>
        <p className="text-muted-foreground">Technologies and tools I work with</p>
      </motion.div>

      <div className="grid gap-4">
        {resumeSkillCategories.map((category, categoryIndex) => (
          <motion.div
            key={category.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + categoryIndex * 0.1 }}
            className="p-4 rounded-lg bg-secondary/30"
          >
            <h3 className="font-display font-semibold text-primary mb-3">
              {category.title}
            </h3>
            <div className="flex flex-wrap gap-2">
              {category.skills.map((skill, skillIndex) => (
                <motion.span
                  key={skill}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + categoryIndex * 0.1 + skillIndex * 0.05 }}
                  className="px-3 py-1.5 text-sm rounded-full bg-background/50 border border-border/50 hover:border-primary/50 hover:text-primary transition-colors cursor-default"
                >
                  {skill}
                </motion.span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SkillsContent;