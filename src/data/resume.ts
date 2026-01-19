export type ResumeExperience = {
    title: string;
    company: string;
    period: string;
    description: string;
};

export type ResumeEducation = {
    degree: string;
    school: string;
    period: string;
};

export type SkillCategory = {
    title: string;
    skills: string[];
};

export const resumeProfile = {
    name: "Mustafa Aljumayli",
    headline: "Software Engineer • AI Researcher",
    location: "Chapel Hill, NC",
    email: "mustafa@aljumayli.com",
    website: "www.mustafaaljumayli.com",
    linkedin: "linkedin.com/in/mustafa-aljumayli",
    github: "github.com/id-mustafa",
    twitter: "x.com/aljumayli2145",
} as const;

export const resumeSummary =
    "Software engineer focused on building performant systems and applied AI. Currently at Deutsche Bank and Georgia Tech, with experience spanning startups, research, and full‑stack product development.";

export const resumeExperience: ResumeExperience[] = [
    {
        title: "Graduate Research Assistant",
        company: "Georgia Institute of Technology",
        period: "January 2026 - Present",
        description: "Graduate Researcher at Georgia Tech in Applied AI/ML research.",
    },
    {
        title: "Software Engineer, Analyst",
        company: "Deutsche Bank",
        period: "July 2025 - Present",
        description: "Development for the Investment Banking Research Technology team.",
    },
    {
        title: "Software Engineer",
        company: "PhotoniCare Inc.",
        period: "December 2024 - July 2025",
        description:
            "Startup in the healthcare industry. Developed on the OtoSight device: a device that captures and analyzes infection in the ear canal.",
    },
    {
        title: "Software Developer",
        company: "University of North Carolina at Chapel Hill",
        period: "July 2024 - December 2024",
        description: "Provided development support for the UNC college of arts and sciences.",
    },
    {
        title: "Data Warehouse Analyst",
        company: "UNC School of Government",
        period: "May 2024 - July 2024",
        description: "Created data pipelines for the UNC School of Government.",
    },
    {
        title: "Data Visualization Analyst",
        company: "BeAM UNC",
        period: "March 2024 - June 2024",
        description: "Created data visualizations for the UNC Chapel Hill OASIS and BeAM Makerspace.",
    },
    {
        title: "IT Support Technician / Student IT Team Lead",
        company: "University of North Carolina at Chapel Hill",
        period: "August 2023 - July 2024",
        description: "Provided IT support for the college of arts and sciences.",
    },
    {
        title: "Founder",
        company: "FetchTek",
        period: "May 2018 - August 2023",
        description:
            "Created a B2B business that provided IT asset liquidation for companies. Grew into the largest electronic distributor in the RDU region ~ $7M in revenue.",
    },
    {
        title: "Realtor",
        company: "Pinnacle Group Realty / Weichert Realtors",
        period: "February 2021 - July 2021",
        description: "Helped clients buy and sell homes.",
    },
    {
        title: "Realtor",
        company: "Marti Hampton Real Estate",
        period: "October 2020 - February 2021",
        description: "Helped clients buy and sell homes.",
    },
    {
        title: "Market Development Manager / Appointment Setter",
        company: "EMPWR Solar",
        period: "February 2020 - August 2022",
        description:
            "Managed and grew the solar panel installation business by setting appointments and closing deals.",
    },
    {
        title: "Sales Associate",
        company: "Walmart",
        period: "July 2018 - October 2019",
        description: "Helped customers find products and complete transactions.",
    },
];

export const resumeEducation: ResumeEducation[] = [
    {
        degree: "CONSIDERING: PhD in Computer Science",
        school: "Massachusetts Institute of Technology or Stanford University",
        period: "TBD",
    },
    {
        degree: "PLANNED: Master's in Business Administration",
        school: "Harvard University or Stanford University",
        period: "TBD",
    },
    {
        degree: "M.S. Computer Science, Artificial Intelligence Specialization",
        school: "Georgia Institute of Technology",
        period: "August 2025 - December 2026",
    },
    {
        degree: "B.S. Computer Science",
        school: "UNC Chapel Hill",
        period: "May 2023 - May 2025",
    },
    {
        degree: "A.S. Science",
        school: "Wake Technical Community College",
        period: "January 2020 - May 2023",
    },
];

export const resumeSkillCategories: SkillCategory[] = [
    {
        title: "Frontend",
        skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Three.js", "HTML", "CSS"],
    },
    {
        title: "Backend",
        skills: ["Node.js", "Python", "PostgreSQL", "GraphQL", "Redis", "MySQL"],
    },
    {
        title: "Tools & DevOps",
        skills: ["Git", "Docker", "AWS", "GCP", "Jenkins", "Kubernetes", "CI/CD"],
    },
    {
        title: "Other",
        skills: ["UI/UX Design", "Agile", "System Design", "API Design", "REST", "SOAP", "GraphQL", "WebSocket", "TCP/IP", "UDP", "SSH", "HTTP", "HTTPS", "FTP", "SMTP", "VPN", "Firewall", "Load Balancer", "Proxy", "Cache"],
    },
];


