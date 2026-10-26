export const APPLICATION_STATUSES = ["SAVED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "WITHDRAWN"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_METHODS = ["EMAIL", "FORM", "OTHER"] as const;
export type ApplicationMethod = (typeof APPLICATION_METHODS)[number];

export interface Application {
  id: string;
  company: string;
  role: string;
  jobUrl: string;
  status: ApplicationStatus;
  method: ApplicationMethod;
  notes: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

export interface NewApplication {
  company: string;
  role: string;
  jobUrl: string;
  status: ApplicationStatus;
  method: ApplicationMethod;
  notes: string;
}

// The user's job-application log. Stored in Sera's database; an in-memory version is used by tests.
export interface ApplicationStore {
  add(input: NewApplication, now: string): Promise<Application>;
  list(status?: ApplicationStatus): Promise<Application[]>;
  setStatus(id: string, status: ApplicationStatus, now: string): Promise<Application | null>;
}

export function createMemoryApplicationStore(): ApplicationStore {
  const rows = new Map<string, Application>();
  let counter = 0;
  return {
    async add(input, now) {
      const app: Application = { ...input, id: `app${++counter}`, createdAt: now, updatedAt: now };
      rows.set(app.id, app);
      return app;
    },
    async list(status) {
      return [...rows.values()].filter((app) => status === undefined || app.status === status);
    },
    async setStatus(id, status, now) {
      const app = rows.get(id);
      if (!app) return null;
      app.status = status;
      app.updatedAt = now;
      return app;
    },
  };
}
