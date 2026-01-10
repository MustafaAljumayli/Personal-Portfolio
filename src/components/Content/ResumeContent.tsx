import { motion } from "framer-motion";
import { Download, Briefcase, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

const experience = [
  {
    title: "Senior Software Engineer",
    company: "Tech Corp",
    period: "2022 - Present",
    description: "Leading frontend architecture and mentoring junior developers.",
  },
  {
    title: "Software Engineer",
    company: "StartupXYZ",
    period: "2020 - 2022",
    description: "Built scalable web applications serving millions of users.",
  },
  {
    title: "Junior Developer",
    company: "Agency Inc",
    period: "2019 - 2020",
    description: "Developed client websites and e-commerce solutions.",
  },
];

const education = [
  {
    degree: "M.S. Computer Science",
    school: "Stanford University",
    period: "2017 - 2019",
  },
  {
    degree: "B.S. Software Engineering",
    school: "MIT",
    period: "2013 - 2017",
  },
];

const ResumeContent = () => {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">
            My <span className="text-gradient">Resume</span>
          </h2>
          <p className="text-muted-foreground">Experience and education</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          PDF
        </Button>
      </motion.div>

      {/* Experience */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="font-display font-semibold text-lg flex items-center gap-2 mb-4">
          <Briefcase className="w-5 h-5 text-primary" />
          Experience
        </h3>
        <div className="space-y-4 border-l-2 border-border/50 pl-4">
          {experience.map((job, index) => (
            <motion.div
              key={job.title}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="relative"
            >
              <div className="absolute -left-[1.35rem] top-1.5 w-2.5 h-2.5 rounded-full bg-primary" />
              <div className="text-sm text-muted-foreground">{job.period}</div>
              <h4 className="font-semibold">{job.title}</h4>
              <div className="text-sm text-primary">{job.company}</div>
              <p className="text-sm text-muted-foreground mt-1">{job.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Education */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h3 className="font-display font-semibold text-lg flex items-center gap-2 mb-4">
          <GraduationCap className="w-5 h-5 text-primary" />
          Education
        </h3>
        <div className="space-y-3 border-l-2 border-border/50 pl-4">
          {education.map((edu, index) => (
            <motion.div
              key={edu.degree}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="relative"
            >
              <div className="absolute -left-[1.35rem] top-1.5 w-2.5 h-2.5 rounded-full bg-accent" />
              <div className="text-sm text-muted-foreground">{edu.period}</div>
              <h4 className="font-semibold">{edu.degree}</h4>
              <div className="text-sm text-accent">{edu.school}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default ResumeContent;