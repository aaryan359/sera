export const summaryLengths = ["Brief", "Balanced", "Detailed"] as const;
export const summarySchedules = ["As updates arrive", "Morning & evening", "Once a day"] as const;
export const summaryPriorities = ["Important first", "Everything"] as const;
export const morningTimes = ["7:00 AM", "8:00 AM", "9:00 AM"] as const;
export const reviewTimes = ["6:00 PM", "8:00 PM", "9:00 PM"] as const;
export const quietWindows = [
    "10:00 PM – 8:00 AM",
    "11:00 PM – 7:00 AM",
    "9:00 PM – 9:00 AM",
] as const;

export interface SettingsPreferences {
    homeSummaries: boolean;
    pushNotifications: boolean;
    actionUpdates: boolean;
    quietHours: boolean;
    morningBriefing: boolean;
    dailyReview: boolean;
    eventReminders: boolean;
    summaryLength: (typeof summaryLengths)[number];
    summarySchedule: (typeof summarySchedules)[number];
    summaryPriority: (typeof summaryPriorities)[number];
    morningTime: (typeof morningTimes)[number];
    reviewTime: (typeof reviewTimes)[number];
    quietWindow: (typeof quietWindows)[number];
}

export const defaultPreferences: SettingsPreferences = {
    homeSummaries: true,
    pushNotifications: false,
    actionUpdates: true,
    quietHours: true,
    morningBriefing: true,
    dailyReview: true,
    eventReminders: false,
    summaryLength: "Brief",
    summarySchedule: "Morning & evening",
    summaryPriority: "Important first",
    morningTime: "8:00 AM",
    reviewTime: "8:00 PM",
    quietWindow: "10:00 PM – 8:00 AM",
};

// Only restore recognized values, so outdated or damaged settings stay usable.
export function parsePreferences(raw: string | null): SettingsPreferences {
    if (!raw) return { ...defaultPreferences };
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return { ...defaultPreferences };
    const result = { ...defaultPreferences };
    const values = saved as Record<string, unknown>;
    for (const key of [
        "homeSummaries",
        "pushNotifications",
        "actionUpdates",
        "quietHours",
        "morningBriefing",
        "dailyReview",
        "eventReminders",
    ] as const) {
        if (typeof values[key] === "boolean") result[key] = values[key];
    }
    for (const [key, choices] of [
        ["summaryLength", summaryLengths],
        ["summarySchedule", summarySchedules],
        ["summaryPriority", summaryPriorities],
        ["morningTime", morningTimes],
        ["reviewTime", reviewTimes],
        ["quietWindow", quietWindows],
    ] as const) {
        const value = values[key];
        if (typeof value === "string" && (choices as readonly string[]).includes(value)) {
            Object.assign(result, { [key]: value });
        }
    }
    return result;
}
