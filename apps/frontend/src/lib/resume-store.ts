"use client";

/**
 * Mock resume storage.
 *
 * One localStorage key holds every user's resumes keyed by user id, matching
 * the shape a real "GET /resumes" would return. The demo user starts with two
 * sample CVs (`ensureSeeded`) so the card grid, the blurred preview and the
 * overview stats are populated on first run instead of an empty state that
 * hides layout bugs.
 */

import type { ExperienceEntry, Resume, ResumeTemplateId } from "@helpmycv/shared";
import {
  DEFAULT_SECTION_ORDER,
  createResume,
  createId,
  emptyEntries,
  migrateResume,
} from "@helpmycv/shared";

import { readJson, STORAGE_KEYS, writeJson } from "@/lib/storage";

type ResumeMap = Record<string, Resume[]>;

function loadResumes(): ResumeMap {
  return readJson<ResumeMap>(STORAGE_KEYS.resumes, {});
}

function saveResumes(map: ResumeMap): void {
  writeJson(STORAGE_KEYS.resumes, map);
}

/** The seeded demo user. Kept in sync with `DEMO_CREDENTIALS.user`. */
const DEMO_USER_ID = "usr_demo_user";

/**
 * A fully populated CV built from the reference resume the user supplied
 * (`Juliardi Dwi Anggoro-resume.pdf`).
 *
 * The two short seeds above only exercise the card grid. This one exists so
 * every section renders with real content on first run — the five-entry
 * experience list in particular is what makes the nested sortable and the
 * per-entry duplicate/delete worth judging.
 */
function seedDetailedResume(): Resume {
  const resume = createResume({
    id: "cv_seed_qa_engineer",
    userId: DEMO_USER_ID,
    title: "QA Engineer — Full Profile",
    templateId: "blank",
  });

  resume.personal = {
    fullName: "Juliardi Dwi Anggoro",
    role: "Quality Assurance Engineer",
    email: "keianggoro12@gmail.com",
    phone: "",
    address: "Jl. Budi Mulya No. 16, Pademangan Barat, North Jakarta 14420, Indonesia",
    portfolioUrl: "https://github.com/keianggoro12",
    summary:
      "QA engineer working with Playwright and TypeScript for UI automation and API testing, after starting out with Cucumber, Selenium, Java, Serenity BDD and Rest Assured. I write test plans, create and execute test cases, build automation, and work closely with product and engineering to keep quality from slipping. I became a senior in under a year, aiming next at QA Engineering Manager.",
    photoUrl: null,
  };

  const experience = (
    company: string,
    role: string,
    location: string,
    startDate: string,
    endDate: string,
    current: boolean,
    employmentType: string,
    bullets: string[],
  ): ExperienceEntry => ({
    id: createId("exp"),
    company,
    role,
    location,
    startDate,
    endDate,
    current,
    employmentType,
    bullets: bullets.map((text) => ({ id: createId("b"), text })),
  });

  resume.sections = [
    resume.sections.find((section) => section.key === "personal")!,
    {
      key: "experience",
      visible: true,
      entries: {
        kind: "experience",
        items: [
          experience(
            "PT Tempo Inti Media Tbk",
            "Senior Quality Assurance",
            "Jakarta, Indonesia",
            "2024-11",
            "",
            true,
            "Full-time",
            [
              "Developed and maintained end-to-end test automation with Playwright and TypeScript, covering API and UI scenarios for a media platform that carries Tempo Magazine, Koran Tempo, and Tempo.co.",
              "Contributed to test documentation and process improvements, and joined project kick-off sessions to keep delivery aligned with functional and non-functional requirements.",
            ],
          ),
          experience(
            "Kinobi AI",
            "Quality Assurance Automation Engineer",
            "Singapore",
            "2024-03",
            "2024-11",
            false,
            "Freelance",
            [
              "Built API and UI automation with Playwright and TypeScript to give the product comprehensive, repeatable test coverage.",
              "Designed maintainable test scenarios with the QA team and applied automation best practices to improve stability and execution time.",
            ],
          ),
          experience(
            "Kinobi AI",
            "Quality Assurance Engineer",
            "Singapore",
            "2023-09",
            "2024-02",
            false,
            "Full-time",
            [
              "Created and executed test cases per development task for a student success platform serving more than 60 global clients, including universities and government agencies.",
              "Identified, reported, and tracked bugs and technical debt, then created the follow-up tasks and occasionally assisted with deployment.",
            ],
          ),
          experience(
            "Terra AI",
            "Student Mentor",
            "Singapore",
            "2022-08",
            "2022-11",
            false,
            "Contract",
            [
              "Mentored 20 students in the Certified Independent Study (Merdeka Campus) program, guiding design thinking for business and marketing chatbots.",
            ],
          ),
          experience(
            "Terra AI",
            "Chatbot Developer Intern (Tokobot)",
            "Singapore",
            "2022-02",
            "2022-07",
            false,
            "Internship",
            [
              "Led end-to-end chatbot development from ideation and user research through prototyping to implementation.",
              "Built scalable chatbot infrastructure and reusable templates, optimised for low data usage, so UMKM and other businesses could adopt them easily.",
            ],
          ),
        ],
      },
    },
    resume.sections.find((section) => section.key === "education")!,
    {
      key: "skills",
      visible: true,
      entries: {
        kind: "skills",
        items: [
          "Playwright",
          "TypeScript",
          "API Testing",
          "Selenium",
          "Cucumber",
          "Serenity BDD",
          "Rest Assured",
          "JMeter",
          "Postman",
          "TestRail",
          "MySQL",
          "JIRA",
          "ClickUp",
          "Git & GitHub",
        ].map((name) => ({ id: createId("skill"), name, level: "", bullets: [] })),
      },
    },
    resume.sections.find((section) => section.key === "projects")!,
    {
      key: "achievements",
      visible: true,
      entries: {
        kind: "achievements",
        items: [
          {
            id: createId("achv"),
            title: "MySkill Class — Advanced Microsoft Excel",
            organization: "MySkill",
            date: "2023-01",
            url: "",
            bullets: [],
          },
          {
            id: createId("achv"),
            title: "Thesis: Community Satisfaction Index for Public Services",
            organization: "Muhammadiyah Buton University",
            date: "",
            url: "",
            bullets: [],
          },
        ],
      },
    },
    {
      key: "certifications",
      visible: true,
      entries: {
        kind: "certifications",
        items: [
          {
            id: createId("cert"),
            name: "Quality Assurance Engineer — Immersive Program",
            issuer: "Alterra Academy",
            date: "2023-02",
            url: "",
            bullets: [],
          },
        ],
      },
    },
  ];

  const education = resume.sections.find((section) => section.key === "education")!;
  if (education.entries.kind === "education") {
    education.entries.items = [
      {
        id: createId("edu"),
        institution: "Alterra Academy",
        location: "Indonesia",
        startDate: "2022-08",
        endDate: "2023-02",
        current: false,
        degree: "Certificate in Quality Assurance Engineer — Immersive Program",
        gpa: "",
        bullets: [
          {
            id: createId("b"),
            text: "Four-month intensive program in software testing fundamentals: agile testing, test documentation, Java and OOP, REST API, BDD, Selenium, Rest Assured, Serenity BDD, load testing with JMeter, and SQL.",
          },
          {
            id: createId("b"),
            text: 'Capstone: manual and automated testing of the "KosKita" web and API surface.',
          },
        ],
      },
      {
        id: createId("edu"),
        institution: "Muhammadiyah Buton University",
        location: "Baubau, Indonesia",
        startDate: "2018-07",
        endDate: "2022-11",
        current: false,
        degree: "Bachelor of Government Science",
        gpa: "3.81/4.00",
        bullets: [{ id: createId("b"), text: "Graduated cumlaude." }],
      },
    ];
  }

  resume.updatedAt = new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString();
  resume.createdAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString();
  resume.status = "final";

  return resume;
}

function seedDemoResumes(): Resume[] {
  const now = Date.now();
  const first = createResume({
    id: "cv_seed_backend",
    userId: DEMO_USER_ID,
    title: "Backend Engineer",
    templateId: "blank",
  });
  const second = createResume({
    id: "cv_seed_internship",
    userId: DEMO_USER_ID,
    title: "Internship Application",
    templateId: "blank",
  });

  first.updatedAt = new Date(now - 1000 * 60 * 60 * 26).toISOString();
  first.createdAt = new Date(now - 1000 * 60 * 60 * 24 * 40).toISOString();
  first.status = "final";
  first.personal = {
    fullName: "Demo User",
    role: "Backend Engineer",
    email: "user@helpmycv.id",
    phone: "+62 812 3456 7890",
    address: "Jakarta, Indonesia",
    portfolioUrl: "https://github.com/demo",
    summary: "Backend engineer focused on reliable APIs and data pipelines.",
    photoUrl: null,
  };

  second.updatedAt = new Date(now - 1000 * 60 * 60 * 3).toISOString();
  second.createdAt = new Date(now - 1000 * 60 * 60 * 24 * 6).toISOString();
  second.personal = {
    ...first.personal,
    role: "Software Engineer Intern",
    summary: "",
  };

  return [seedDetailedResume(), first, second];
}

/**
 * Writes the demo CVs on first run. Keyed on the storage key rather than a
 * separate "seeded" flag, so clearing the CV list also re-seeds it — a reset
 * that leaves you with a permanently empty dashboard is worse than no reset.
 */
export function ensureSeeded(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (window.localStorage.getItem(STORAGE_KEYS.resumes) !== null) {
    return;
  }
  saveResumes({ [DEMO_USER_ID]: seedDemoResumes() });
}

export function listResumes(userId: string): Resume[] {
  return (loadResumes()[userId] ?? []).map(migrateResume).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getResume(userId: string, resumeId: string): Resume | null {
  const found = (loadResumes()[userId] ?? []).find((resume) => resume.id === resumeId);
  return found ? migrateResume(found) : null;
}

/**
 * Brings a stored resume up to the current section shape.
 *
 * Resumes are persisted per user in one localStorage blob, so any CV written
 * before a section was added is missing it entirely. Appending the new
 * sections on read keeps older data usable without a write-on-load side
 * effect, and without it the editor would render a section list that silently
 * omits whatever was added since.
 *
 * The implementation is shared with the backend, which needs the same
 * migration when it reads a document written by an older client.
 */
export { migrateResume };

export function createBlankResume(
  userId: string,
  title: string,
  templateId: ResumeTemplateId,
  email?: string,
): Resume {
  const resume = createResume({ id: createId("cv"), userId, title, templateId, email });
  const map = loadResumes();
  saveResumes({ ...map, [userId]: [resume, ...(map[userId] ?? [])] });
  return resume;
}

export function saveResume(resume: Resume): Resume {
  const map = loadResumes();
  const list = map[resume.userId] ?? [];
  const index = list.findIndex((candidate) => candidate.id === resume.id);

  const updated: Resume = { ...resume, updatedAt: new Date().toISOString() };
  const next = index === -1 ? [updated, ...list] : list.map((item) => (item.id === resume.id ? updated : item));

  saveResumes({ ...map, [resume.userId]: next });
  return updated;
}

export function renameResume(userId: string, resumeId: string, title: string): void {
  const map = loadResumes();
  saveResumes({
    ...map,
    [userId]: (map[userId] ?? []).map((resume) =>
      resume.id === resumeId ? { ...resume, title, updatedAt: new Date().toISOString() } : resume,
    ),
  });
}

export function deleteResume(userId: string, resumeId: string): void {
  const map = loadResumes();
  saveResumes({
    ...map,
    [userId]: (map[userId] ?? []).filter((resume) => resume.id !== resumeId),
  });
}
