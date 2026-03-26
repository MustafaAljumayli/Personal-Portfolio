import { motion } from "framer-motion";
import { Download, Briefcase, GraduationCap, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/api";
import { useResumeData } from "@/hooks/useResumeData";

const ResumeContent = () => {
  const { experience, education } = useResumeData();
  const handleDownloadPdf = () => {
    window.open(`${API_BASE_URL}/api/resume/download`, "_blank", "noopener,noreferrer");
  };

  const getBullets = (job: (typeof experience)[number]) =>
    job.bullets?.length ? job.bullets : job.description ? [job.description] : [];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <h2 className="font-display text-3xl md:text-4xl font-bold mb-2">
          My <span className="text-gradient-unc">Resume</span>
        </h2>
        <p className="text-muted-foreground">Experience and education</p>
        <Button variant="outline" size="sm" className="gap-2 w-fit" onClick={handleDownloadPdf}>
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
          {experience.map((job, index) => {
            const bullets = getBullets(job);
            return (
              <motion.div
                key={`${job.title}-${job.company}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.1 }}
                className="relative"
              >
                <div className="absolute -left-[1.35rem] top-1.5 w-2.5 h-2.5 rounded-full bg-primary" />
                <div className="text-sm text-muted-foreground">{job.period}</div>
                <h4 className="font-semibold">{job.title}</h4>
                <div className="text-sm text-primary">{job.company}</div>
                {bullets.length === 1 ? (
                  <p className="text-sm text-muted-foreground mt-1">{bullets[0]}</p>
                ) : bullets.length > 1 ? (
                  <ul className="list-disc list-outside ml-4 mt-1 space-y-0.5">
                    {bullets.map((b, i) => (
                      <li key={i} className="text-sm text-muted-foreground">{b}</li>
                    ))}
                  </ul>
                ) : null}
              </motion.div>
            );
          })}
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
              {edu.gpa && (
                <div className="text-sm text-muted-foreground mt-0.5">GPA: {edu.gpa}</div>
              )}
              {edu.awards && edu.awards.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {edu.awards.map((award, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-sm text-yellow-500/90">
                      <Award className="w-3.5 h-3.5 flex-shrink-0" />
                      {award}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default ResumeContent;