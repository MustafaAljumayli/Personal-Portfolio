import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { resumeEducation, resumeExperience, resumeProfile, resumeSkillCategories, resumeSummary } from "@/data/resume";

const ResumeTemplate = () => {
    useEffect(() => {
        // Optional: try to open the print dialog automatically.
        // Some browsers block programmatic printing unless the user clicks.
        const url = new URL(window.location.href);
        if (url.searchParams.get("autoprint") === "1") {
            setTimeout(() => window.print(), 150);
        }
    }, []);

    return (
        <div className="min-h-screen bg-white text-black">
            {/* Print controls (hidden when printing) */}
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur px-4 py-3 print:hidden">
                <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
                    <div className="text-sm text-gray-600">
                        Use <span className="font-semibold">Print</span> and choose <span className="font-semibold">Save as PDF</span>.
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => window.print()}>
                            Print / Save as PDF
                        </Button>
                        <Button asChild>
                            <a href="/" rel="noreferrer">Back</a>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Page */}
            <div className="mx-auto max-w-4xl px-8 py-10 print:px-0 print:py-0">
                {/* One-column header */}
                <header>
                    <h1 className="text-3xl font-bold leading-tight">{resumeProfile.name}</h1>
                    <p className="mt-1 text-sm text-gray-700">{resumeProfile.headline}</p>
                    <p className="mt-2 text-sm text-gray-800">
                        {[resumeProfile.location, resumeProfile.email, resumeProfile.website, resumeProfile.linkedin, resumeProfile.github]
                            .filter(Boolean)
                            .join(" • ")}
                    </p>
                </header>

                <hr className="my-5 border-gray-200" />

                <section>
                    <h2 className="text-xs font-semibold tracking-widest text-gray-700 uppercase">Summary</h2>
                    <p className="mt-2 text-sm leading-relaxed text-gray-800">{resumeSummary}</p>
                </section>

                <section className="mt-5">
                    <h2 className="text-xs font-semibold tracking-widest text-gray-700 uppercase">Experience</h2>

                    <div className="mt-3 space-y-4">
                        {resumeExperience.map((job) => (
                            <div key={`${job.title}-${job.company}-${job.period}`}>
                                <div className="flex items-baseline justify-between gap-4">
                                    <div>
                                        <div className="text-sm font-semibold">{job.title}</div>
                                        <div className="text-sm text-gray-800">{job.company}</div>
                                    </div>
                                    <div className="text-xs text-gray-600 whitespace-nowrap">{job.period}</div>
                                </div>
                                <ul className="mt-2 list-disc pl-5 text-sm text-gray-800">
                                    <li>{job.description}</li>
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mt-5">
                    <h2 className="text-xs font-semibold tracking-widest text-gray-700 uppercase">Education</h2>
                    <div className="mt-3 space-y-3">
                        {resumeEducation.map((edu) => (
                            <div key={`${edu.degree}-${edu.school}-${edu.period}`} className="flex items-baseline justify-between gap-4">
                                <div>
                                    <div className="text-sm font-semibold">{edu.degree}</div>
                                    <div className="text-sm text-gray-800">{edu.school}</div>
                                </div>
                                <div className="text-xs text-gray-600 whitespace-nowrap">{edu.period}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="mt-5">
                    <h2 className="text-xs font-semibold tracking-widest text-gray-700 uppercase">Skills</h2>
                    <p className="mt-2 text-sm text-gray-800">
                        {resumeSkillCategories
                            .flatMap((c) => c.skills)
                            .filter((v, i, arr) => arr.indexOf(v) === i)
                            .join(", ")}
                    </p>
                </section>
            </div>
        </div>
    );
};

export default ResumeTemplate;


