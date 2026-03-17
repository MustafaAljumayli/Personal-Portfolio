import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/api";
import {
  resumeProfile,
  resumeSummary,
  resumeExperience,
  resumeEducation,
  resumeSkillCategories,
  type ResumeExperience,
  type ResumeEducation,
  type SkillCategory,
} from "@/data/resume";
import { projects, type Project } from "@/data/projects";

export interface SiteSettings {
  name: string;
  headline: string;
}

export interface AboutTag {
  icon: string;
  text: string;
}

export interface AboutStat {
  number: string;
  label: string;
}

export interface AboutData {
  subtitle: string;
  tags: AboutTag[];
  paragraphs: string[];
  stats: AboutStat[];
}

interface ResumeProfile {
  name: string;
  headline: string;
  location: string;
  email: string;
  website: string;
  linkedin: string;
  github: string;
  twitter: string;
}

interface ResumeData {
  settings: SiteSettings;
  about: AboutData;
  profile: ResumeProfile;
  summary: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  skillCategories: SkillCategory[];
  projects: Project[];
  isLoading: boolean;
}

const defaultSettings: SiteSettings = {
  name: "Mustafa Aljumayli",
  headline: "Software Engineer • AI Researcher",
};

const defaultAbout: AboutData = {
  subtitle: "Software Engineer & AI Researcher",
  tags: [
    { icon: "MapPin", text: "Chapel Hill, NC" },
    { icon: "Calendar", text: "2 Years Experience" },
    { icon: "Coffee", text: "Coffee Enthusiast" },
  ],
  paragraphs: [
    "I'm a passionate software engineer with a love for building large-scale performative systems. My journey in tech started with curiosity about how things work, and it's evolved into a career focused on creating impactful technology. I'm currently a software engineer at Deutsche Bank and Graduate AI Researcher at Georgia Tech.",
    "When I'm not coding, you can find me exploring new technologies, contributing to open-source projects, or sharing knowledge with the developer/student community. I believe in writing clean, maintainable code that makes a difference, and I'm always looking for new challenges and opportunities to grow. I'm also really interested in startups, having been a previous founder myself!",
  ],
  stats: [
    { number: "20+", label: "Projects" },
    { number: "10+", label: "Clients" },
    { number: "2+", label: "Years" },
  ],
};

let cachedData: Omit<ResumeData, "isLoading"> | null = null;
let fetchPromise: Promise<Omit<ResumeData, "isLoading"> | null> | null = null;

const staticData: Omit<ResumeData, "isLoading"> = {
  settings: defaultSettings,
  about: defaultAbout,
  profile: { ...resumeProfile } as ResumeProfile,
  summary: resumeSummary,
  experience: resumeExperience,
  education: resumeEducation,
  skillCategories: resumeSkillCategories,
  projects,
};

function normalizeExperience(raw: any[]): ResumeExperience[] {
  return raw.map((e) => ({
    ...e,
    bullets: e.bullets ?? (e.description ? [e.description] : []),
  }));
}

async function fetchResumeData(): Promise<Omit<ResumeData, "isLoading"> | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/content`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      settings: data.settings ? { ...defaultSettings, ...data.settings } : staticData.settings,
      about: data.about ? { ...defaultAbout, ...data.about } : staticData.about,
      profile: data.profile ?? staticData.profile,
      summary: data.summary ?? staticData.summary,
      experience: data.experience ? normalizeExperience(data.experience) : staticData.experience,
      education: data.education ?? staticData.education,
      skillCategories: data.skillCategories ?? staticData.skillCategories,
      projects: data.projects ?? staticData.projects,
    };
  } catch {
    return null;
  }
}

const CONTENT_UPDATED_EVENT = "content-updated";

export function useResumeData(): ResumeData {
  const [data, setData] = useState<Omit<ResumeData, "isLoading">>(cachedData ?? staticData);
  const [isLoading, setIsLoading] = useState(!cachedData);

  useEffect(() => {
    let cancelled = false;

    const doFetch = () => {
      if (!fetchPromise) {
        fetchPromise = fetchResumeData();
      }
      fetchPromise.then((result) => {
        if (cancelled) return;
        if (result) {
          cachedData = result;
          setData(result);
        }
        setIsLoading(false);
      });
    };

    if (!cachedData) doFetch();

    const onUpdate = () => {
      cachedData = null;
      fetchPromise = null;
      setIsLoading(true);
      doFetch();
    };

    window.addEventListener(CONTENT_UPDATED_EVENT, onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(CONTENT_UPDATED_EVENT, onUpdate);
    };
  }, []);

  return { ...data, isLoading };
}

export function invalidateResumeCache() {
  cachedData = null;
  fetchPromise = null;
}

export function notifyContentUpdated() {
  invalidateResumeCache();
  window.dispatchEvent(new Event(CONTENT_UPDATED_EVENT));
}
