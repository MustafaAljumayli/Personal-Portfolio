import { motion } from "framer-motion";

const Contact = () => {
  return (
    <section id="contact" className="section-padding">
      <div className="container-narrow">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-muted-foreground text-sm tracking-widest uppercase mb-4">
            Get in Touch
          </p>
          <h2 className="font-display text-4xl md:text-6xl font-medium mb-6">
            Let's work <span className="text-accent">together</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Have a project in mind? I'd love to hear about it. Send me a message
            and let's create something amazing together.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="max-w-xl mx-auto"
        >
          <form className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm text-muted-foreground mb-2"
                >
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  className="w-full bg-transparent border-b border-border py-3 focus:border-accent outline-none transition-colors"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm text-muted-foreground mb-2"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  className="w-full bg-transparent border-b border-border py-3 focus:border-accent outline-none transition-colors"
                  placeholder="your@email.com"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="message"
                className="block text-sm text-muted-foreground mb-2"
              >
                Message
              </label>
              <textarea
                id="message"
                rows={5}
                className="w-full bg-transparent border-b border-border py-3 focus:border-accent outline-none transition-colors resize-none"
                placeholder="Tell me about your project..."
              />
            </div>
            <button
              type="submit"
              className="w-full bg-primary text-primary-foreground py-4 text-sm tracking-wide hover:bg-primary/90 transition-colors mt-8"
            >
              Send Message
            </button>
          </form>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          viewport={{ once: true }}
          className="flex justify-center gap-8 mt-16 pt-16 border-t border-border"
        >
          {[
            { label: "Email", value: "hello@alexchen.dev", href: "mailto:hello@alexchen.dev" },
            { label: "LinkedIn", value: "linkedin.com/in/alexchen", href: "#" },
            { label: "GitHub", value: "github.com/alexchen", href: "#" },
          ].map((link, index) => (
            <a
              key={index}
              href={link.href}
              className="text-center group"
            >
              <p className="text-muted-foreground text-sm mb-1">{link.label}</p>
              <p className="link-hover text-foreground">{link.value}</p>
            </a>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Contact;
