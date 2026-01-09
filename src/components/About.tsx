import { motion } from "framer-motion";

const About = () => {
  return (
    <section id="about" className="section-padding bg-card">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-2 gap-12 md:gap-20"
        >
          <div>
            <p className="text-muted-foreground text-sm tracking-widest uppercase mb-4">
              About Me
            </p>
            <h2 className="font-display text-4xl md:text-5xl font-medium mb-6">
              Turning ideas into
              <br />
              <span className="text-accent">reality</span>
            </h2>
          </div>

          <div className="space-y-6">
            <p className="text-muted-foreground leading-relaxed text-lg">
              I'm a creative developer with over 5 years of experience building 
              digital products. I specialize in crafting intuitive interfaces and 
              seamless user experiences that bridge the gap between design and technology.
            </p>
            <p className="text-muted-foreground leading-relaxed text-lg">
              When I'm not coding, you'll find me exploring new design trends, 
              contributing to open-source projects, or experimenting with emerging 
              technologies. I believe in continuous learning and pushing the boundaries 
              of what's possible on the web.
            </p>
            <div className="pt-4">
              <a
                href="#contact"
                className="link-hover text-foreground font-medium"
              >
                Let's work together →
              </a>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 pt-12 border-t border-border"
        >
          {[
            { number: "5+", label: "Years Experience" },
            { number: "50+", label: "Projects Completed" },
            { number: "30+", label: "Happy Clients" },
            { number: "10+", label: "Awards Won" },
          ].map((stat, index) => (
            <div key={index} className="text-center md:text-left">
              <p className="font-display text-4xl md:text-5xl font-medium text-accent mb-2">
                {stat.number}
              </p>
              <p className="text-muted-foreground text-sm">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default About;
