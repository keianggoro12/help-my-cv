"use client";

/**
 * Resume storage.
 *
 * One localStorage key holds every user's resumes keyed by user id, matching
 * the shape a real "GET /resumes" would return. The demo user starts with two
 * sample CVs (`ensureSeeded`) so the card grid, the blurred preview and the
 * overview stats are populated on first run instead of an empty state that
 * hides layout bugs.
 *
 * When `API_ENABLED`, every read and write goes to the Hono backend instead and
 * localStorage becomes a read-through cache of the last server response. That
 * split matters: leaving resumes in localStorage meant nothing an author saved
 * ever reached D1, so `/admin/resumes` legitimately had nothing to list.
 * The cache keeps the app usable if the network fails, but the server is the
 * only writer of record — never the cache.
 */

import type { ExperienceEntry, PersonalInfo, Resume, ResumeTemplateId } from "@helpmycv/shared";
import {
  DEFAULT_SECTION_ORDER,
  createResume,
  createId,
  emptyEntries,
  migrateResume,
} from "@helpmycv/shared";

import { api, API_ENABLED } from "@/lib/api-client";
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
 *
 * Skipped entirely once the API is live: these are fake rows for a fake user id
 * that does not exist in D1, and seeding them into the cache would show a
 * signed-in user CVs belonging to someone else until the first real fetch
 * replaced them.
 */
export function ensureSeeded(): void {
  if (typeof window === "undefined") {
    return;
  }
  if (API_ENABLED) {
    return;
  }
  if (window.localStorage.getItem(STORAGE_KEYS.resumes) !== null) {
    return;
  }
  saveResumes({ [DEMO_USER_ID]: seedDemoResumes() });
}

/** Overwrites the cache entry for one user, keeping other users' rows intact. */
function cacheResumes(userId: string, resumes: Resume[]): void {
  saveResumes({ ...loadResumes(), [userId]: resumes });
}

/**
 * Every cached resume for a user, migrated and newest-first.
 *
 * Used as the synchronous initial value and as the offline fallback when a
 * fetch fails, so a dropped connection still renders the last known list
 * instead of blanking the page.
 */
export function listResumes(userId: string): Resume[] {
  return (loadResumes()[userId] ?? []).map(migrateResume).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * The server's copy of the list for this user.
 *
 * A plain `ApiResumeSummary` has no sections, so each row is paired with the
 * local cache to rebuild a full document — the grid and overview only need the
 * title, status and timestamps, but `ResumeCard` is typed against `Resume` and
 * reading `resume.status` off a half-populated object would show a wrong badge.
 */
async function fetchResumeList(userId: string): Promise<Resume[]> {
  const { resumes } = await api.listResumes();
  const cached = loadResumes()[userId] ?? [];
  const byId = new Map(cached.map((resume) => [resume.id, resume]));

  return resumes.map((summary) => {
    const local = byId.get(summary.id);
    const base = local ?? createResume({ id: summary.id, userId: summary.userId, title: summary.title });
    return migrateResume({
      ...base,
      id: summary.id,
      userId: summary.userId,
      title: summary.title,
      status: summary.status,
      createdAt: summary.createdAt ?? base.createdAt,
      updatedAt: summary.updatedAt,
    });
  });
}

/**
 * Loads this user's CVs from the backend, refreshing the cache as a side
 * effect. Falls back to the cache on any failure so a network error degrades
 * to stale data rather than an empty page.
 */
export async function loadResumesForUser(userId: string): Promise<Resume[]> {
  if (!API_ENABLED) {
    return listResumes(userId);
  }
  try {
    const list = await fetchResumeList(userId);
    cacheResumes(userId, list);
    return list;
  } catch {
    return listResumes(userId);
  }
}

/**
 * One resume, fetched in full from the backend.
 *
 * The editor needs every section, which the list endpoint does not return, so
 * this is a separate request rather than a cache hit. Returns `null` on a 404
 * so the editor can render its "not found" state, and on any other failure
 * falls back to the cached copy — a draft in progress is not worth losing to a
 * flaky connection.
 *
 * In-flight requests are shared: `useEffect` runs twice under StrictMode and
 * again on any re-render, and without this each pass would open its own request
 * and write the cache again. Deduplicating by id is what makes the cache write
 * idempotent from the caller's point of view.
 */
const inFlight = new Map<string, Promise<Resume | null>>();

export function getResume(userId: string, resumeId: string): Promise<Resume | null> {
  if (!API_ENABLED) {
    const found = listResumes(userId).find((resume) => resume.id === resumeId);
    return Promise.resolve(found ?? null);
  }

  const existing = inFlight.get(resumeId);
  if (existing) {
    return existing;
  }

  const request = (async () => {
    try {
      const { resume } = await api.getResume(resumeId);
      const document = migrateResume(resume.document);
      cacheResumes(userId, [
        document,
        ...listResumes(userId).filter((candidate) => candidate.id !== resumeId),
      ]);
      return document;
    } catch {
      return listResumes(userId).find((resume) => resume.id === resumeId) ?? null;
    } finally {
      inFlight.delete(resumeId);
    }
  })();

  inFlight.set(resumeId, request);
  return request;
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

export async function createBlankResume(
  userId: string,
  title: string,
  templateId: ResumeTemplateId,
  email?: string,
  personal?: Partial<PersonalInfo>,
): Promise<Resume> {
  if (API_ENABLED) {
    // The server mints the id, so the client cannot predict the row it is about
    // to insert — the returned id is what the editor route has to open.
    const { resume } = await api.createResume({ title });
    const document = migrateResume(resume.document);
    // Pre-fill the identity fields from the signed-in user, then persist. The
    // server's document is a blank slate, so without this the editor opened with
    // empty name/email/phone even though the user had already filled them in on
    // their profile — every CV had to be re-typed from scratch. Only the fields
    // the document leaves empty are seeded, so a template that does supply a
    // value keeps it.
    const seeded: Resume = { ...document, personal: { ...document.personal, ...compactPersonal(personal) } };
    const saved = await saveResume(seeded);
    cacheResumes(userId, [saved, ...listResumes(userId).filter((r) => r.id !== saved.id)]);
    return saved;
  }

  const resume = createResume({ id: createId("cv"), userId, title, templateId, email });
  const seeded: Resume = { ...resume, personal: { ...resume.personal, ...compactPersonal(personal) } };
  const map = loadResumes();
  saveResumes({ ...map, [userId]: [seeded, ...(map[userId] ?? [])] });
  return seeded;
}

/**
 * Drops empty values so seeding cannot overwrite a template's own content with
 * blanks, and so the offline and online paths seed exactly the same fields.
 */
function compactPersonal(personal?: Partial<PersonalInfo>): Partial<PersonalInfo> {
  if (!personal) {
    return {};
  }
  const entries = Object.entries(personal).filter(([, value]) => value !== undefined && value !== "");
  return Object.fromEntries(entries) as Partial<PersonalInfo>;
}

export async function saveResume(resume: Resume): Promise<Resume> {
  const updated: Resume = { ...resume, updatedAt: new Date().toISOString() };

  if (API_ENABLED) {
    // Both halves are sent: the editor mutates `title` through rename but the
    // document blob also carries it, and the backend keeps the two in sync from
    // whichever arrives. A failure here must not silently drop the draft, so the
    // cache is written first and the caller's error is re-thrown for the toast.
    cacheResumes(resume.userId, [
      updated,
      ...listResumes(resume.userId).filter((candidate) => candidate.id !== updated.id),
    ]);
    const result = await api.updateResume(updated.id, {
      title: updated.title,
      document: updated,
    });
    return { ...updated, updatedAt: result.resume.updatedAt };
  }

  const map = loadResumes();
  const list = map[resume.userId] ?? [];
  const index = list.findIndex((candidate) => candidate.id === resume.id);

  const next = index === -1 ? [updated, ...list] : list.map((item) => (item.id === resume.id ? updated : item));

  saveResumes({ ...map, [resume.userId]: next });
  return updated;
}

export async function renameResume(userId: string, resumeId: string, title: string): Promise<void> {
  if (API_ENABLED) {
    const { resume } = await api.updateResume(resumeId, { title });
    cacheResumes(userId, [
      { ...(listResumes(userId).find((r) => r.id === resumeId) ?? createResume({ id: resumeId, userId, title })), title, updatedAt: resume.updatedAt },
      ...listResumes(userId).filter((r) => r.id !== resumeId),
    ]);
    return;
  }

  const map = loadResumes();
  saveResumes({
    ...map,
    [userId]: (map[userId] ?? []).map((resume) =>
      resume.id === resumeId ? { ...resume, title, updatedAt: new Date().toISOString() } : resume,
    ),
  });
}

export async function deleteResume(userId: string, resumeId: string): Promise<void> {
  if (API_ENABLED) {
    await api.deleteResume(resumeId);
    cacheResumes(
      userId,
      listResumes(userId).filter((resume) => resume.id !== resumeId),
    );
    return;
  }

  const map = loadResumes();
  saveResumes({
    ...map,
    [userId]: (map[userId] ?? []).filter((resume) => resume.id !== resumeId),
  });
}
