import { motion } from "framer-motion";

const Hero = () => {
  return (
    <section className="min-h-screen flex items-center section-padding">
      <div className="container-narrow w-full">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <p className="text-muted-foreground text-sm md:text-base tracking-widest uppercase mb-6">
            Creative Developer & Designer
          </p>
        </motion.div>

        <motion.h1
          className="font-display text-5xl md:text-7xl lg:text-8xl font-medium leading-tight mb-8"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
        >
          Hello, I'm{" "}
          <span className="text-accent">Alex Chen</span>
          <br />
          I craft digital
          <br />
          experiences.
        </motion.h1>

        <motion.p
          className="text-muted-foreground text-lg md:text-xl max-w-xl leading-relaxed mb-12"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        >
          A passionate developer focused on creating elegant, user-centered 
          digital solutions that make a difference.
        </motion.p>

        <motion.div
          className="flex flex-wrap gap-6"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
        >
          <a
            href="#work"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-4 text-sm tracking-wide hover:bg-primary/90 transition-colors"
          >
            View My Work
            <svg
              className="w-4 h-4"
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
          <a
            href="#contact"
            className="inline-flex items-center gap-2 border border-primary text-primary px-8 py-4 text-sm tracking-wide hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Get in Touch
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
